#!/usr/bin/env bash
# Instala/reinstala o Tappo numa VPS Ubuntu/Debian. Idempotente: pode rodar
# de novo a qualquer momento sem duplicar nada nem perder dados do Supabase
# (o banco não roda aqui — só containers e .env são afetados).
#
# Uso:
#   bash deploy/install.sh https://github.com/<usuario>/<repo>.git
#   bash deploy/install.sh --yes                 (não interativo, exige .env já preenchido)
#
set -euo pipefail

REPO="${1:-}"
[ "$REPO" = "--yes" ] && { REPO=""; MODO_NAO_INTERATIVO=1; }
[ "${2:-}" = "--yes" ] && MODO_NAO_INTERATIVO=1
export MODO_NAO_INTERATIVO="${MODO_NAO_INTERATIVO:-0}"

DIR="${TAPPO_DIR:-/opt/tappo}"
export TAPPO_DIR="$DIR"

# --- 0. Código em $DIR (precisa existir antes de dar source no _common.sh) ---
if [ "$(id -u)" -ne 0 ]; then echo "Rode como root (sudo -i)."; exit 1; fi
apt-get install -y git curl >/dev/null 2>&1 || true

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  [ -n "$REPO" ] || { echo "Primeira instalação: informe a URL do repositório. Ex.: bash install.sh https://github.com/usuario/repo.git"; exit 1; }
  git clone "$REPO" "$DIR"
fi
cd "$DIR"
# shellcheck source=./_common.sh
source "$DIR/deploy/_common.sh"
source "$DIR/deploy/_supabase_criar.sh"

passo "Docker"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
systemctl enable --now docker

passo "Cliente Postgres (pra aplicar o schema direto no Supabase)"
command -v psql >/dev/null || apt-get install -y postgresql-client >/dev/null 2>&1 || true

passo "Firewall (22, 80, 443)"
if command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

passo "Verificando se as portas 80/443 já estão em uso por outro proxy"
PROXY_EXISTENTE=0
if ss -ltnp 2>/dev/null | grep -qE ':(80|443)\s' && ! docker ps --format '{{.Names}}' | grep -q '^tappo.*caddy'; then
  PROXY_EXISTENTE=1
  c_amarelo "Já existe algo ouvindo nas portas 80/443 (outro proxy/site nesta VPS)."
  c_amarelo "O Tappo vai subir SEM o Caddy — você aponta seu proxy existente pra http://127.0.0.1:3000 (app) e http://127.0.0.1:3001 (WAHA, opcional)."
fi

passo "Gerando .env (primeira vez) ou mantendo o existente"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  env_set AI_KEYS_SECRET "$(gerar_segredo)"
  env_set WAHA_API_KEY "$(gerar_hex 24)"
  env_set WAHA_DASHBOARD_PASSWORD "$(gerar_hex 12)"
  chmod 600 "$ENV_FILE"
fi

passo "Preenchendo o que falta (pula o que já está no .env)"
perguntar DOMAIN "Domínio do CRM (ex.: crm.suaempresa.com)"
if [ "$PROXY_EXISTENTE" = "0" ]; then
  perguntar WAHA_DOMAIN "Domínio do painel do WhatsApp/WAHA (ex.: waha.suaempresa.com)"
fi

if [ -z "$(env_get NEXT_PUBLIC_SUPABASE_URL)" ]; then
  if [ "${MODO_NAO_INTERATIVO:-0}" = "1" ]; then
    if [ -n "$(env_get SUPABASE_ACCESS_TOKEN)" ]; then
      supabase_criar_projeto || c_amarelo "Criação automática do Supabase falhou — preencha NEXT_PUBLIC_SUPABASE_URL etc. manualmente no .env e rode de novo."
    fi
  else
    echo
    read -r -p "Você já tem um projeto Supabase pronto, ou quer que eu crie um novo agora? (existente/novo) [novo]: " ESCOLHA_SUPA
    if [ "$ESCOLHA_SUPA" = "existente" ] || [ "$ESCOLHA_SUPA" = "e" ]; then
      : # segue pros perguntar() manuais abaixo
    else
      supabase_criar_projeto || c_amarelo "Não consegui criar sozinho — preenche manualmente abaixo."
    fi
  fi
fi

perguntar NEXT_PUBLIC_SUPABASE_URL "URL do projeto Supabase (https://xxxx.supabase.co)"
perguntar NEXT_PUBLIC_SUPABASE_ANON_KEY "Supabase anon public key"
perguntar SUPABASE_SERVICE_ROLE_KEY "Supabase service_role key (secreta)"
perguntar ANTHROPIC_API_KEY "ANTHROPIC_API_KEY (console.anthropic.com)" false
perguntar ADMIN_EMAILS "E-mail do administrador (quem vê /admin)"
perguntar SUPER_ADMIN_EMAIL "Mesmo e-mail (ou outro) que vai decidir quem mais pode ser admin"
perguntar SUPABASE_DB_URL "Connection string do Supabase — Session pooler (opcional, aplica o schema sozinho)" false

DOMAIN="$(env_get DOMAIN)"
SUPA_URL="$(env_get NEXT_PUBLIC_SUPABASE_URL)"
SUPA_ANON="$(env_get NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SUPA_DB_URL="$(env_get SUPABASE_DB_URL)"
NEXT_PUBLIC_APP_URL_ATUAL="$(env_get NEXT_PUBLIC_APP_URL)"
[ -n "$NEXT_PUBLIC_APP_URL_ATUAL" ] || env_set NEXT_PUBLIC_APP_URL "https://$DOMAIN"

passo "Validando o que você digitou (recusa agora, não 5 minutos de build depois)"
validar_dominio "$DOMAIN" || { c_vermelho "DOMAIN inválido: '$DOMAIN'. Use algo como crm.suaempresa.com (sem https://)."; exit 1; }
validar_supabase_url "$SUPA_URL" || { c_vermelho "NEXT_PUBLIC_SUPABASE_URL inválida: '$SUPA_URL'. Formato esperado: https://xxxx.supabase.co"; exit 1; }
if testar_credenciais_supabase "$SUPA_URL" "$SUPA_ANON"; then
  c_verde "Supabase respondeu — URL e anon key corretas."
else
  c_vermelho "Não consegui falar com o Supabase usando essa URL/anon key. Confira em Project Settings > API e rode de novo."
  exit 1
fi

if [ -n "$SUPA_DB_URL" ] && command -v psql >/dev/null; then
  passo "Aplicando o schema do banco (supabase/setup_completo.sql) — idempotente, pode repetir"
  if psql "$SUPA_DB_URL" -v ON_ERROR_STOP=1 -f supabase/setup_completo.sql; then
    c_verde "Schema aplicado."
  else
    c_amarelo "Falhou aplicar o schema automaticamente. Sem problema: cole supabase/setup_completo.sql no SQL Editor do Supabase manualmente."
  fi
else
  c_amarelo "SUPABASE_DB_URL não informada — aplique supabase/setup_completo.sql no SQL Editor do Supabase manualmente (passo descrito em COMO-SUBIR-NA-VPS.txt)."
fi

passo "Subindo os containers"
if [ "$PROXY_EXISTENTE" = "1" ]; then
  docker_compose up -d --build app waha
  c_amarelo "Caddy não subiu (proxy externo detectado). App em 127.0.0.1:3000, WAHA em 127.0.0.1:3001 — aponte seu proxy pra lá com HTTPS."
else
  docker_compose up -d --build
fi
docker image prune -f >/dev/null 2>&1 || true

passo "Checando saúde"
if aguardar_http_ok "http://127.0.0.1:3000/login" 40; then
  c_verde "App respondendo."
else
  c_vermelho "App não respondeu a tempo. Veja: docker compose -f $DIR/docker-compose.yml logs --tail=100 app"
fi
docker_compose ps

ADMIN_EMAIL_PRIMEIRO="$(env_get ADMIN_EMAILS | cut -d, -f1 | xargs || true)"
if [ -n "$ADMIN_EMAIL_PRIMEIRO" ] && [ "${MODO_NAO_INTERATIVO:-0}" != "1" ] && [ -z "$(env_get ADMIN_CRIADO)" ]; then
  echo
  read -r -p "Criar a primeira conta de login agora, pro e-mail $ADMIN_EMAIL_PRIMEIRO? (s/N) " RESP
  if [ "$RESP" = "s" ] || [ "$RESP" = "S" ]; then
    read -r -s -p "Senha pra essa conta (mín. 8 caracteres): " SENHA_ADMIN; echo
    SUPA_SERVICE="$(env_get SUPABASE_SERVICE_ROLE_KEY)"
    CODIGO="$(curl -s -o /tmp/tappo-admin.json -w '%{http_code}' -X POST "${SUPA_URL%/}/auth/v1/admin/users" \
      -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE" -H "Content-Type: application/json" \
      -d "{\"email\":\"$ADMIN_EMAIL_PRIMEIRO\",\"password\":\"$SENHA_ADMIN\",\"email_confirm\":true}")"
    if [ "$CODIGO" = "200" ]; then
      c_verde "Conta criada. Entre em https://$DOMAIN com $ADMIN_EMAIL_PRIMEIRO."
      env_set ADMIN_CRIADO "sim"
    else
      c_amarelo "Não criei a conta automaticamente (código $CODIGO — talvez já exista). Resposta em /tmp/tappo-admin.json. Pode criar pela tela de cadastro normalmente."
    fi
  fi
fi

echo
c_verde "Pronto. Acesse: https://$DOMAIN"
echo "Comandos úteis: docker compose -f $DIR/docker-compose.yml ps | logs -f app | restart app"
echo "Diagnóstico completo: bash $DIR/deploy/healthcheck.sh"
