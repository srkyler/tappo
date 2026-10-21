# 🚀 Instalação do Zero - Tappo na VPS (Ubuntu 22.04/24.04/26.04)

---

## 1. Preparar VPS (como root)

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar dependências base
apt install -y git curl wget gnupg2 software-properties-common ufw fail2ban

# Configurar firewall (antes de habilitar!)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy)
ufw allow 443/tcp   # HTTPS (Caddy)
ufw allow 443/udp   # HTTP/3 (Caddy)
ufw --force enable

# Configurar fail2ban para SSH
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF
systemctl restart fail2ban
```

---

## 2. Instalar Docker + Docker Compose Plugin

```bash
# Remover versões antigas se houver
apt remove -y docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc 2>/dev/null || true

# Instalar Docker oficial
curl -fsSL https://get.docker.com | sh

# Adicionar usuário ao grupo docker (use seu usuário, não root)
usermod -aG docker $USER
# IMPORTANT: Saia e entre novamente no SSH para aplicar o grupo
# exit
# ssh usuario@ip
```

---

## 3. Configurar Swap (se VPS tem pouca RAM - ex: 1-2GB)

```bash
# Criar 2GB de swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verificar
free -h
```

---

## 4. Clonar Repositório

```bash
# Como usuário NÃO-ROOT (ex: ubuntu, deploy, seu-usuario)
cd /home/$USER

# Clone via HTTPS (precisa token) ou SSH (recomendado)
# HTTPS:
git clone https://github.com/srkyler/tappo.git
# OU SSH (configure chave antes):
# git clone git@github.com:srkyler/tappo.git

cd tappo
```

---

## 5. Configurar DNS (FAÇA ANTES DE SUBIR)

No seu provedor de DNS (Cloudflare, Route53, GoDaddy, etc), crie **2 registros A**:

| Tipo | Nome | Valor | Proxy |
|------|------|-------|-------|
| A | @ | IP_DA_VPS | ❌ (DNS only) |
| A | waha | IP_DA_VPS | ❌ (DNS only) |

> **Importante**: Desative proxy/CDN (nuvem laranja no Cloudflare) para o Caddy emitir certificados Let's Encrypt direto.

Teste:
```bash
dig +short seu-dominio.com
dig +short waha.seu-dominio.com
# Ambos devem retornar o IP da VPS
```

---

## 6. Configurar Variáveis de Ambiente

```bash
cd /home/$USER/tappo

# Copiar template
cp .env.example .env

# Editar com SUAS chaves REAIS
nano .env
```

**Mínimo obrigatório no `.env`:**

```env
# ===== NEXT.JS / SUPABASE (PÚBLICOS - vão no bundle do navegador) =====
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (chave anon do Supabase)
NEXT_PUBLIC_APP_URL=https://seu-dominio.com

# ===== SUPABASE ADMIN (SECRETO - só server-side) =====
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service role key do Supabase)

# ===== RESEND EMAIL (SECRETO) =====
RESEND_API_KEY=re_... (chave da Resend)
RESEND_FROM="Tappo <onboarding@resend.dev>"

# ===== WAHA WHATSAPP =====
WAHA_API_KEY=chave-forte-aleatoria-aqui
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=senha-forte-aqui
WAHA_ENGINE=WEBJS

# ===== DOMÍNIOS (para Caddy) =====
DOMAIN=seu-dominio.com
WAHA_DOMAIN=waha.seu-dominio.com
```

> **NUNCA** commite o `.env` real. O `.gitignore` já bloqueia.

---

## 7. Preparar Supabase (uma vez)

No painel do Supabase (https://supabase.com/dashboard):

1. **SQL Editor** → Execute o arquivo `supabase/setup_completo.sql` (ou as migrations em ordem)
2. **Authentication** → Settings → Site URL: `https://seu-dominio.com`
3. **Authentication** → Settings → Redirect URLs: adicione `https://seu-dominio.com/auth/callback`
4. **Storage** → Crie bucket `avatars` (público) se não existir

---

## 8. Build e Subida Inicial

```bash
cd /home/$USER/tappo

# Limpar cache Docker antigo (se houver)
docker builder prune -af

# Build COMPLETO (primeira vez - demora 3-8 min)
docker compose build --no-cache

# Subir tudo em background
docker compose up -d

# Acompanhar logs do app
docker compose logs -f app
```

**Aguarde**: 
- `Ready in XXXms` nos logs do app
- Healthcheck `healthy` no `docker compose ps`

---

## 9. Validar Deploy

```bash
# 1. App responde (healthcheck)
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com
# → 200

# 2. Healthcheck Docker
docker inspect --format='{{.State.Health.Status}}' tappo-app-1
# → healthy

# 3. Static assets
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com/_next/static/css/app/layout.css
# → 200

# 4. Rotas protegidas redirecionam
curl -s -o /dev/null -w "%{http_code}" https://seu-dominio.com/app
# → 307 (redirect para /login)

# 5. WAHA acessível
curl -s -o /dev/null -w "%{http_code}" https://waha.seu-dominio.com
# → 200

# 6. Logs sem erros
docker compose logs --tail=50 app | grep -i error
# → vazio ou só warnings conhecidos
```

---

## 10. Configurar WAHA (WhatsApp)

1. Acesse: `https://waha.seu-dominio.com`
2. Login: `admin` / `WAHA_DASHBOARD_PASSWORD` (do .env)
3. **Sessions** → `default` → **Start**
4. Escaneie QR Code com WhatsApp do celular
5. Teste: **API** → `POST /api/sendText` → envie para seu número

---

## 11. Primeiro Login no Tappo

1. Acesse: `https://seu-dominio.com`
2. Clique em "Criar conta" ou "Login"
3. Use email configurado no Supabase
4. Confirme email (cheque spam / Resend logs)
5. Após login: já entra no `/app`

---

## 12. Deploy de Atualizações (Dia a Dia)

```bash
cd /home/$USER/tappo

# 1. Pegar mudanças
git pull origin main

# 2. Se mudou package.json / Dockerfile / docker-compose.yml:
docker compose build --no-cache
docker compose up -d

# 3. Se só código (mais rápido - zero downtime pro waha/caddy):
docker compose build --no-cache app
docker compose up -d --no-deps app

# 4. Verificar
docker compose logs -f app
docker compose ps
```

---

## 13. Rollback Rápido (se der ruim)

```bash
cd /home/$USER/tappo

# Ver últimos commits
git log --oneline -10

# Voltar 1 commit
git checkout HEAD~1
docker compose build --no-cache app
docker compose up -d --no-deps app

# Voltar ao latest
git checkout main
docker compose build --no-cache app
docker compose up -d --no-deps app
```

---

## 14. Backup (Opcional mas Recomendado)

```bash
# Criar script de backup
cat > /home/$USER/backup-tappo.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/home/$USER/backups"
mkdir -p $BACKUP_DIR

# Backup .env
cp /home/$USER/tappo/.env $BACKUP_DIR/env-$DATE.backup

# Backup volumes Docker (WAHA sessions)
docker run --rm -v tappo_waha_sessions:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/waha-sessions-$DATE.tar.gz -C /data .

# Manter só últimos 7 dias
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup concluído: $DATE"
EOF
chmod +x /home/$USER/backup-tappo.sh

# Adicionar no cron (diário 3h)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/$USER/backup-tappo.sh") | crontab -
```

---

## 15. Monitoramento Básico

```bash
# Ver uso de recursos
docker stats --no-stream

# Ver logs em tempo real
docker compose logs -f app

# Ver logs Caddy (certificados)
docker compose logs -f caddy

# Ver logs WAHA
docker compose logs -f waha

# Limpar logs Docker antigos (evita encher disco)
docker system prune -f --volumes
```

---

## 16. Checklist Pós-Instalação

- [ ] VPS com swap configurado
- [ ] Docker + Compose instalados
- [ ] UFW: 22, 80, 443, 443/udp abertos
- [ ] Fail2ban ativo no SSH
- [ ] DNS A records apontando para IP (sem proxy)
- [ ] `.env` preenchido com chaves REAIS
- [ ] Supabase migrations executadas
- [ ] Supabase Auth URLs configuradas
- [ ] `docker compose up -d` rodando 3 containers healthy
- [ ] HTTPS funcionando (certificado Let's Encrypt emitido)
- [ ] WAHA conectado ao WhatsApp (QR code escaneado)
- [ ] Login no Tappo funcionando
- [ ] Backup script no cron

---

## 17. Comandos Úteis Rápidos

| Ação | Comando |
|------|---------|
| Ver status | `docker compose ps` |
| Logs app | `docker compose logs -f app` |
| Logs Caddy | `docker compose logs -f caddy` |
| Logs WAHA | `docker compose logs -f waha` |
| Restart app | `docker compose restart app` |
| Restart tudo | `docker compose restart` |
| Parar tudo | `docker compose down` |
| Parar + volumes | `docker compose down -v` |
| Rebuild tudo | `docker compose build --no-cache && docker compose up -d` |
| Entrar no container | `docker compose exec app sh` |
| Ver variáveis | `docker compose exec app env | sort` |
| Testar build local | `docker compose build app` |
| Ver uso disco | `df -h` |
| Ver uso RAM | `free -h` |

---

## 18. Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| `docker compose build` falha no `npm ci` | Aumente swap ou RAM da VPS |
| Caddy não emite certificado | DNS não propagado / porta 80 bloqueada / proxy CDN ativo |
| WAHA não conecta | Verifique `docker compose logs waha` / reinicie container |
| Healthcheck unhealthy | `docker compose logs app` / verifique se porta 3000 responde |
| `Module not found` no build | `docker builder prune -af` e rebuild |
| Permissão negada em volumes | `sudo chown -R 1001:1001 /caminho/volume` |
| Build muito lento | VPS com pouca CPU/RAM - considere upgrade |

---

## 19. Estrutura Final na VPS

```
/home/usuario/
├── tappo/                    # Repositório clonado
│   ├── .env                  # SUAS variáveis (NÃO versionado)
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── Caddyfile
│   └── ... (código)
├── backups/                  # Backups automáticos
└── swapfile                  # Se criou swap
```

---

**Pronto!** Sua instância Tappo está rodando em produção com:
- ✅ HTTPS automático (Caddy + Let's Encrypt)
- ✅ WhatsApp via WAHA
- ✅ Banco Supabase com RLS
- ✅ Emails via Resend
- ✅ Deploy zero-downtime
- ✅ Backups automáticos
- ✅ Firewall + Fail2ban

---

**Última atualização**: 2026-10-19  
**Testado em**: Ubuntu 22.04/24.04/26.04, Docker 24+, Next.js 15.2