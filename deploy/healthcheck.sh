#!/usr/bin/env bash
# Diagnóstico completo do Tappo numa VPS — roda sem alterar nada.
set -uo pipefail
DIR="${TAPPO_DIR:-/root/tappo}"
export TAPPO_DIR="$DIR"
cd "$DIR" 2>/dev/null || { echo "Não encontrei $DIR"; exit 1; }
source "$DIR/deploy/_common.sh"
set +e  # diagnóstico: um teste falhar nunca deve matar o script

FALHAS=0
ok()  { c_verde  "  ✓ $1"; }
erro(){ c_vermelho "  ✗ $1"; FALHAS=$((FALHAS + 1)); }

passo "Containers"
for s in app waha caddy; do
  st="$(docker_compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$s" '$1==s{print $2}')"
  case "$st" in
    running) ok "$s: rodando" ;;
    "") erro "$s: não encontrado (não subiu, ou perfil sem Caddy por proxy externo)" ;;
    *) erro "$s: $st" ;;
  esac
done

passo "App respondendo (interno)"
curl -fsS --max-time 5 "http://127.0.0.1:3000/login" >/dev/null 2>&1 && ok "http://127.0.0.1:3000/login OK" || erro "App não respondeu em 127.0.0.1:3000/login"

DOMAIN="$(env_get DOMAIN)"
if [ -n "$DOMAIN" ]; then
  passo "Domínio público e HTTPS"
  IP_LOCAL="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  IP_DNS="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}')"
  if [ -n "$IP_DNS" ] && [ -n "$IP_LOCAL" ] && [ "$IP_DNS" = "$IP_LOCAL" ]; then
    ok "DNS de $DOMAIN aponta pra esta VPS ($IP_LOCAL)"
  else
    erro "DNS de $DOMAIN ($IP_DNS) não bate com o IP desta VPS ($IP_LOCAL) — ainda propagando ou errado"
  fi
  curl -fsS --max-time 8 "https://$DOMAIN/login" >/dev/null 2>&1 && ok "https://$DOMAIN/login OK (HTTPS funcionando)" || erro "https://$DOMAIN/login não respondeu — confira: docker compose logs caddy"
fi

passo "Supabase"
SUPA_URL="$(env_get NEXT_PUBLIC_SUPABASE_URL)"; SUPA_ANON="$(env_get NEXT_PUBLIC_SUPABASE_ANON_KEY)"
if [ -n "$SUPA_URL" ] && testar_credenciais_supabase "$SUPA_URL" "$SUPA_ANON"; then
  ok "Conexão com Supabase OK ($SUPA_URL)"
else
  erro "Não consegui falar com o Supabase — confira NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no .env"
fi

passo "WhatsApp (WAHA)"
if [ -n "$(docker_compose ps -q waha 2>/dev/null)" ]; then
  ok "Container do WAHA de pé"
else
  erro "Container do WAHA não está rodando"
fi

passo "Chaves de IA"
[ -n "$(env_get ANTHROPIC_API_KEY)" ] && ok "ANTHROPIC_API_KEY preenchida" || c_amarelo "  ANTHROPIC_API_KEY vazia — agente de IA não vai responder"

echo
if [ "$FALHAS" -eq 0 ]; then c_verde "Tudo certo ($FALHAS problema(s))."; else c_vermelho "$FALHAS problema(s) encontrado(s) — veja os ✗ acima."; fi
exit 0
