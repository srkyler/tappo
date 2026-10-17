#!/usr/bin/env bash
# Funções compartilhadas pelos scripts de deploy/. Sempre `source` este arquivo,
# nunca execute direto.
set -euo pipefail

TAPPO_DIR="${TAPPO_DIR:-/opt/tappo}"
ENV_FILE="$TAPPO_DIR/.env"

c_verde() { printf '\033[32m%s\033[0m\n' "$1"; }
c_amarelo() { printf '\033[33m%s\033[0m\n' "$1"; }
c_vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
passo() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

exigir_root() {
  [ "$(id -u)" -eq 0 ] || { c_vermelho "Rode como root (sudo -i)."; exit 1; }
}

# Lê uma variável do .env (sem exportar o arquivo inteiro, que pode ter valores com espaço/aspas)
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

# Escreve/atualiza uma variável no .env
env_set() {
  local chave="$1" valor="$2"
  touch "$ENV_FILE"
  if grep -qE "^$chave=" "$ENV_FILE"; then
    local tmp; tmp="$(mktemp)"
    awk -F= -v k="$chave" -v v="$valor" 'BEGIN{OFS="="} $1==k{$0=k"="v} 1' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "$chave=$valor" >> "$ENV_FILE"
  fi
}

gerar_segredo() { openssl rand -base64 48 | tr -d '\n/+=' | head -c 64; }
gerar_hex() { openssl rand -hex "${1:-24}"; }

# Pergunta uma variável se ela ainda não estiver preenchida no .env (ou se --yes, exige que já exista)
perguntar() {
  local chave="$1" rotulo="$2" obrigatorio="${3:-true}" atual novo
  atual="$(env_get "$chave")"
  if [ -n "$atual" ]; then return 0; fi
  if [ "${MODO_NAO_INTERATIVO:-0}" = "1" ]; then
    if [ "$obrigatorio" = "true" ]; then
      c_vermelho "Faltou $chave no .env (modo --yes exige tudo preenchido antes). Edite $ENV_FILE e rode de novo."
      exit 1
    fi
    return 0
  fi
  read -r -p "$rotulo: " novo
  if [ -z "$novo" ] && [ "$obrigatorio" = "true" ]; then
    c_vermelho "Esse campo é obrigatório."
    perguntar "$chave" "$rotulo" "$obrigatorio"
    return
  fi
  [ -n "$novo" ] && env_set "$chave" "$novo"
}

validar_dominio() {
  local v="$1"
  [[ "$v" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]]
}

validar_supabase_url() {
  [[ "$1" =~ ^https://[a-z0-9]+\.supabase\.co/?$ ]]
}

# Testa a URL+anon key de verdade contra a API do Supabase (não só o formato) —
# recusa na hora se a chave estiver errada, em vez de só falhar no build 5 minutos depois.
testar_credenciais_supabase() {
  local url="$1" anon="$2"
  local codigo
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${url%/}/rest/v1/" -H "apikey: $anon" || echo "000")"
  [ "$codigo" = "200" ] || [ "$codigo" = "404" ]
}

docker_compose() { docker compose --env-file "$ENV_FILE" -f "$TAPPO_DIR/docker-compose.yml" "$@"; }

# Extrai um campo string de um JSON simples (sem nested arrays) sem depender de jq.
# Uso: json_get "$RESPOSTA_CURL" "campo"
json_get() {
  printf '%s' "$1" | grep -oP "\"$2\"\\s*:\\s*\"[^\"]*\"" | head -n1 | sed -E 's/.*:\s*"([^"]*)"/\1/'
}

aguardar_http_ok() {
  local url="$1" tentativas="${2:-30}" i=0
  while [ $i -lt "$tentativas" ]; do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 2
  done
  return 1
}
