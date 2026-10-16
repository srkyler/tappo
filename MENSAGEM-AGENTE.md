# MENSAGEM-AGENTE.md
> Arquivo de comunicação entre agentes de IA trabalhando no Tappo.
> Kiro monitora este arquivo. Escreva sua mensagem abaixo e o Kiro responderá.

---

## Status atual do projeto (Kiro · 15 Out 2026 · 11h00)

Olá! Sou o **Kiro** — responsável pela fundação de segurança e construção das páginas do Tappo.

### O que já foi feito por mim:

**Segurança:**
- `.gitignore` — protege `.env.local`
- `.env.example` — template documentado
- `lib/supabase/browser.ts` — cliente browser (anon key)
- `lib/supabase/server.ts` — cliente server (com refresh de cookie)
- `lib/supabase/admin.ts` — cliente admin (service role, server-only)
- `lib/auth/require-auth.ts` — guard `requireAuth()` e `getOptionalUser()`
- `proxy.ts` — middleware Next.js 16 (refresh de sessão + proteção de rotas)
- `SECURITY.md` — política de segurança e rotação de chaves
- `supabase/README.md` — instruções de RLS

**Páginas construídas:**
- `app/page.tsx` — landing page completa (baseada no comp-a aprovado)
- `app/login/page.tsx` — login mock funcional
- `app/signup/page.tsx` — cadastro mock funcional
- `app/auth/callback/route.ts` — callback OAuth
- `app/app/layout.tsx` — layout autenticado com sidebar
- `app/app/page.tsx` — dashboard com KPIs e atividade recente
- `app/app/leads/page.tsx` — módulo de leads (tabela, filtros, carimbos)
- `app/app/campanhas/page.tsx` — módulo de campanhas (cadências expansíveis)
- `app/app/pipeline/page.tsx` — kanban com drag entre etapas
- `app/app/analytics/page.tsx` — métricas com gráficos CSS

**Componentes:**
- `components/tappo.tsx` — `Carimbo`, `Placa`, `FichaCard`, `GavetaHeader`, `SeloCTA`

### Arquivos que são meus (não modifique sem combinar):
- `proxy.ts`, `lib/supabase/`, `lib/auth/`, `SECURITY.md`

### Arquivos livres para você trabalhar:
- `app/` (qualquer página), `components/`, `public/`, `globals.css`

### Pendente (pode pegar):
- Schema SQL do Supabase em `supabase/migrations/`
- Integração real com Supabase (remover mocks quando as chaves chegarem)
- Página de perfil do usuário `/app/perfil`

---

## Mensagens dos outros agentes:

> *(escreva aqui sua mensagem para o Kiro — ele verifica este arquivo regularmente)*

