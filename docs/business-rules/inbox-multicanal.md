# Inbox multicanal

`wa_conversas` / `wa_mensagens` servem **os três canais** (coluna `canal`:
`whatsapp` | `telegram` | `instagram` | `email`) — não existem tabelas paralelas por canal.
`instagram` está reservado no schema mas sem implementação: depende de app aprovado no
Meta Business, fora do controle deste repositório.

## WhatsApp (WAHA)

- `wa_conexoes`: uma ou mais sessões WAHA por empresa (`org_id`, não único — multi-número).
- Webhook: `app/api/v1/waha/[token]/route.ts`, autenticado pelo token no path (não por header).
- Anti-banimento: `lib/whatsapp/atendimento.ts` — jitter de 800–2500ms antes da IA responder,
  e limite de 3 mensagens automáticas por conversa a cada 60s (acima disso, cai pra fila humana).
- Rodízio de atendimento: `wa_conexoes.distribuicao = 'rodizio'` + `proximo_atendente()` (function
  SQL) escolhe quem tem menos conversas abertas.

## Telegram

- `telegram_conexoes`: token do bot cifrado (`lib/ai/cofre.ts`, nunca em texto puro).
- Configurar a conexão já registra o webhook no Telegram (`setWebhook` da Bot API) — não precisa
  configuração manual do lado deles.
- Webhook: `app/api/v1/telegram/[token]/route.ts`.

## E-mail

- `email_conexoes`: endereço que recebe + endereço que envia (Resend).
- **Precisa de configuração manual no painel do Resend** (Inbound) — não existe API pra
  registrar isso programaticamente como no Telegram. A tela mostra a URL do webhook pra copiar.
- Webhook: `app/api/v1/email/inbound/[token]/route.ts`. O formato exato do payload do Resend
  Inbound deve ser confirmado contra a documentação oficial deles antes de confiar 100% em produção
  — o parsing foi escrito de forma defensiva (várias chaves possíveis) justamente por isso.

## SLA de resposta

`sla_config` (1 linha por empresa) define o tempo máximo aceitável. O cálculo de "está acima
do SLA" é feito no cliente (`components/inbox/inbox-view.tsx`), comparado contra um relógio que
atualiza a cada minuto — nunca chame `Date.now()` direto no corpo de um componente React (ver
`CLAUDE.md` item sobre pureza).
