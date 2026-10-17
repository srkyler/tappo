# Diagnóstico

## "Banco não configurado" aparece no app

`supabase/setup_completo.sql` não foi rodado (ou falhou no meio) no projeto Supabase
configurado no `.env`. Cole de novo no SQL Editor — é idempotente.

## Build local falha, mas `tsc --noEmit` passou limpo

Normal neste projeto — ver `CLAUDE.md`, item 1 e 2. Rode `npm run build` de verdade; os erros
mais comuns são:
- `import "server-only"` sendo importado (direta ou indiretamente) por um Client Component
- `<form action={fn}>` com uma Server Action que retorna `{ ok, erro }` em vez de `void`

## Agente de IA não responde

1. `/admin` → existe um agente **ativo**? (só um por vez)
2. O agente tem chave salva, ou é Anthropic com `ANTHROPIC_API_KEY` no `.env`?
3. Teto de tokens do mês/dia foi batido? (`ai_agents.teto_tokens_mes` / `teto_tokens_usuario_dia`)

## WhatsApp não recebe mensagem

- `NEXT_PUBLIC_APP_URL` precisa ser o domínio HTTPS real (o webhook é registrado com essa URL).
- Mudou o domínio? Reconecte em Inbox → WhatsApp → Conectar (reregistra o webhook).
- `docker compose logs waha` — confirma se a sessão está `WORKING`.

## Erro de permissão / linha não aparece (RLS)

Quase sempre é `org_id` errado ou ausente. Confira:
- A tabela tem `org_id uuid NOT NULL DEFAULT public.org_atual()`? (sem isso, inserir sem
  passar `org_id` explicitamente falha)
- A policy usa `org_id = (SELECT public.org_atual())`? Compare com uma tabela que já funciona.

## Antes de reportar um bug de dado (número errado em relatório)

Confira se a coluna que o código está lendo **existe de verdade** na tabela certa — já
aconteceu de um relatório ler `deals.tipo` (não existe; "tipo" é de `pipeline_stages`) ou
`leads.criado_em` (não existe; é `created_at`). `grep` o nome da coluna na migration antes
de assumir que o bug é na lógica.
