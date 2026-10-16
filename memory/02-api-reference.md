# Tappo SaaS - API Reference & Routes

## Base URL
- **Development:** `http://localhost:3000`
- **Production:** `https://tappo.vercel.app`

## Authentication (Supabase)

### Client Setup

**Browser (Client Components):**
```typescript
import { createClient } from '@/lib/supabase/browser'
const supabase = createClient()
```

**Server Components / Route Handlers / Server Actions:**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = createClient()
```

**Admin (bypasses RLS - only when necessary):**
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
```

### Auth Guards

```typescript
import { requireAuth } from '@/lib/auth/require-auth'

export default async function PaginaProtegida() {
  const user = await requireAuth() // redireciona para /login se não autenticado
  // ...
}
```

### Session Management

```typescript
// GET session (deprecated - use getUser)
const { data: { session} } = await supabase.auth.getSession()

// GET user (recommended)
const { data: { user} } = await supabase.auth.getUser()

// Sign in with magic link
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: '/auth/callback' }
})
```

---

## Routes & Pages

### Public Routes (no auth required)
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing page | "Tappo - fichário de prospecção" with hero, drawers, counters, synthetic data demo |
| `/login` | Login page | Email/password sign in, magic links |
| `/register` | Register page | New user sign up |

### Protected Routes (auth required)
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | Dashboard layout | Protected by `requireAuth()` |
| `/dashboard/leads` | Leads management | List, import, filter leads |
| `/dashboard/campaigns` | Campaigns/cadences | Create/manage cadences |
| `/dashboard/pipeline` | Pipeline | Deal pipeline stages |
| `/dashboard/analytics` | Analytics | Weekly metrics view |

### Authentication Callbacks
| Route | Description |
|-------|-----------|
| `/auth/callback` | OAuth callback (Google, etc.) |

---

## Lead Management (CRUD)

### Leads Table (Supabase)
| Column | Type | RLS Policy | Description |
|--------|------|------------|-------------|
| id | uuid | `auth.uid() = owner_id` | PK |
| name | text | - | Lead name (e.g., "HELENA DUARTE") |
| role | text | - | Role (e.g., "Diretora de Compras") |
| company | text | - | Company (e.g., "Indústria Moreno") |
| external_id | text | - | External ID (e.g., "GAR-0241") |
| status | text | - | Status (CONTACTED, MEETING, QUALIFIED, NEW) |
| last_contact | timestamptz | - | Last contact date |
| created_at | timestamptz | default: now() | |
| owner_id | uuid | `auth.uid()` | User who owns this lead |

### Lead Creation
```typescript
// Server Component or Server Action
const { data, error } = await supabase
  .from('leads')
  .insert([{ name, role, company, external_id, status: 'NEW', owner_id: user.id }])
  .select()
```

### Lead List with Filters
```typescript
// Query leads with filters
const { data: leads, error, count } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: 10 })
  .eq('owner_id', user.id)
  .eq('status', filterStatus)
  .order('created_at', { ascending: false })
```

### Lead Status Transitions
| From → To | Description |
|-----------|-------------|
| NEW → CONTACTED | Lead was contacted |
| CONTACTED → QUALIFIED | Lead qualified for outreach |
| QUALIFIED → MEETING | Meeting scheduled |
| MEETING → CONTACTED | Cycle continues |

---

### Campaigns / Cadences

#### Campaigns Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | Campaign name (e.g., "GAVETA 01/24") |
| description | text | Description |
| sequence | json[] | Cadence sequence (emails, touches, timing) |
| status | text | DRAFT, ACTIVE, PAUSED, COMPLETED |
| created_at | timestamptz | default: now() |
| owner_id | uuid | User who owns this campaign |

#### Campaign Sequence Example
```json
[
  { "type": "email", "day": 0, "content": "Email de introduction", "sent_at": null },
  { "type": "linkedin", "day": 3, "content": "Connect request", "sent_at": null },
  { "type": "email", "day": 7, "content": "Follow-up 1", "sent_at": null },
  { "type": "whatsapp", "day": 10, "content": "WhatsApp follow-up", "sent_at": null },
  { "type": "email", "day": 14, "content": "Final follow-up", "sent_at": null }
]
```

---

### Pipeline / Deal Pipeline

#### Pipeline Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | Pipeline name (e.g., "Pipeline Principal") |
| stages | json[] | Stage definitions with order |
| status | text | ACTIVE, ARCHIVED |
| created_at | timestamptz | default: now() |
| owner_id | uuid | User who owns this pipeline |

#### Pipeline Stages Example
```json
[
  { "name": "Prospecting", "order": 1, "win_probability": 10 },
  { "name": "Qualification", "order": 2, "win_probability": 30 },
  { "name": "Proposal", "order": 3, "win_probability": 50 },
  { "name": "Negotiation", "order": 4, "win_probability": 70 },
  { "name": "Closed Won", "order": 5, "win_probability": 100 },
  { "name": "Closed Lost", "order": 6 }
]
```

#### Moving a Deal
```typescript
// Update deal stage
const { data, error } = await supabase
  .from('pipeline_deals')
  .update({ stage_order: 3, updated_at: new Date() })
  .eq('id', dealId)
  .eq('owner_id', user.id)
```

---

## Design System Integration (.impeccable)

### Using Design Tokens in Tailwind

The `.impeccable` folder defines design tokens that should be integrated into the Tailwind config:

```css
/* app/globals.css - extract tokens from spec.json */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Example: Using design tokens */
.bg-nogueira { background-color: #291e15; } /* Dark nogueira */
.bg-latão { background-color: #c5b9a9; } /* Brass */
.ficha-creme { background-color: #f5e6d6; } /* Aged cream file */
.carimbo-carmim { color: #98723f; } /* Carmine stamp */
.tinta-azul { color: #584828; } /* Blue ink */

/* Typography tokens from spec */
.font-courier-prime { font-family: "Courier Prime"; }
.font-literata { font-family: "Literata"; }

.cap-height-66px { cap-height: 66px; }
.all-caps { text-transform: uppercase; }
.tracked { letter-spacing: 0.15em; }
```

### Component Examples from Mocks

**Hero Section (from comp-a - approved):**
- Background: nogueira (#291e15)
- Kicker: "FICHÁRIO DE PROSPECÇÃO · GAVETA 01/24" in latão
- Headline: "Toda empresa tem un garimpo." - Courier Prime Bold, 66px, tracked
- Sub-paragraph: Literata, 3 lines, creme on nogueira
- CTA: Carimado "ABRIER MEU FICHÁRIO" in carmim with double border
- Counters: 3 plates showing leads/campaigns/meetings stats
- Demo note: "PLACA DE DEMONSTRAÇÃO — DADOS SINTÉTICOS"

**Drawer/Files (from spec.json regions):**
- Drawer-shell: gaveta nogueira + moldura latão, puxador central, rótulo GAVETA 03
- Ficha pautada structure: name/role/comp/ carimbo color-coded status
- Leque de fichas emerging from drawer

---

## Security & RLS Policies

### Mandatory RLS on All New Tables

```sql
-- 1. Enable RLS
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

-- 2. Create policy that ties data to authenticated user
CREATE POLY "users_ve_somente_su_dados"
  ON nome_tabela FOR ALL
  USING (auth.uid() = user_id);
  
-- 3. For organization-level access:
CREATE POLICY "org_members_acess"
  ON nome_tabela FOR ALL
  USING (auth.uid() = ANY (SELECT user_id FROM organization_members WHERE org_id = organizations.id));
```

### Security Checklist
- [ ] All tables have RLS enabled
- [ ] All policies use `auth.uid()` for owner-based access
- [ ] No `SELECT *` without RLS filter
- [ ] `.env.local` never committed (gitignore protects it)
- [ ] Admin client only used when absolutely necessary
- [ ] Row-level security tested with different user roles
- [ ] Service role used only in edge functions, not browser

---

## Data Synthetic Labeling

All demonstration data must be labeled:

```typescript
// Example in component
<Text>
  PLACA DE DEMONSTRACIÓN — DADOS SINTÉTICOS
</Text>

// Or as a badge component
<Badge className="bg-creme text-carmim text-xs font-bold">
  Dados Sintéticos
</Badge>
```

**Rules:**
1. Never pass synthetic data as real user data
2. Always label with "PLACA DE DEMONSTRAÇÃN — DADOS SINTÉTICOS"
3. In production, show empty state or real data only
4. Demo data used only in landing/app shell, not real transactions

---

## Performance & Optimization

### Next.js 16 Config (next.config.ts)
```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,        // Cache React components
  partialPrefetching: true,     // Partial prefetching for navigation
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}
```

### Image Optimization
- Use Next.js `<Image>` with `loading="lazy"`
- Optimize assets from `.impeccable/build/` for web
- Use WebP/PNG conversion for mockup images

### Bundle Analysis
```bash
npm run build && npx source-strip-bundle analyze
```

---

## Error Handling & Borders

### Common Error Patterns

| Error | HTTP | Message | Solution |
|-------|------|---------|----------|
| Auth error | 401 | "Not authenticated" | Redirect to /login |
| RLS violation | 400 | "Permission denied" | Check RLS policy, user session |
| Record not found | 404 | "Lead not found" | Check ID, owner_id filter |
| Validation error | 400 | "Invalid data" | Check schema, required fields |
| Rate limited | 429 | "Too many requests" | Implement retry with backoff |

### Global Error Page
```typescript
// app/error.tsx - Next.js 16 app router
export default function Error({
  error,
 ,
  },
}]) {
  return (
    <div className="p-8 text-center">
      <h2>Something went wrong</h2>
      <p>Error: {error.message}</p>
      <a href="/" className="btn">Go Home</a>
    </div>
  )
}
```

---

## CI/CD & Deploy

### Vercel Deployment
```bash
# Local build test
npm run build

# Deploy to Vercel
vercel
# ou
vercel --prod (production)
```

### Environment Variables (Vercel Dashboard)
| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase project URL | Can be public (next-prefix) |
| `NEXT_PUBLIC_SUPWARE_ANON_KEY` | supabase anon key | For browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase service role | Admin only, server-side |
| `NODE_ENV` | production/development | |
| `TAILWIND_MODE` | "jit" | Tailwind 4 mode |

### Preview Deployments
- Every PR creates a preview URL on Vercel
- Environment vars from GitHub Actions automatically propagated

---

## Checklist de Produção

- [ ] RLS enabled + tested on all tables
- [ ] `.env.local` not in git (verified by gitignore)
- [ ] Supabase keys configured in Vercel dashboard
- [ ] Landing page design matches `.impeccable` spec.json
- [ ] All components use design tokens (colors, fonts, spacing)
- [ ] Synthetic data properly labeled everywhere
- [ ] Auth guard `requireAuth` used on all protected pages
- [ ] TypeScript compilation: `npm run build` passes
- [ ] ESLint: `npm run lint` passes (or `fix`)
- [ ] Preview deploy on Vercel working
- [ ] Database migrations tested locally