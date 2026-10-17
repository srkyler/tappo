# Architecture — Tappo

> Visão de 1 página. Detalhe de cada módulo em `docs/business-rules/`.

## Camadas

- **App (Next.js 16 App Router)**: UI + Route Handlers no mesmo repo. Server Components por padrão; `"use client"` só onde há estado/interação.
- **DB (Supabase Postgres)**: RLS em toda tabela — filtra por `org_id = org_atual()` (multiempresa) ou, nas tabelas legadas de 1 usuário, por `user_id = auth.uid()`. Migrations versionadas em `supabase/migrations/*.sql`, concatenadas em `supabase/setup_completo.sql` por `npm run db:setup` (nunca edite esse arquivo à mão).
- **Auth (Supabase Auth)**: e-mail/senha + Google OAuth. Perfil (`profiles`) criado por trigger no primeiro login; convite pendente ou criação de empresa nova, decidido em `handle_new_user()`.
- **Realtime (Supabase Realtime)**: inbox e tarefas escutam `postgres_changes` nas tabelas correspondentes.
- **IA (multi-provedor)**: `lib/ai/motor.ts` roda o agente ativo contra Anthropic ou qualquer provedor compatível com OpenAI (OpenAI, NVIDIA NIM, Groq, OpenRouter, DeepSeek, Gemini, Mistral, Together, Ollama, customizado). Chave por agente, cifrada (`lib/ai/cofre.ts`), nunca em `.env` — só a Anthropic tem fallback de chave do servidor.
- **WhatsApp**: WAHA (QR code, `lib/whatsapp/`) — sessão própria por empresa, webhook em `/api/v1/waha/[token]`.
- **Telegram**: Bot API (`lib/telegram/`), webhook em `/api/v1/telegram/[token]`.
- **E-mail conversacional**: Resend Inbound (`lib/email/`), webhook em `/api/v1/email/inbound/[token]`.

## Multi-tenant (multiempresa)

`org_id uuid not null` em toda tabela de negócio (default `public.org_atual()`, uma function `SECURITY DEFINER` que resolve a empresa atual do usuário logado via `profiles.org_atual`). RLS usa essa mesma function nas policies. Um usuário pode pertencer a várias empresas (`org_membros`) e trocar de empresa ativa pela tela.

Papéis: `dono` > `gestor` > `vendedor` / `atendente`. Quem é **admin da plataforma** (painel `/admin`, cadastro de agentes de IA) é outro eixo, separado do papel dentro da empresa — ver `lib/admin/guard.ts`. Só o `SUPER_ADMIN_EMAIL` pode promover alguém a admin.

## Inbox multicanal

`wa_conversas` / `wa_mensagens` têm uma coluna `canal` (`whatsapp` | `telegram` | `instagram` | `email`) em vez de tabelas paralelas por canal — a mesma tela de inbox mostra tudo junto. Cada canal tem sua própria tabela de conexão (`wa_conexoes`, `telegram_conexoes`, `email_conexoes`) porque a configuração de cada um é bem diferente (sessão WAHA vs. bot token vs. endereço de e-mail).

## Funis (pipelines)

Uma empresa pode ter **vários funis** (`pipelines`, com um marcado `padrao`). Cada funil tem suas próprias etapas (`pipeline_stages.pipeline_id`). Negócios (`deals`) apontam pra uma etapa (`stage_id`) — o funil é implícito pela etapa. Analytics agregados (`painel_gestor()`, `analytics_resumo()`) somam todos os funis juntos; não há (ainda) corte por funil nos relatórios.

## Fluxo de uma mensagem de WhatsApp/Telegram/E-mail

```
webhook externo → valida token na URL → grava em wa_mensagens (canal=X)
  → se IA ativa na conexão: lib/<canal>/atendimento.ts busca o agente ativo,
    monta histórico, chama lib/ai/motor.ts → responde (com jitter anti-flood)
  → se a IA não resolve ("[HUMANO]" na resposta, ou teto de tokens batido):
    atribui a um atendente (rodízio ou manual) e marca status "pendente"
```

## Automações

Tabela `automacoes` (gatilho → ação), avaliada de forma síncrona dentro das próprias Server Actions que mudam status/etapa/tag — sem fila, sem worker. Nasce sempre pausada. Ver `lib/automacoes.ts`.

## Onde olhar a fundo

- `docs/business-rules/` — regras de negócio por módulo
- `supabase/migrations/` — schema real, nunca confie em documentação desatualizada pra isso
- `CLAUDE.md` — convenções de código não-negociáveis
