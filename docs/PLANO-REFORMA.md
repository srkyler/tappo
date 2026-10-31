# Plano de reforma do Tappo

> Objetivo: deixar **tudo funcionando de verdade** antes de vender. Nenhuma tela de
> fachada, nenhum recurso que finge funcionar, IA atendendo de ponta a ponta.
> Levantamento feito em 31/10/2026 sobre o commit `778703c`.

## Diagnóstico

| Área | Situação hoje |
|---|---|
| Telas | 50 em `/app`: **25 reais**, **6 painéis só de leitura** (ok), **19 de fachada** (formulário que não salva nada / tela sem dados). 3 fachadas estão no menu: Calendário, Dashboard Executivo, Tarefas Recorrentes. |
| Banco | 20 migrations; até hoje 12 tabelas existiam só no `setup_completo.sql` (corrigido em `778703c`). Migration do assistente IA ainda precisa rodar no Supabase. |
| Tarefas automáticas | **Não existe agendador.** Cadências, tarefas recorrentes, alertas de SLA e follow-up dependem de alguém clicar. |
| IA de atendimento | Perfil, conhecimento, memória, skills e transferência prontos (`f2b3d53`). **Não entende áudio nem imagem** (mensagem sem texto é ignorada) e não agenda horário de verdade. |
| WhatsApp | Só WAHA (API não oficial → risco de banimento do número). |
| Qualidade | Nenhum teste automatizado. 10 bugs registrados em `BUGS-TAPP0-CRM.md` (1–6 e 8–10 abertos). Deploy por SSH falhou nos 3 últimos pushes. |

Tamanho dos itens: **P** = poucas horas · **M** = 1–2 dias · **G** = 3+ dias.

---

## WhatsApp (WAHA) no padrão DeskcommCRM — feito

Comparado item a item com o DeskcommCRM (`lib/waha/*`, `lib/channels/*`, `docker-compose.yml`).

| O que estava errado | Correção |
|---|---|
| HMAC nunca verificado: `WHATSAPP_HOOK_HMAC_KEY` só assina o webhook **global**, e o Tappo usa webhook por sessão | a chave vai em `config.webhooks[].hmac` de cada sessão; rota rejeita assinatura inválida (fail-closed) |
| PUT da sessão substituía a config inteira | config atual + enxerto (webhook, filtro); `noweb.store` só na criação |
| Sem `message.ack`: Inbox mostrava ✓✓ em tudo | ack monotônico (enviada → entregue → lida, erro em vermelho); `message.revoked` marca "apagada" |
| Contato `@lid` ficava sem telefone (não achava o lead) | `_data.key.remoteJidAlt` (NOWEB) ou `GET /api/{sessão}/lids/{lid}` |
| Mídia: link apontava para o WAHA interno e exigia API key; o WAHA apagava o arquivo em 180 s | proxy autenticado `/api/whatsapp/midia/[id]` (RLS + sem SSRF); foto/áudio/vídeo na bolha; `WHATSAPP_FILES_LIFETIME=0` |
| 2+ números na empresa: responder quebrava (`maybeSingle`) | `wa_conversas.conexao_id`: resposta sai pelo número que recebeu |
| Excluir conexão deixava a sessão viva no WAHA | `DELETE /api/sessions/{nome}` antes de apagar a linha |
| Container reiniciava e as sessões ficavam paradas | `WHATSAPP_RESTART_ALL_SESSIONS` + vigia a cada 5 min (religa até 3×, reconfigura sessão antiga) |
| Estados/grupos/canais trafegavam e eram descartados | `ignore` na sessão corta na fonte |
| Só QR | código de pareamento (Conectar com número de telefone) |
| `waha:latest` sem healthcheck | `WAHA_IMAGE` para fixar versão, healthcheck `/ping`, logs rotacionados; NOWEB recomendado |

**Para ativar na VPS:** rodar a migration `20261031120000`; no `.env` definir `CRON_SECRET` e `WAHA_HMAC_SECRET`
(`openssl rand -hex 32` cada); `docker compose up -d`. Em até 5 min o vigia reconfigura as sessões existentes
(assinatura + ack) sem pedir QR. Trocar `WAHA_ENGINE` para `NOWEB` exige ler o QR de novo — fazer num horário calmo.

## Vários atendentes de IA (estilo DeskcommCRM) — feito

- **Cliente** (`/app/assistente` › Atendentes): cria quantos atendentes quiser (nome, função, saudação, tom, objetivo, instruções, quando passar para humano), marca um como padrão e escolhe quem atende cada número de WhatsApp, Telegram e e-mail. Todos compartilham perfil, conhecimento e memória da empresa. Um atendente passa a conversa para outro (`transferir_para_atendente`).
- **Admin** (`/admin` › Atendentes de IA das empresas): escolhe o modelo (agente da plataforma) de cada atendente; sem escolha, usa o agente ativo. O cliente nunca vê o modelo.
- **IA que não respondia**: modelos que recusam ferramentas (NIM, Groq, OpenRouter, Ollama…) faziam o atendimento falhar calado. Agora a IA cai no modo simples e responde; o motivo real aparece em `/admin` › Falhas recentes, e o botão Testar do agente informa se o modelo aceita ferramentas.

## Fase 0 — Estabilizar (fazer primeiro)

| # | Item | Tam. | Pronto quando |
|---|---|---|---|
| 0.1 | Rodar no Supabase as migrations `20261018120000` e `20261031000000` | P | `/app/assistente` abre sem aviso de tabela faltando |
| 0.2 | Consertar o deploy automático (secrets `VPS_*` / chave SSH) | P | push na `main` termina verde no Actions |
| 0.3 | ✅ Corrigir bugs 1–6 e 8–10 de `BUGS-TAPP0-CRM.md` (status de cada um no arquivo) | M | cada bug com correção e marcado como resolvido no arquivo |
| 0.4 | ✅ Tirar do menu as 3 fachadas até a Fase 3 entregar | P | nenhum item do menu leva a tela que não funciona |
| 0.5 | Decidir visibilidade do repositório (hoje **público**) | P | decisão tomada |
| 0.6 | ✅ Roteiro de teste manual em `docs/ROTEIRO-TESTE.md` | P | roteiro executado do começo ao fim sem erro |

## Fase 1 — Fundação técnica

| # | Item | Tam. | Pronto quando |
|---|---|---|---|
| 1.1 | ✅ **Agendador**: rota `/api/v1/cron/[tarefa]` protegida por `CRON_SECRET` + serviço `agendador` no `docker-compose` (tick a cada minuto, histórico em `cron_execucoes`) | M | feito — primeira tarefa: vigia do WhatsApp |
| 1.2 | ✅ **Fila de jobs** (`jobs`: tipo, payload, executar_em, tentativas, erro) com retentativa — o agendador consome | M | job que falha é retentado e o erro fica visível |
| 1.3 | 🟡 **Testes**: Vitest em `tests/` (WAHA, mídia, horário, atendentes, CSV) rodando no CI antes do deploy. Falta: Playwright para o roteiro da 0.6 | M | `npm test` no CI do GitHub Actions, bloqueando deploy se falhar |
| 1.4 | ✅ **Registro de erros** (`erros_app`, painel Falhas recentes no /admin) (tabela `erros_app` ou Sentry) em Server Actions e webhooks | P | erro em produção aparece com rota, empresa e mensagem |
| 1.5 | ✅ Checagem de saúde `/api/health` (banco, WAHA, IA) + aviso no `/admin` | P | admin vê na hora o que está fora do ar |

## Fase 2 — IA de atendimento completa

| # | Item | Tam. | Pronto quando |
|---|---|---|---|
| 2.1 | ✅ **Áudio**: transcrever mensagem de voz antes da IA responder (provedor de transcrição configurado no `/admin`, ex.: Whisper via Groq/OpenAI) | M | cliente manda áudio e a IA responde ao conteúdo; transcrição aparece no Inbox |
| 2.2 | ✅ **Imagem**: IA lê foto/print (modelos com visão) | M | cliente manda foto de produto/comprovante e a IA entende |
| 2.3 ✅ | **Agendamento real**: Google Agenda por empresa; IA consulta horários livres e marca | G | IA oferece 3 horários, cliente escolhe, evento criado na agenda e tarefa no CRM |
| 2.4 | ✅ **Resumo na transferência**: ao passar para humano, a IA deixa nota com resumo + o que o cliente quer | P | atendente abre a conversa e lê o resumo no topo |
| 2.5 | ✅ **Follow-up automático** (usa 1.1): lead sem resposta há X dias recebe mensagem personalizada com base na memória | M | regra configurável em `/app/assistente`, respeitando horário e limite anti-flood |
| 2.6 | ✅ **Sugestão automática de FAQ**: perguntas repetidas sem resposta viram sugestões (status `sugerido`) para aprovar | P | aba Conhecimento › Sugestões se preenche sozinha |
| 2.7 | ✅ **Importar do site**: cola a URL e a IA preenche o perfil da empresa e as FAQs (cliente revisa antes de salvar) | M | perfil sai de 0% para mais de 60% com um clique |
| 2.8 | **WhatsApp oficial (Cloud API da Meta)** como alternativa ao WAHA, por conexão | G | empresa conecta número oficial; envio, recebimento e IA funcionam igual |

## Fase 3 — Acabar com as 19 telas de fachada

Regra: **implementar, fundir em outra tela, ou apagar** — nenhuma fica como está.

| Tela | Decisão | Onde fica | Tam. |
|---|---|---|---|
| Calendário *(menu)* ✅ | Implementado (mês) | visão mês/semana de tarefas e reuniões (`tarefas.vence_em` + Google Agenda da 2.3) | M |
| Dashboard Executivo *(menu)* ✅ | Implementado | receita prevista, conversão por etapa, ciclo de venda, IA vs. humano | M |
| Tarefas Recorrentes *(menu)* ✅ | Implementado (agendador a cada 15 min) | dentro de Tarefas, gerada pelo agendador (1.1) | M |
| Checklist de tarefa / Tarefa multi-lead | Fundir | dentro de Tarefas (tabelas `checklist_item`, `tarefa_lead_rel` já existem) | M |
| Templates WhatsApp | Fundir | Respostas rápidas (canal WhatsApp) | P |
| Config. avançada WhatsApp | Fundir | Conexões + Assistente IA (horário e distribuição já existem lá) | P |
| Cadência ✅ | Apagada → Campanhas | Campanhas já tem cadência | P |
| Aprovação de proposta | Fundir | Propostas (fluxo de aprovação + link para o cliente aceitar) | M |
| Previsão IA | Fundir | Pipeline: probabilidade por negócio + previsão do mês | M |
| Funil (editor) | Fundir | Pipeline: editar etapas na própria tela | M |
| Enriquecimento ✅ | Fundido (botão Buscar CNPJ em Contas) | ficha do lead: botão "buscar CNPJ" (BrasilAPI, gratuita) | M |
| Permissões | Fundir | Empresa e equipe (tabela `permissao_tela`), aplicada no menu e no servidor | M |
| Notificações ✅ | Implementado (sino + página, calculado na hora) | sino no topo (tabela `notificacao`): conversa atribuída, tarefa vencendo, SLA estourado | M |
| Integrações ✅ | Fundido (Google Agenda em Assistente IA; resto em Conexões) | Conexões (Google Agenda, Meta Ads, webhooks) | P |
| E-mail de boas-vindas | Fundir | Automações: gatilho "lead criado" → ação "enviar e-mail" | P |
| Gravação de chamada ✅ | Apagada | sem telefonia integrada não há o que gravar | P |
| Assinaturas / Assinatura recorrente ✅ | Escondidas (redirecionam) | só faz sentido quando houver cobrança; esconder | P |

> Fachadas fundidas (Templates WhatsApp, Config. avançada WhatsApp, Integrações, E-mail de boas-vindas, Checklist, Multi-lead, Aprovação de proposta, Previsão IA, Funil, Enriquecimento, Permissões) **saíram do app** e redirecionam para a tela de destino (`next.config.ts › FUNDIDAS`). O recurso de cada uma entra na tela de destino conforme a Fase 4.

## Fase 4 — CRM principal de primeira

| # | Item | Tam. | Pronto quando |
|---|---|---|---|
| 4.1 | **Ficha 360 do lead**: uma linha do tempo com conversas, tarefas, propostas, negócios e o que a IA lembra | M | tudo sobre o cliente numa tela |
| 4.2 | **Importação** de leads por CSV/planilha com mapeamento de colunas e detecção de duplicados | M | importar 1.000 linhas sem erro, duplicados apontados |
| 4.3 ✅ | **Busca global** (leads, empresas, conversas, negócios) na paleta de comandos | P | Ctrl+K acha qualquer registro |
| 4.4 ✅ | Pipeline com arrastar e soltar, filtros salvos e valores por etapa | M | gestor move e filtra sem recarregar |
| 4.5 ✅ | **Alertas de SLA** reais (usa 1.1 + notificações) | P | conversa parada além do SLA notifica o responsável e o gestor |
| 4.6 | Revisão mobile das telas principais (Inbox, Leads, Pipeline, Tarefas) | M | uso completo pelo celular |

## Fase 5 — Agente do CRM "tipo Claude Code"

| # | Item | Tam. | Pronto quando |
|---|---|---|---|
| 5.1 | Ferramentas que faltam: tarefas, propostas, campanhas, automações, conversas do Inbox | M | "crie tarefa de ligar para todos os leads parados há 7 dias" funciona |
| 5.2 | **Plano + confirmação** antes de alterar vários registros (mostra o que vai mudar, usuário aprova) | M | ação em lote só roda depois do "sim" |
| 5.3 | **Desfazer** a última ação do agente | M | botão desfazer reverte o lote |
| 5.4 | Memória do usuário (preferências, metas, jeito de escrever) | P | agente lembra entre conversas |
| 5.5 | Atalhos de comando (`/relatorio`, `/followup`, `/limpar-duplicados`) | P | comandos aparecem ao digitar `/` |

---

## Como cada item é entregue

1. Uma branch por item (ou grupo pequeno), nunca direto na `main`.
2. `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos (regra do `CLAUDE.md`); a partir da 1.3, também `npm test`.
3. Migration nova → `npm run db:setup` → reler o SQL procurando coluna que uma policy usa e a tabela não declara.
4. Roteiro da 0.6 executado no app real antes do merge.
5. Este arquivo atualizado: item marcado como feito, com o hash do commit.

## Ordem recomendada

**Fase 0 → 1.1/1.2 (agendador) → 2.1 (áudio) → Fase 3 (telas do menu primeiro) → resto da Fase 2 → Fase 4 → Fase 5.**
O agendador vem cedo porque destrava cinco itens: 2.5, 4.5, tarefas recorrentes, notificações e cadências.
