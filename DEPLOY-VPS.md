# 🚀 Guia Completo: Deploy Tappo na VPS (Next.js 15 + Docker + Caddy)

---

## 📋 Pré-requisitos na VPS

| Item | Versão Mínima | Comando para Verificar |
|------|---------------|------------------------|
| Ubuntu/Debian | 22.04+ | `lsb_release -a` |
| Docker Engine | 24+ | `docker --version` |
| Docker Compose | v2+ (plugin) | `docker compose version` |
| Git | 2.30+ | `git --version` |
| OpenSSL | 3.0+ | `openssl version` |

### Instalação Rápida (Ubuntu 22.04/24.04)

```bash
# Atualiza sistema
sudo apt update && sudo apt upgrade -y

# Instala Docker (oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker  # ou reconecte SSH

# Instala Docker Compose plugin (já vem no get.docker.com)
docker compose version

# Instala Git
sudo apt install -y git
```

---

## 🔐 1. Preparação do Repositório (Local)

### 1.1 Commit das correções já aplicadas

```bash
cd /caminho/do/tappo

# Verifica status
git status

# Deve mostrar apenas arquivos modificados/novos:
# - Dockerfile
# - docker-compose.yml
# - Caddyfile
# - .gitattributes
# - app/permissoes/_client.tsx
# - package-lock.json (atualizado resend)

git add -A
git commit -m "fix: deploy fixes - flatten app/, repair _client.tsx, update resend lockfile, optimize Dockerfile, add Caddyfile"
git push origin main
```

### 1.2 Verifique se `.env.example` está completo

```bash
cat .env.example
```

Deve conter (mínimo):
```env
# Next.js / Supabase (PÚBLICOS - vão no bundle do navegador)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://seu-dominio.com

# Supabase Admin (SECRETO - só server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Resend (SECRETO)
RESEND_API_KEY=re_...
RESEND_FROM="Tappo <onboarding@resend.dev>"

# WAHA (WhatsApp)
WAHA_API_KEY=chave-forte-aqui
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=senha-forte-aqui
WAHA_ENGINE=WEBJS

# Domínios (para Caddy)
DOMAIN=seu-dominio.com
WAHA_DOMAIN=waha.seu-dominio.com
```

---

## 🖥️ 2. Setup Inicial na VPS (Primeira Vez)

### 2.1 Clone do repositório

```bash
# Entre como usuário não-root (ex: ubuntu, deploy, etc)
cd /home/$USER

# Clone
git clone https://github.com/SEU_USUARIO/tappo.git
cd tappo
```

### 2.2 Configure variáveis de ambiente

```bash
# Copia template
cp .env.example .env

# EDITE com suas chaves REAIS
nano .env
# ou: vim .env

# ⚠️ IMPORTANTE:
# - NUNCA commite .env real
# - USE chaves de PRODUÇÃO (não dev)
# - DOMAIN deve apontar para o IP da VPS (A record)
```

### 2.3 Verifique DNS (antes de subir)

```bash
# No terminal LOCAL (seu PC), teste:
dig +short seu-dominio.com
dig +short waha.seu-dominio.com

# Ambos devem retornar o IP da VPS
# Se não, configure no painel DNS do seu provedor (Cloudflare, Route53, etc)
```

### 2.4 Build e Subida Inicial

```bash
# Na VPS, dentro de /home/$USER/tappo

# Limpa cache Docker antigo (se houver)
docker builder prune -af

# Build completo (demora ~2-5 min na primeira vez)
docker compose build --no-cache

# Sobe tudo em background
docker compose up -d

# Acompanha logs
docker compose logs -f app
```

### 2.5 Aguarde o Healthcheck

```bash
# Verifica status dos containers
docker compose ps

# Deve mostrar:
# NAME                STATUS
# tappo-app-1         Up X minutes (healthy)
# tappo-waha-1        Up X minutes
# tappo-caddy-1       Up X minutes

# Teste HTTPS (Caddy emite certificado automático via Let's Encrypt)
curl -I https://seu-dominio.com
# → HTTP/2 200  (pode demorar 30-60s na primeira vez)
```

---

## 🔄 3. Deploy Atualizações (Pós Primeira Vez)

### 3.1 Deploy Rápido (Código Mudou)

```bash
# Na VPS
cd /home/$USER/tappo

# 1. Pega mudanças
git pull origin main

# 2. Rebuild APENAS do app (cache de deps preservado)
docker compose build --no-cache app

# 3. Restart APENAS do app (zero-downtime para waha/caddy)
docker compose up -d --no-deps app

# 4. Verifica
docker compose logs -f app
docker compose ps
```

### 3.2 Deploy Completo (Dockerfile/Compose Mudou)

```bash
# Se mexeu em Dockerfile, docker-compose.yml, ou package.json
cd /home/$USER/tappo
git pull
docker compose build --no-cache
docker compose up -d
```

### 3.3 Rollback Rápido

```bash
# Volta commit anterior
cd /home/$USER/tappo
git log --oneline -5
git checkout HEAD~1  # ou hash específico
docker compose build --no-cache app
docker compose up -d --no-deps app

# Para voltar ao latest:
git checkout main
docker compose build --no-cache app
docker compose up -d --no-deps app
```

---

## ✅ 4. Validação Pós-Deploy (Smoke Tests)

Execute **sempre** após deploy:

```bash
# 1. App responde (healthcheck endpoint)
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com
# → 200

# 2. Healthcheck Docker passing
docker inspect --format='{{.State.Health.Status}}' tappo-app-1
# → healthy

# 3. Static assets servidos pelo Next.js
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com/_next/static/css/app/layout.css
# → 200

# 4. Rotas protegidas redirecionam para login
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com/app
# → 307 (redirect para /login)

# 5. WAHA acessível
curl -s -o /dev/null -w "%{http_code}" https://waha.seu-dominio.com
# → 200

# 6. Logs sem erros críticos
docker compose logs --tail=50 app | grep -i error
# → vazio ou só warnings conhecidos
```

---

## 🛠️ 5. Comandos Úteis no Dia a Dia

| Ação | Comando |
|------|---------|
| Ver logs app | `docker compose logs -f app` |
| Ver logs Caddy | `docker compose logs -f caddy` |
| Ver logs WAHA | `docker compose logs -f waha` |
| Restart app | `docker compose restart app` |
| Restart tudo | `docker compose restart` |
| Parar tudo | `docker compose down` |
| Parar + remover volumes | `docker compose down -v` |
| Ver uso recursos | `docker stats` |
| Entrar no container app | `docker compose exec app sh` |
| Ver variáveis no container | `docker compose exec app env | sort` |
| Testar build local | `docker compose build app` |

---

## 🔧 6. Troubleshooting Comum

### Build falha: `Module not found: Can't resolve 'resend'`

```bash
# Lockfile desatualizado
cd /home/$USER/tappo
git pull
npm install resend@latest --save
git add package-lock.json
git commit -m "chore: update resend lockfile"
git push

# Na VPS:
git pull
docker compose build --no-cache app
docker compose up -d --no-deps app
```

### Healthcheck falha (unhealthy)

```bash
# Testa endpoint manualmente
docker compose exec app node -e "require('http').get('http://127.0.0.1:3000/', (r) => {console.log(r.statusCode)})"

# Se 200 mas healthcheck falha: aumente start-period no Dockerfile
# Se não 200: veja logs do app
docker compose logs app
```

### Caddy não emite certificado

```bash
# Verifica logs Caddy
docker compose logs caddy

# Causas comuns:
# 1. DNS não propagado → aguarde (até 48h, costuma ser minutos)
# 2. Porta 80/443 bloqueada no firewall/cloud → libere na VPS e no provedor
# 3. DOMAIN errado no .env → corrija e: docker compose restart caddy
```

### WAHA não conecta WhatsApp

```bash
# 1. Verifica se WAHA está saudável
curl http://localhost:3000/api/__health  # dentro da VPS

# 2. Dashboard WAHA
# Acesse: https://waha.seu-dominio.com
# Login: admin / WAHA_DASHBOARD_PASSWORD

# 3. Scan QR Code no dashboard
# 4. Teste envio: POST /api/sendText
```

### Erro de permissão / EACCES

```bash
# Usuário non-root no container (UID 1001)
# Se volumes externos: chown 1001:1001 no host
sudo chown -R 1001:1001 /caminho/volume/host
```

---

## 📊 7. Monitoramento Básico

### Logs centralizados (opcional - Loki/Grafana)

```yaml
# Adicione no docker-compose.yml em cada service:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Alertas de disco

```bash
# Cron diário (crontab -e)
0 6 * * * df -h / | awk 'NR==2 {if ($5+0 > 80) print "DISCO CRÍTICO: " $5}' | mail -s "Alerta Disco VPS" admin@dominio.com
```

### Backup Supabase (automático via Supabase Dashboard)
- Settings → Database → Backups → Enable Point-in-Time Recovery

---

## 🔒 8. Checklist de Segurança Pós-Deploy

- [ ] `.env` NÃO versionado (verifique `git status`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` só no servidor (nunca `NEXT_PUBLIC_`)
- [ ] `RESEND_API_KEY` só no servidor
- [ ] RLS habilitado em TODAS tabelas Supabase
- [ ] Caddy headers de segurança ativos (HSTS, CSP, etc)
- [ ] UFW/firewall: só 80, 443, 22 (SSH) abertos
- [ ] Fail2ban configurado para SSH
- [ ] Updates automáticos de segurança: `sudo apt install unattended-upgrades`
- [ ] Backup do `.env` em local seguro (1Password, Bitwarden, etc)

---

## 📁 9. Estrutura Final de Arquivos (Referência)

```
tappo/
├── app/                    # Next.js App Router (raiz correta)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   ├── app/                # ← NÃO DEVE EXISTIR (já corrigido)
│   ├── enriquecimento/
│   ├── permissoes/
│   │   ├── page.tsx
│   │   └── _client.tsx     # ← CORRIGIDO
│   └── ... (outras rotas)
├── lib/
│   ├── supabase/
│   ├── email/
│   │   ├── atendimento.ts
│   │   └── resend.ts
│   └── ...
├── components/
├── public/
├── supabase/
├── Dockerfile              # ← OTIMIZADO
├── docker-compose.yml      # ← COM LIMITS/LOGGING
├── Caddyfile               # ← HTTPS AUTO + HEADERS
├── .gitattributes          # ← LF FORÇADO
├── .dockerignore
├── .env.example
├── next.config.ts
├── package.json
├── package-lock.json       # ← ATUALIZADO (resend)
├── tsconfig.json
└── DEPLOY-VPS.md           # ← ESTE ARQUIVO
```

---

## 🆘 10. Contato / Suporte

Se algo não funcionar:

1. **Logs completos**: `docker compose logs app > app-logs.txt`
2. **Versões**: `docker compose exec app node --version && docker compose exec app npm --version`
3. **Env sanitizado**: `docker compose exec app env | grep -v KEY | grep -v SECRET | sort`
4. **Abra issue** no repositório com os itens acima

---

**Última atualização**: 2026-10-18  
**Versão do guia**: 1.0  
**Testado em**: Ubuntu 22.04/24.04, Docker 24+, Next.js 15.2