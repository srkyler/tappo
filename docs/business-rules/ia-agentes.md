# Agentes de IA

Cada agente (`ai_agents`) tem seu próprio provedor + modelo + chave — não é uma chave global
do `.env` pra todo o sistema. Isso permite ter, por exemplo, um agente Anthropic pra qualidade
e um agente OpenRouter mais barato, ao mesmo tempo, e trocar qual está ativo pela tela
(`ativarAgente`, `/admin`).

- Provedores suportados: `lib/ai/provedores.ts` (Anthropic, OpenAI, NVIDIA NIM, Groq, OpenRouter,
  DeepSeek, Gemini, Mistral, Together, Ollama, customizado — qualquer API compatível com
  `/chat/completions`).
- Chave cifrada (`lib/ai/cofre.ts`, AES-256-GCM) — só a Anthropic tem fallback pra
  `ANTHROPIC_API_KEY` do servidor quando o agente não tem chave própria salva.
- Teto de gasto: `ai_agents.teto_tokens_mes` (por agente) e `teto_tokens_usuario_dia` (por
  membro) — checado antes de rodar (`ai_tokens_usados()`).
- Ferramentas (function calling): `lib/ai/ferramentas.ts` — o agente pode consultar/alterar
  dados reais (leads, pipeline, tarefas) se `ai_agents.pode_editar_dados = true`.

## Atendimento automático (WhatsApp/Telegram/E-mail)

`lib/whatsapp/atendimento.ts`, `lib/telegram/atendimento.ts`, `lib/email/atendimento.ts` —
cada canal tem sua própria função de "responder com IA", mas todas seguem o mesmo fluxo:
busca o agente ativo → monta histórico da conversa → chama `lib/ai/motor.ts` → se a resposta
tiver a marca `[HUMANO]`, passa a conversa pra um atendente em vez de enviar.

Não existe (ainda) base de conhecimento/RAG — as instruções do agente são só texto livre
(`ia_instrucoes` por conexão, `instrucoes` por agente). Adicionar RAG de verdade precisa da
extensão `vector` do Postgres, que não está habilitada no schema atual.
