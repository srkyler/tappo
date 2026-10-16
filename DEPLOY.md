# Deploy na VPS (Docker + GitHub Actions)

Stack na VPS: **app** (Next.js) + **waha** (WhatsApp) + **caddy** (HTTPS automático). O banco continua no Supabase.

## 1. Pré-requisitos
- VPS Ubuntu 22.04+ com 2 GB de RAM ou mais (o WAHA com WEBJS usa Chromium).
- DNS: registros `A` de `crm.suaempresa.com` e `waha.suaempresa.com` apontando para o IP da VPS.

## 2. Instalar (uma vez)
```bash
ssh root@IP_DA_VPS
git clone https://github.com/srkyler/tappo.git /opt/tappo   # repo privado: use um deploy key ou token
bash /opt/tappo/deploy/install.sh
nano /opt/tappo/.env            # preencha DOMAIN, Supabase, ANTHROPIC_API_KEY, ADMIN_EMAILS…
cd /opt/tappo && docker compose up -d --build
```
O script instala o Docker, libera as portas 80/443 e gera `AI_KEYS_SECRET`, `WAHA_API_KEY` e a senha do painel do WAHA.

## 3. Deploy automático a cada push
No GitHub: **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP ou domínio da VPS |
| `VPS_USER` | usuário SSH (ex.: `root`) |
| `VPS_SSH_KEY` | chave **privada** cujo `.pub` está em `~/.ssh/authorized_keys` na VPS |
| `VPS_PORT` | opcional (padrão 22) |

Gerar a chave: `ssh-keygen -t ed25519 -f tappo_deploy -N ""` e depois `ssh-copy-id -i tappo_deploy.pub root@IP`.

Cada push na `main` roda typecheck + lint e, se passar, faz `git reset --hard origin/main && docker compose up -d --build` na VPS.

## 4. Conectar o WhatsApp
No app: **Inbox → ⚙️**
- URL do WAHA: `http://waha:3000` (rede interna do Docker)
- API key: o `WAHA_API_KEY` do `.env`
- Clique em **Conectar** e escaneie o QR code.

## 5. Banco (Supabase)
Migrações em `supabase/migrations/`. Depois de criar uma nova: `npm run db:setup` e rode `supabase/setup_completo.sql` no SQL Editor (é idempotente).

## Comandos úteis na VPS
```bash
cd /opt/tappo
docker compose logs -f app       # logs do app
docker compose logs -f waha      # logs do WhatsApp
docker compose restart app
docker compose pull waha && docker compose up -d waha   # atualizar o WAHA
```
