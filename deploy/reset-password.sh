#!/usr/bin/env bash
# Redefine a senha de um usuário direto pelo Supabase Admin API — útil quando
# ninguém mais consegue entrar (ex.: e-mail de recuperação não chegou).
# Uso: bash deploy/reset-password.sh usuario@empresa.com "nova senha com 8+ caracteres"
set -euo pipefail
DIR="${TAPPO_DIR:-/opt/tappo}"
export TAPPO_DIR="$DIR"
cd "$DIR"
source "$DIR/deploy/_common.sh"

EMAIL="${1:-}"; SENHA="${2:-}"
[ -n "$EMAIL" ] && [ -n "$SENHA" ] || { c_vermelho "Uso: bash deploy/reset-password.sh email@empresa.com \"nova senha\""; exit 1; }
[ "${#SENHA}" -ge 8 ] || { c_vermelho "A senha precisa ter pelo menos 8 caracteres."; exit 1; }

SUPA_URL="$(env_get NEXT_PUBLIC_SUPABASE_URL)"
SUPA_SERVICE="$(env_get SUPABASE_SERVICE_ROLE_KEY)"
[ -n "$SUPA_URL" ] && [ -n "$SUPA_SERVICE" ] || { c_vermelho "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env."; exit 1; }

passo "Procurando o usuário"
RESP="$(curl -s "${SUPA_URL%/}/auth/v1/admin/users?email=$(printf '%s' "$EMAIL" | sed 's/@/%40/')" \
  -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE")"
ID="$(printf '%s' "$RESP" | grep -o '"id":"[a-f0-9-]*"' | head -1 | cut -d'"' -f4)"
[ -n "$ID" ] || { c_vermelho "Não encontrei esse e-mail. Resposta da API: $RESP"; exit 1; }

passo "Atualizando a senha"
CODIGO="$(curl -s -o /tmp/tappo-reset.json -w '%{http_code}' -X PUT "${SUPA_URL%/}/auth/v1/admin/users/$ID" \
  -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE" -H "Content-Type: application/json" \
  -d "{\"password\":\"$SENHA\"}")"

if [ "$CODIGO" = "200" ]; then
  c_verde "Senha de $EMAIL redefinida."
else
  c_vermelho "Falhou (código $CODIGO). Detalhes em /tmp/tappo-reset.json"
  exit 1
fi
