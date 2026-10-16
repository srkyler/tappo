# Tappo SaaS - Visão Geral do Projeto

## Identidade do Produto
- **Nome:** Tappo
- **Tipo:** SaaS B2B de prospecção comercial
- **Versão:** 0.1.0
- **Stack:** Next.js 16 (App Router) + Tailwind CSS 4 + Supabase (auth + banco + RLS)
- **Deploy:** Vercel
- **Idioma:** PT-BR
- **Identidade Visual:** "fichário de biblioteca" (nogueira, latão, fichas creme, carimbo carmim, tinta azul)

## Proposta de Valor
Plataforma SaaS que centraliza prospecção e escala commercial: base de leads, campanhas com cadências, pipeline e analytics num só lugar. Sucesso = mais reuniões qualificadas por vendedor com menos trabalho manual.

## Stack Tecnológica
| Componente | Tecnologia |
|------------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| **Backend/Auth** | Supabase (auth email/senha, RLS por usuário) |
| **Database** | Supabase PostgreSQL |
| **Styling** | Tailwind CSS 4, design tokens de `.impeccable/` |
| **Deploy** | Vercel |
| **Utilities** | ESLint, TypeScript 5, Puppeteer (testes) |

## Público-Alvo
- SDRs, vendedores e gestores de empresas B2B brasileiras
- Quem prospecta em volume e precisa escalar operação de vendas
- Operava hoje em planilhas e ferramentas separadas

## Capabilities and Constraints (v1 confirmado)
- **Landing de vendas completa** + app autenticado
- **Módulos:** leads, campanhas/cadências, pipeline, analytics
- **Dados de demonstração:** sintéticos, sempre rotulados como tais
- **Em aberto:** pricing final, domínio, integrações externas (e-mail, LinkedIn, WhatsApp), multi-tenant por organização

## Brand Commitments
- Nome: Tappo (fixado pelo usuário)
- Identidade visual definida no projeto, mundo novo
- Idioma do produto: PT-BR
- Nenhum cliente, métrica, depoimento ou logo de parceiro real em produção
- Se usado na landing, é exemplo demonstrativo rotulado como sintético

## Product Principles
1. **Pipeline é a fonte da verdade:** cada número na tela deriva de dados reais do usuário
2. **Operação em um clique:** iniciar cadência, mover estágio, registrar atividade sem formulários longos
3. **Dados sintéticos jamais se passam por reales**

## Operating Context
- Mercado brasileiro, produto em PT-BR
- Routine: garimpar leads, montar cadências, rodar campanhas, mover deals no pipeline, ler métricas semanais
- Supabase real: auth por e-mail/senha, RLS por usuário, schema versionado em `supabase/`

## Evidence on Hand
- Nenhum cliente, métrica, depoimento ou logo de parceiro real
- Todo dado de demonstração é sintético e rotulado como tal

## Roadmap Técnico (Próximos Passos)

### Prioridade Alta
- [ ] Implementar RLS (Row Level Security) em todas as tabelas new
- [ ] Completer landing page com design `.impeccable` (hero, drawers, fichas)
- [ ] Implementar auth flow (browser + server clients)
- [ ] Create supabase schema with proper RLS policies
- [ ] Implementar cadência/lead management pages
- [ ] Set up analytics/dashboard basic

### Prioridade Media
- [ ] Integrations externas (e-mail via SendGrid/Mailgun, WhatsApp)
- [ ] Multi-tenant support (por organização)
- [ ] Pricing page e plans
- [ ] LinkedIn integration (lead import)
- [ ] PIX/boleto payment for premium plans (Brazil market)
- [ ] Mobile responsiveness refinements

### Prioridade Baixa
- [ ] Full CRM replacement functionality
- [ ] Advanced AI features (suggestion engine)
- [ ] White label/reskin options
- [ ] Offline mode / PWA
- [ ] Internationalization (i18n) beyond PT-BR

---

## Arquitecture Overview

```
tappo/
├── app/              ← Pages Next.js (App Router)
│   ├── login/
│   ├── register/
│   ├── dashboard/
│   │   ├── leads/
│   │   ├── campaigns/
│   │   ├── pipeline/
│   │   └── analytics/
│   ├──/
├── components/       ← Componentes reutilizáveis
├── lib/
│   ├── supabase/     ← Clients Supabase (browser/server/admin)
│   └── auth/         ← Guards de autenticação
├── supabase/         ← Schema SQL e migrações
├── public/           ← Assets estáticos
├── .impeccable/      ← Design system (mocks, specs, build phases)
├── .env.example      ← Template vars (sem valores reais)
├── AGENTS.md         ← Coordination guide
├── PRODUCT.md        ← Product brief
├── SECURITY.md       ← Security policy
└── next.config.ts    ← Next.js 16 config
```

## Design System (.impeccable)

The `.impeccable` folder contains the visual design system:

- **Mocks:** comp-a.png, comp-b.png, comp-c.png (3 comps, 1 approved: comp-a)
- **Specs:** spec.json (14 regions, detailed typography/spacing tokens)
- **Build phases:** comps → spec → plates → hero → review → finish
- **Brand colors:** #291e15 (nogueira escura), #f5e6d6 (ficha creme envelhecida), #c5b9a9 (latão), #98723f (carimbo), #584828 (tinta azul)
- **Fonts:** Courier Prime (titles, caps, tracking), Literata (corpo editorial)
- **Estate:** nogueira (dark brown), latão (brass), ficha creme, carimbo carmim, tinta azul

## Key Design Elements (from spec.json)

| Element | Description |
|---------|-------------|
| **Nav** | Barra navegação nogueira, logo TAPPO latão, links + botão "Assinar" com moldura latão |
| **Kicker** | "FICHÁRIO DE PROSPECÇÃO · GAVETA 01/24" em latão |
| **Headline 1** | "Toda empresa tem un garimpo." Courier Prime Bold, tracking aberto, 66px |
| **Headline 2** | "tem un garimpo." - sublinhado carmim |
| **Sub** | Parágrafo Literata, 3 linhas, texto creme sobre nogueira |
| **CTA** | Selo carimado "ABRIER MEU FICHÁRIO" em carmim com moldura dupla |
| **Counters** | 3 placas latão: leads garimpados, campanhas na mesa, reuniões marcadas |
| **Demo note** | "PLACA DE DEMONSTRAÇÃO — DADOS SINTÉTICOS" datilografada |
| **Drawer-shell** | Gaveta de arquivo aberta: nogueira + moldura latão, puxador central, rótulo GAVETA 03 |
| **Fichas** | Fichas pautadas: HELENA DUARTE, RAFAEL NUNES, MARINA PACHECO, CARLOS BETIM, JÚLIA SAMPAIO |
| **All labeled as synthetic data** | Each ficha has carimbo with status (CONTATADO, REUNIÃO 3ª, QUALIFICADO, NOVA, FOLLOW-UP) |

## Supabase Schema (Planned)

The `supabase/` folder contains migrations. Key tables planned:
- `profiles` - user profiles (RLS: user_id = auth.uid())
- `leads` - base de leads (RLS: owner_id)
- `campaigns` - cadências/ campanhas (RLS: organization_id or user_id)
- `pipeline` - deals pipeline stages
- `analytics` - weekly metrics
- `organizations` - multi-tenant support (open)

**RLS Policy Example:**
```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_ve_s_leads_propias"
  ON leads FOR ALL
  USING (auth.uid() = owner_id);
```