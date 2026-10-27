# ============================================================
# TAPPO — Imagem de Produção Next.js 15 (Standalone)
# Otimizado para: cache de layers, segurança, healthcheck robusto
# ============================================================

# ---- STAGE 1: DEPENDÊNCIAS (cache máximo) ----
# WORKDIR NÃO pode ser /app: com o folder app/ dentro, o next@15.2.0 gera
# rotas/headers errados (colisão de paths /app/app/*).
FROM node:22-alpine AS deps
WORKDIR /srv/tappo

# libc6-compat necessário para alguns native modules (ex: sharp)
RUN apk add --no-cache libc6-compat

# Copia APENAS package files para maximizar cache
COPY package.json package-lock.json .npmrc* ./

# Não baixa Chromium do Puppeteer (só testes locais)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# npm ci = install exato do lockfile (reprodutível)
# --prefer-offline = usa cache local se possível
RUN npm ci --prefer-offline --no-audit --no-fund

# ---- STAGE 2: BUILD (rebuild só se fonte mudar) ----
FROM node:22-alpine AS build
WORKDIR /srv/tappo

# Reusa node_modules do stage deps (layer cached)
COPY --from=deps /srv/tappo/node_modules ./node_modules

# Copia código fonte
COPY . .

# Variáveis NEXT_PUBLIC_* entram no bundle do navegador
# ARG = build-time only (não ficam na imagem final)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# Variáveis de build (não runtime)
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build standalone (gera .next/standalone + .next/static)
RUN npm run build

# ---- STAGE 3: RUNTIME (imagem mínima) ----
FROM node:22-alpine AS run
WORKDIR /srv/tappo

# Hardening: usuário não-root, sem shell
RUN addgroup -S -g 1001 tappo && \
    adduser -S -u 1001 -G tappo -h /srv/tappo -s /sbin/nologin tappo

# Copia APENAS o necessário do build standalone
# --chown=tappo:tappo evita chown posterior
COPY --from=build --chown=tappo:tappo /srv/tappo/.next/standalone ./
COPY --from=build --chown=tappo:tappo /srv/tappo/.next/static ./.next/static
COPY --from=build --chown=tappo:tappo /srv/tappo/public ./public

# Variáveis de RUNTIME (podem vir do .env no docker-compose)
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

USER tappo
EXPOSE 3000

# Healthcheck robusto: testa endpoint público (/) não autenticado
# Usa node nativo (sem wget/curl) — imagem alpine não tem wget por padrão
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]