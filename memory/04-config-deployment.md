# Tappo SaaS - Configuração & Deploy

## Environment Variables

### .env.example (never commit real values)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Next.js
NODE_ENV=development

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Analytics (Sentry, etc.)
NEXT_PUBLIC_SENTRY_DSN=

# Tailwind
TAILWIND_MODE=jit
```

### Vercel Dashboard Variables
| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://abc123.supabase.com | Public - used in browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | <sua-chave-aqui> | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | <sua-chave-aqui> | Admin - server only, never expose to browser |
| `NEXT_PUBLIC_APP_URL` | https://tappo.vercel.app | App URL |
| `NEXT_PUBLIC_SITE_URL` | https://tappo.vercel.app | Site URL for SEO, open graph |
| `NEXT_PUBLIC_SENTRY_DSN` | (optional) | Error tracking |
| `TAILWIND_MODE` | jit | Tailwind 4 mode |

### .gitignore (verified)
```gitignore
# See .gitignore at root
node_modules/
/pnpm-lock.yaml
.env.local
.env*.production
*.pem
*.key
/uploads/**
/dist/
/server/
/client/
/.db/
/sqlite.*
# Synthetic data files (but keep .md briefs)
!.impeccable/
!.impeccable/**
!.env.example
```

---

## Docker (Optional - for local development)

### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE}

COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
```

### docker-compose.yml (dev with Supabase stub)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=test anon key
      - NEXT_PUBLIC_SUPABASE_URL=
    volumes:
      - .:/app
    depends_on:
      - stub

  stub:
    image: supabase/stub:latest
    ports:
      - "54321:54321"
    environment:
      - POSTGRES_DB=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=""
```

---

## Supabase Configuration

### Local Development (.env.local)
```bash
# Supabase local stub
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-chave-aqui>
```

### Supabase CLI Commands
```bash
# Initialize project
supabase init

# Link to project
supabase link --project-ref your-project-ref

# Start local stub
supabase start

# Stop local stub
supabase stop

# Make schema changes
supabase migration make create_initial_schema

# Push schema changes
supabase migration reset

# Check logs
supabase logs
```

### Supabase Dashboard Settings
- Enable Email auth provider
- Configure redirect URLs (sign in, sign up, callback)
- Set up rate limiting
- Configure JWT secrets
- Enable RLS on all tables

---

## Middleware (Next.js 16 App Router)

### middleware.ts (auth guard)
```typescript
import { NextResponse } from 'next/server'
import type { NextMiddleware } from 'next'
import { createClient } from '@/lib/supabase/server'

export const middleware: NextMiddleware = async (req) => {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  // Protect dashboard routes
  if !session && req.nextUrl.pathname.startsWith('/dashboard') {
    const url = req.nextUrl.pathname
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', url.href)
    return NextResponse.redirect(loginUrl)
  }
  
  // Protect app routes
  if !session && req.nextUrl.pathname.startsWith('/app') {
    const url = req.nextUrl.pathname
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', url.href)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/app/:path*',
    '/login',
    '/register',
  ],
}
```

### Next.js middleware config explanation
- `matcher`: Which paths to run middleware on
- Exclude `/`, `/login`, `/register` from auth guard
- All `/dashboard/*` and `/app/*` require authentication

---

## Design System Integration (.impeccable)

### Tailwind 4 Token Extraction

The `.impeccable/build/spec.json` defines design tokens that should be extracted to Tailwind config:

```javascript
// tailwind.config.mjs (manual extraction from spec.json)
export default {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nogueira (dark wood) - main bg
        nogueira: '#291e15',
        // Latão (brass) - accents
        latão: '#c5b9a9',
        // Ficha creme - card backgrounds
        'ficha-creme': '#f5e6d6',
        // Carmim (carmine) - primary CTA
        carmim: '#98723f',
        // Tinta azul - text/information
        'tinta-azul': '#584828',
        // Additional from spec...
        nogueiraDark: '#312518',
        latãoLight: '#b8b8a8',
        // ...
      },
      fontFamily: {
        courier: ['"Courier Prime"', 'mono'],
        literata: ['"Literata"', 'serif'],
      },
      borderWidth: {
        // From drawer-shell region
        'drawer-strip': '9px', // match comp height, not position
      },
    },
  },
  plugins: [],
}
```

### Using Design Tokens in Components

```typescript
// components/hero/hero.tsx
import { cn } from '@/lib/utils'

export default function Hero() {
  return (
    <section className="bg-nogueira text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Kicker className="text-latão mb-6">FICHÁRIO DE PROSPECÇÃN · GAVETA 01/24</Kicker>
        
        <h1 className="font-courier text-6xl font-bold tracked mb-4">
          Toda empresa tem un garimpo.
        </h1>
        
        <p className="text-literata mb-6">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        
        <div className="flex items-center gap-4 mb-8">
          <CTAButton />
          <Link href="/login" className="text-carmim font-small">
            VER COME FUNCIONA
          </Link>
        </div>
        
        <CountersSection />
        <DemoNote />
      </div>
    </section>
  )
}
```

### Component Mapping from Mocks

| Mock Component | Code Component | Description |
|----------------|----------------|-------------|
| comp-a (approved) | `app/hero/page.tsx` | Landing hero section |
| comp-b | `app/features/campaigns/page.tsx` | Campaigns/features section |
| comp-c | `app/pricing/page.tsx` | Pricing plans page |
| drawer-shell | `app/leads/[leadId]/drawer.tsx` | Lead detail drawer |
| ficha-helena/rafael/marina/carlos/julia | `components/ficha/[id].tsx` | Individual lead card components |

---

## Build & Deploy Scripts

### Package.json Scripts (enhanced)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext ts,tsx,js,jsx",
    "lint:fix": "eslint . --ext ts,tsx,js,jsx --fix",
    
    // Custom scripts for Tappo
    "design:extract": "node scripts/extract-design-tokens.js",
    "db:generate": "supabase migration make",
    "db:push": "supabase migration reset",
    "db:studio": "supabase studio",
    
    // Test scripts
    "test:unit": "jest",
    "test:unit:watch": "jest --watch",
    "test:e2e": "puppeteer test/e2e",
    "test:coverage": "jest --coverage",
    
    // Design system
    "design:review": "npm run build && npm run lint && open .impeccable/review/hero/report.html",
    
    // Deploy
    "deploy": "vercel --prod",
    "preview": "vercel preview",
    
    // All
    "all": "npm run dev && npm run build && npm run lint"
  }
}
```

### Pre-deploy Checklist Script
```bash
#!/bash
# pre-deploy.sh - run before vercel deploy

echo "🔓 Checking .env.local..."
if [ -f .env.local ]; then
  echo "ERROR: .env.local exists - remove or add to .gitignore"
  exit 1
fi

echo "🏗️ Building..."
npm run build

echo "🧹 Linting..."
npm run lint

echo "🧪 Testing..."
npm run test:unit

echo "🎨 Design review..."
# Check that key design tokens are in the built CSS
grep -q "bg-nogueira" out/.next/static/chunks/  && echo "✓ Design tokens OK" || echo "⚠ Design tokens missing"

echo "🚀 Ready for deploy"
```

---

## Monitoring & Analytics

### Sentry Integration (optional)
```typescript
// sentry.server.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // ... other options
})

export const withSentry = (handler) => Sentey.withErrorTracking(handler)
```

### Vercel Analytics
- Automatic with Vercel deployment
- Shows page views, components rendering time, errors
- Access via Vercel Dashboard → Analytics

### Custom Metrics (next/analytics)
```typescript
// Track custom events
import { track } from '@vercel/analytics'

// In component after lead created
track({
  name: 'lead_created',
  properties: {
    source: 'import' | 'linkedin' | 'manual',
    status: 'NEW' | 'CONTACTED' | 'QUALIFIED',
  },
})
```

---

## Security Checklist (Complete)

### Authentication
- [ ] Supabase anon key configured in Vercel, not exposed to browser beyond `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Service role key used only in Edge Functions or server-side
- [ ] Email/password auth enabled + configured
- [ ] OAuth (Google) configured with correct redirect URLs
- [ ] `requireAuth` guard used on all protected pages
- [ ] Session persistence working across app navigation

### RLS (Row Level Security)
- [ ] All tables have RLS enabled
- [ ] Policies use `auth.uid()` for owner-based access
- [ ] Tested with at least 2 different user accounts
- [ ] No `SELECT *` queries without RLS filter
- [ ] Foreign key references respect RLS

### Data Safety
- [ ] Synthetic data labeled as "PLACA DE DEMONSTRAÇÃO — DADOS SINTÉTICOS"
- [ ] No real user data in demo/mock sections
- [ ] `.env.local` and secrets not committed to git
- [ ] `.env.example` has placeholder values only
- [ ] Backup strategy for Supabase database

### Design System
- [ ] `.impeccable` design specs reviewed and approved
- [ ] Tailwind tokens extracted from spec.json
- [ ] All components match approved comps (comp-a, comp-b, comp-c)
- [ ] Brand colors consistent (nogueira, latão, ficha creme, carmim, tinta azul)
- [ ] Fonts: Courier Prime (titles) + Literata (body)

### Performance
- [ ] `npm run build` < 90 seconds
- [ ] Lighthouse score > 90 (mobile + desktop)
- [] Image optimization configured (next/image)
- [] Tailwind purging enabled for production
- [] Caching strategy (ISR/Revalidate) configured

### SEO & Meta
- [ ] Meta tags on all pages (title, description, open graph)
- [ ] robots.txt if needed
- [ ] sitemap generation
- [ ] Schema.org markup where appropriate

### Post-deploy Verification
- [ ] Visit deployed URL: https://tappo.vercel.app
- [ ] Test sign in with Google
- [ ] Test sign in with email/password
- [ ] Create a lead - verify RLS (can't see other user's leads)
- [ ] View dashboard - verify design tokens applied
- [ ] Check mobile responsiveness
- [ ] Verify counters sync with real DB data