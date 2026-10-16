# Tappo SaaS - Business Logic & Data Models

## Supabase Data Models (Schema)

### Profiles Table (user profiles)
```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  company text,
  role text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS Policy
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_ve_s_proprios_perfis"
  ON profiles FOR ALL
  USING (auth.uid() = id);
```

### Leads Table (base de leads)
```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  company text,
  external_id text, -- e.g., GAR-0241
  status text default 'NEW', -- NEW, CONTACTED, QUALIFIED, MEETING
  source text, -- e.g., "import", "linkedin", "manual"
  phone text,
  email text,
  score integer default 0, -- engagement score
  notes text,
  owner_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policy
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_ve_s_leads_proprias"
  ON leads FOR ALL
  USING (auth.uid() = owner_id);
```

### Campaigns Table (cadências)
```sql
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sequence jsonb default '[]'::jsonb, -- cadence sequence
  status text default 'DRAFT', -- DRAFT, ACTIVE, PAUSED, COMPLETED
  owner_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policy
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_ve_s_campanhas_proprias"
  ON campaigns FOR ALL
  USING (auth.uid() = owner_id);
```

### Pipeline / Deals
```sql
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stages jsonb default '[]'::jsonb, -- stage definitions
  status text default 'ACTIVE',
  owner_id uuid references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table pipeline_deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads on delete cascade,
  pipeline_id uuid references pipelines on delete cascade,
  stage_order integer default 1,
  contact_date timestamptz,
  meeting_date timestamptz,
  value numeric, -- deal value in BRL
  status text default 'OPEN', -- OPEN, WON, LOST
  owner_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_ve_s_pipelines_proprias"
  ON pipelines FOR ALL USING (auth.uid() = owner_id);

ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_ve_s_deals_proprias"
  ON pipeline_deals FOR ALL USING (auth.uid() = owner_id);
);
```

### Organizations (multi-tenant - open)
```sql
-- This is OPEN for future multi-tenant support
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid references auth.users on delete cascade,
  created_at timestamptz default now()
);

-- RLS - currently open, will be enabled when multi-tenant is implemented
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- Policy will be added when multi-tenant feature is implemented
```

---

## Business Logic & Workflows

### 1. Lead Import Workflow
```typescript
// Import leads (from CSV, LinkedIn, etc.)
const importLeads = async (leadsData: LeadInput[], userId: string) => {
  const { error } = await supabase
    .from('leads')
    .insert(leadsData.map(lead => ({
      ...lead,
      owner_id: userId,
      status: 'NEW',
      created_at: new Date(),
      updated_at: new Date()
    })))
  
  if (error) throw error
  
  // Update counters in design system
  // Trigger revalidation
  revalidatePath('/dashboard/leads')
}
```

### 2. Cadence/Campaign Execution
```typescript
// Run campaign sequence for a lead
const executeCampaign = async (campaignId: string, leadId: string) => {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('sequence')
    .eq('id', campaignId)
    .single()
  
  if (error) throw error
  
  const sequence = campaign.sequence as CampaignStep[]
  
  // Execute first step
  const firstStep = sequence[0]
  
  // Send email / LinkedIn / WhatsApp based on step type
  await sendCommunication({
    type: firstStep.type,
    recipient: lead.email || lead.phone,
    content: firstStep.content,
    campaignId,
    leadId
  })
  
  // Update lead status if needed
  // Move lead to next stage
}
```

### 3. Pipeline Deal Movement
```typescript
// Move deal to next stage
const moveDealStage = async (dealId: string, userId: string) => {
  // Get current deal
  const { data: deal, error } = await supabase
    .from('pipeline_deals')
    .select('*, pipelines(stages)')
    .eq('id', dealId)
    .single()
  
  if (error) throw error
  
  const currentStage = deal.stage_order
  const maxStage = deal.pipelines.stages.length
  
  // If not at last stage, advance
  if (currentStage < maxStage) {
    const { error } = await supabase
      .from('pipeline_deals')
      .update({ 
        stage_order: currentStage + 1,
        updated_at: new Date()
      })
      .eq('id', dealId)
  
    if (error) throw error
  
    // Notify user
    await notify(`Deal moved to stage ${currentStage + 1}`)
  }
}
```

### 4. Synthetic Data Labeling
```typescript
// Component that ensures synthetic data is labeled
const withSyntheticDataLabel = (children: ReactNode) => {
  return (
    <div>
      {children}
      <Badge
        className="bg-creme text-carmim text-xs font-bold"
        ml-2
        title="Synthetic data - for demonstration only"
      >
        Dados Sintéticos
      </Badge>
    </div>
  )
}
```

### 5. Counter Updates (from .impeccable design)
The design system has counters that need to be kept in sync with real data:
- Leads imported
- Campaigns running
- Meetings scheduled

These should be derived from the database, not hardcoded:

```typescript
// Get real counts from Supabase
const { count: leadsCount } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: false })
  .eq('owner_id', user.id)

const { count: activeCampaigns } = await supabase
  .from('campaigns')
  .select('*', { count: 'exact', head: false })
  .eq('owner_id', user.id)
  .eq('status', 'ACTIVE')

// Update UI state
setLeadsCount(leadsCount)
setActiveCampaignsCount(activeCampaigns)
```

---

## Authentication Flow

### 1. Sign In (Email/Password)
```typescript
// Server Component or Action
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    // Handle specific errors
    if (error.message === 'Invalid credentials') {
      // Show generic error message
    }
    throw error
  }
  
  // On success, user is automatically signed in
  // Redirect to dashboard or intended page
  redirect('/dashboard')
}
```

### 2. Sign In with Google (OAuth)
```typescript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: '/auth/callback', // Must match your app route
    },
  })
  
  if (error) throw error
  
  // User redirected to Google auth page
}
```

### 3. Sign Out
```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  
  redirect('/')
}
```

### 4. Session Persistence (Next.js App Router)
```typescript
// middleware.ts - protect all app routes
import { NextResponse } from 'next/server'
import type { NextMiddleware } from 'next'

export const middleware: NextMiddleware = async (req) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if !session && req.nextUrl.pathname.startsWith('/dashboard') {
    const url = req.nextUrl.pathname
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', url.href)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/app/:path*'],
}
```

### 5. Get Current User
```typescript
// Server Component
import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user} } = await supabase.auth.getUser()
  
  if (!user) return null
  
  return {
    id: user.id,
    email: user.email,
    // ... other user fields
  }
}
```

---

## Error Handling Patterns

### Supabase Errors
```typescript
const handleSupabaseError = (error: any) => {
  if (!error) return null
  
  const errorCode = error.code
  const errorMessage = error.message
  
  switch (errorCode) {
    case 'PGRST116': // No rows returned
      return { notFound: true }
    case '23505': // Violation of not-null constraint
      return { validation: errorMessage }
    case '23503': // Violation of foreign key
      return { foreignKey: errorMessage }
    case '28P01': // Invalid authentication signature
      return { auth: true }
    default:
      return { generic: errorMessage }
  }
}
```

### Next.js Error Boundaries
```typescript
// app/error.tsx - handles all unhandled errors
export default function Error({ error, }) {
  return (
    <main className="p-8">
      <h1>Ops, something went wrong</h1>
      <p>{error.message}</p>
      <p>{error.stack}</p>
      <button onClick={() => window.history.back()}>
        Go Back
      </button>
    </main>
  )
}
```

---

## TypeScript Types (Recommended)

### Lead Types
```typescript
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'MEETING'

export interface Lead {
  id: string
  name: string
  role?: string
  company?: string
  external_id?: string
  status: LeadStatus
  source?: string
  phone?: string
  email?: string
  score?: number
  notes?: string
  owner_id: string
  created_at: Date
  updated_at: Date
}
```

### Campaign Types
```typescript
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'

export interface CampaignStep {
  type: 'email' | 'linkedin' | 'whatsapp' | 'phone'
  day: number // relative day from start
  content: string
  sent_at?: Date
}

export interface Campaign {
  id: string
  name: string
  description?: string
  sequence: CampaignStep[]
  status: CampaignStatus
  owner_id: string
  created_at: Date
  updated_at: Date
}
```

### Pipeline Types
```typescript
export type PipelineStatus = 'ACTIVE' | 'ARCHIVED'

export interface PipelineStage {
  name: string
  order: number
  win_probability?: number
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
  status: PipelineStatus
  owner_id: string
  created_at: Date
}

export interface PipelineDeal {
  id: string
  lead_id: string
  pipeline_id: string
  stage_order: number
  contact_date?: Date
  meeting_date?: Date
  value?: number
  status: 'OPEN' | 'WON' | 'LOST'
  owner_id: string
  created_at: Date
  updated_at: Date
}
```

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

```typescript
// __tests__/leads.test.ts
import { render, screen } from '@testing-library/react'
import { supabase } from '@/lib/supabase/browser'

describe('Leads Management', () => {
  it('renders leads list', async () => {
    // Mock supabase
    const mockLeads = [
      { id: '1', name: 'HELENA DUARTE', status: 'CONTACTED' },
    ]
    
    // Test component renders leads
    render(<LeadsList />)
    expect(screen.getByText('HELENA DUARTE')).toBeInTheDocument()
  })

  it('filters leads by status', () => {
    render(<LeadsFilter status="NEW" />)
    expect(screen.getByText('NEW leads')).toBeInTheDocument()
  })
})
```

### Integration Tests (Supertest)

```typescript
// tests/api/leads.test.ts
import request from 'supertest'
import app from '@/app'
import { supabase } from '@/lib/supabase/server'

describe('API Leads', () => {
  let authToken: string
  
  beforeAll(async () => {
    // Create test user
    const { data } = await supabase.auth.signUp({
      email: 'test@tappo.com',
      password: 'password123',
    })
    authToken = data.session?.access_token
  })
  
  it('creates a lead', async () => {
    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Lead', status: 'NEW' })
    
    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
  })
  
  it('returns leads for authenticated user', async () => {
    const response = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${authToken}`)
    
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThan(0)
  })
})
```

### End-to-End Tests (Puppeteer)

```typescript
// puppeteer tests
const puppeteer = require('puppeteer')

describe('Tappo End-to-End', () => {
  it('user can sign in and view dashboard', async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    
    await page.goto('http://localhost:3000/login')
    await page.type('#email', 'test@tappo.com')
    await page.type('#password', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('/dashboard')
    await expect(page.locator('.hero')).toBeVisible()
    await expect(page.locator('.kicker')).toContainText('FICHÁRIO DE PROSPECÇÃO')
    
    await browser.close()
  })
})
```

### Test Coverage Goals

| Area | Minimum | Target |
|------|---------|--------|
| Leads CRUD | 80% | 100% |
| Auth flows (signin/signout/OAuth) | 90% | 100% |
| RLS policies (tested with different users) | 80% | 100% |
| Pipeline deal movement | 70% | 100% |
| Campaign sequence execution | 70% | 100% |
| Synthetic data labeling | 100% | 100% |
| UI/design match against .impeckcle specs | 90% | 100% |

---

## Performance Optimization

### Next.js Image Optimization
```typescript
// Using Next.js Image with optimized assets
import Image from 'next/image'

// Example: Hero background from design
<Tagline>
  <Image
    src="/ficha-helena.png"
    alt="Ficha: HELENA DUARTE"
    width={400}
    height={60}
    className="bg-creme rounded-full p-2"
  />
</Tagline>
```

### TurboPack + Tailwind 4
- Enable `turbopeed` in next.config.ts (already configured)
- Use `@tailwindcss/turbopack` for fast CSS rebuilds
- Purge unused CSS in production

### Database Query Optimization
```typescript
// Use select only needed columns
const { data: leads, error } = await supabase
  .from('leads')
  .select('id, name, status, created_at') // not * 
  .eq('owner_id', user.id)
  .order('created_at', { ascending: false })
  .limit(20) // pagination

// Use count with head for pagination info
const { data, error, count } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: true })
```

### Caching Strategy
```typescript
// Revalidate paths after data updates
revalidatePath('/dashboard/leads')
revalidatePath('/dashboard/analytics')

// Use ISR (Incremental Static Regeneration)
export const revalidate = 60 // revalidate every 60 seconds

// Or at build time
export const revalidate = 3600 // hourly
```

---

## Deployment Checklist (Vercel)

### Pre-Deploy
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes (or `npm run lint:fix`)
- [ ] All RLS policies tested with different user roles
- [ ] Synthetic data labels present where needed
- [ ] Environment variables set in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `NODE_ENV=production`
- [ ] Domain configured (custom domain if needed)
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Preview deploy working on PR

### Post-Deploy
- [ ] Verify auth flow works (signin, signout, OAuth)
- [ ] Verify leads/campaigns/pipeline data displays correctly
- [ ] Verify RLS works (test with incognito mode / different account)
- [ ] Check design tokens match `.impeccable` spec
- [ ] Monitor Vercel analytics for errors
- [ ] Set up error tracking (Sentry optional)