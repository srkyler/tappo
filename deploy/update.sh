#!/usr/bin/env bash
# Atualiza o Tappo pra última versão do git. Faz backup antes, e se o healthcheck
# falhar depois do build novo, volta pra imagem anterior sozinho.
set -euo pipefail
DIR="${TAPPO_DIR:-/opt/tappo}"
export TAPPO_DIR="$DIR"
cd "$DIR"
source "$DIR/deploy/_common.sh"
exigir_root

passo "Backup antes de tocar em qualquer coisa"
bash "$DIR/deploy/backup.sh" || c_amarelo "Backup falhou — seguindo mesmo assim porque você pediu update. Confira o motivo depois."

passo "Marcando a imagem atual como 'anterior' (pra rollback se precisar)"
docker tag tappo-app:latest tappo-app:anterior 2>/dev/null || c_amarelo "Sem imagem anterior pra marcar (primeira vez?)."

passo "Baixando código novo"
git fetch --all --prune
git reset --hard origin/main

COMMIT_ANTES="$(git rev-parse HEAD@{1} 2>/dev/null || echo "")"

passo "Reaplicando o schema (idempotente — 'already exists' é normal)"
SUPA_DB_URL="$(env_get SUPABASE_DB_URL)"
if [ -n "$SUPA_DB_URL" ] && command -v psql >/dev/null; then
  psql "$SUPA_DB_URL" -v ON_ERROR_STOP=1 -f supabase/setup_completo.sql && c_verde "Schema reaplicado." \
    || c_amarelo "Schema não aplicou de primeira — se for 'already exists'/'multiple primary keys', é ruído esperado. Se for outro erro, rode manualmente."
else
  c_amarelo "SUPABASE_DB_URL não configurada — se este update mudou o schema, cole supabase/setup_completo.sql no SQL Editor do Supabase."
fi

passo "Build e subida"
docker_compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

passo "Checando saúde"
if aguardar_http_ok "http://127.0.0.1:3000/login" 40; then
  c_verde "Atualização concluída e saudável."
else
  c_vermelho "App não respondeu depois do update. Revertendo pra imagem anterior…"
  if docker image inspect tappo-app:anterior >/dev/null 2>&1; then
    docker tag tappo-app:anterior tappo-app:latest
    docker_compose up -d app
    if [ -n "$COMMIT_ANTES" ]; then git reset --hard "$COMMIT_ANTES"; fi
    if aguardar_http_ok "http://127.0.0.1:3000/login" 20; then
      c_amarelo "Revertido com sucesso pra versão anterior. A atualização NÃO foi aplicada — avise quem mantém o projeto."
    else
      c_vermelho "Revertido mas ainda não respondeu — rode: docker compose -f $DIR/docker-compose.yml logs --tail=150 app"
    fi
  else
    c_vermelho "Sem imagem anterior pra reverter. Rode: docker compose -f $DIR/docker-compose.yml logs --tail=150 app"
  fi
  exit 1
fi
