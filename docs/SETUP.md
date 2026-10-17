# Setup de desenvolvimento

```bash
git clone https://github.com/srkyler/tappo.git
cd tappo
npm install
cp .env.example .env.local   # preencha Supabase + o que for usar
npm run dev
```

Abre em `http://localhost:3000`.

## Banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com) (grátis).
2. Cole o conteúdo de `supabase/setup_completo.sql` no **SQL Editor** do projeto e rode (idempotente — pode rodar de novo sem medo).
3. Preencha no `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).

Depois de criar uma migration nova em `supabase/migrations/`, rode `npm run db:setup` pra regenerar o `setup_completo.sql` — nunca edite esse arquivo à mão.

## IA (opcional)

Sem nenhuma chave configurada, o CRM funciona normalmente — só o chat/atendimento automático fica desligado. Pra ligar: entre em `/admin` (seu e-mail precisa estar em `ADMIN_EMAILS` no `.env.local`) e cadastre um agente com a chave do provedor que preferir.

## WhatsApp (opcional, pra testar o canal)

Precisa de um servidor WAHA rodando (`docker compose up -d waha` usando o `docker-compose.yml` da raiz) e configurar a conexão em `/app/inbox`.

## Checklist antes de abrir PR

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Os três — ver `CLAUDE.md` pra entender por que `tsc` sozinho não é suficiente.
