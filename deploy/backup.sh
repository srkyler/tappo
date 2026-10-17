#!/usr/bin/env bash
# Backup do banco (via SUPABASE_DB_URL) e das sessões do WhatsApp (volume do WAHA).
# O plano grátis do Supabase NÃO faz backup sozinho — agende este script no cron.
set -euo pipefail
DIR="${TAPPO_DIR:-/opt/tappo}"
export TAPPO_DIR="$DIR"
cd "$DIR"
source "$DIR/deploy/_common.sh"

DESTINO="$DIR/backups"
mkdir -p "$DESTINO"
AGORA="$(date +%Y%m%d-%H%M%S)"

SUPA_DB_URL="$(env_get SUPABASE_DB_URL)"
if [ -n "$SUPA_DB_URL" ] && command -v pg_dump >/dev/null; then
  passo "Backup do banco (Supabase)"
  pg_dump "$SUPA_DB_URL" --no-owner --no-privileges -f "$DESTINO/banco-$AGORA.sql"
  gzip "$DESTINO/banco-$AGORA.sql"
  c_verde "Salvo em $DESTINO/banco-$AGORA.sql.gz"
else
  c_amarelo "SUPABASE_DB_URL não configurada (ou pg_dump ausente) — pulando backup do banco. Configure em $ENV_FILE, ou use os backups do próprio Supabase (planos pagos)."
fi

passo "Backup das sessões do WhatsApp"
docker run --rm -v tappo_waha_sessions:/dados -v "$DESTINO":/backup alpine \
  tar czf "/backup/waha-sessions-$AGORA.tar.gz" -C /dados . 2>/dev/null \
  && c_verde "Salvo em $DESTINO/waha-sessions-$AGORA.tar.gz" \
  || c_amarelo "Não consegui copiar o volume waha_sessions (nome do volume pode variar pelo COMPOSE_PROJECT_NAME — confira com: docker volume ls)."

passo "Limpando backups com mais de 14 dias"
find "$DESTINO" -type f -mtime +14 -delete 2>/dev/null || true

echo
c_verde "Backup concluído em $DESTINO"
