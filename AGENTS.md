# AGENTS.md — Guia de Coordenação de Agentes

> Leia este arquivo antes de tocar em qualquer código do Tappo.
> Ele evita conflitos entre agentes de IA trabalhando em paralelo.

## O que é o Tappo

SaaS B2B de prospecção comercial: base de leads, cadências, pipeline e analytics.
Stack: Next.js 16 (App Router) + Tailwind 4 + Supabase (auth + banco + RLS). Deploy: Vercel.
Produto em PT-BR. Identidade visual: "fichário de biblioteca" (ver `PRODUCT.md`).

## Agentes ativos e responsabilidades

| Agente | Responsabilidade |
|--------|-----------------|
| **Impeccable** | Design visual — landing page, componentes visuais, mocks (`.impeccable/`) |
| **Kiro** | Fundação de segurança — auth, Supabase clients, middleware, RLS |
| *(outros)* | Funcionalidades de produto — leads, campanhas, pipeline, analytics |

## Arquivos com dono fixo — não modifique sem coordenar

| Arquivo/Pasta | Dono | Motivo |
|---------------|------|--------|
| `.impeccable/` | Impeccable | Mocks e decisões de design |
| `PRODUCT.md` | Impeccable | Brief de produto |
| `proxy.ts` | Kiro | Middleware de autenticação de borda |
| `lib/supabase/` | Kiro | Clientes Supabase (server/browser/admin) |
| `lib/auth/` | Kiro | Guards de autenticação |
| `supabase/` | Kiro + time | Schema e migrações — coordenar antes de alterar |
| `.gitignore` | Kiro | Proteção de arquivos sensíveis |
| `SECURITY.md` | Kiro | Política de segurança |

## Arquivos livres para qualquer agente

- `app/` — páginas e componentes (exceto `proxy.ts`)
- `components/` — componentes reutilizáveis
- `public/` — assets estáticos
- `app/globals.css` — estilos globais

## Padrões de segurança obrigatórios

### Clientes Supabase — use sempre os clientes canônicos

```ts
// Em "use client" (browser):
import { createClient } from "@/lib/supabase/browser"

// Em Server Components / Route Handlers / Server Actions:
import { createClient } from "@/lib/supabase/server"

// Operações admin (bypassa RLS — só usar quando necessário):
import { createAdminClient } from "@/lib/supabase/admin"
```

### Proteger páginas autenticadas

```ts
// Em qualquer Server Component dentro de /app/*:
import { requireAuth } from "@/lib/auth/require-auth"

export default async function PaginaProtegida() {
  const user = await requireAuth() // redireciona para /login se não autenticado
  // ...
}
```

### RLS em toda tabela nova

```sql
-- Obrigatório em TODA nova migration com dados de usuário:
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_somente_seus_dados"
  ON nova_tabela FOR ALL
  USING (auth.uid() = user_id);
```

## O que NUNCA fazer

- Importar `lib/supabase/admin.ts` em componentes `"use client"`
- Usar `getSession()` no server — sempre `getUser()`
- Criar tabela no banco sem RLS
- Commitar `.env.local` ou qualquer arquivo com chaves reais
- Usar `console.log()` com variáveis de ambiente secretas

## Estrutura de pastas atual

```
tappo/
  app/              ← páginas Next.js (App Router)
  lib/
    supabase/       ← clientes Supabase (browser / server / admin)
    auth/           ← guards de autenticação
  supabase/         ← schema SQL e migrações
  public/           ← assets estáticos
  proxy.ts          ← middleware Next.js 16
  .env.example      ← template de variáveis (sem valores reais)
  SECURITY.md       ← política de segurança completa
  PRODUCT.md        ← brief de produto e stack
  AGENTS.md         ← este arquivo
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
