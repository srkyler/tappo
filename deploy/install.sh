#!/usr/bin/env bash
# Instala o Tappo numa VPS Ubuntu/Debian limpa.
# Uso (como root):  curl -fsSL https://raw.githubusercontent.com/<usuario>/<repo>/main/deploy/install.sh | bash -s -- <url-do-repo>
#            ou:    bash deploy/install.sh https://github.com/<usuario>/<repo>.git
set -euo pipefail

REPO="${1:-}"
DIR="${TAPPO_DIR:-/opt/tappo}"

if [ "$(id -u)" -ne 0 ]; then echo "Rode como root (sudo -i)."; exit 1; fi

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> Firewall (22, 80, 443)"
if command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

echo "==> Código em $DIR"
apt-get install -y git >/dev/null 2>&1 || true
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  [ -n "$REPO" ] || { echo "Informe a URL do repositório: bash install.sh https://github.com/usuario/repo.git"; exit 1; }
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^AI_KEYS_SECRET=.*|AI_KEYS_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')|" .env
  sed -i "s|^WAHA_API_KEY=.*|WAHA_API_KEY=$(openssl rand -hex 24)|" .env
  sed -i "s|^WAHA_DASHBOARD_PASSWORD=.*|WAHA_DASHBOARD_PASSWORD=$(openssl rand -hex 12)|" .env
  chmod 600 .env
  echo
  echo "!! Criei $DIR/.env com segredos gerados. Preencha DOMAIN, Supabase, ANTHROPIC_API_KEY etc.:"
  echo "   nano $DIR/.env"
  echo "   depois rode: cd $DIR && docker compose up -d --build"
  exit 0
fi

echo "==> Subindo containers"
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
echo "Pronto. Acesse https://$(grep -E '^DOMAIN=' .env | cut -d= -f2)"
