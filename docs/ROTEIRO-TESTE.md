# Roteiro de teste manual (antes de cada merge na `main`)

Rodar no app real (VPS ou `npm run dev` apontando para um Supabase de teste), com um
celular de teste com WhatsApp. Marque cada passo; parou num passo = não faz merge.

**Automático primeiro:** `npm run e2e` (Playwright) cobre o que não precisa de celular —
telas públicas, bloqueios, webhooks, importação de CSV, telas principais e o assistente.
Para a parte logada: `E2E_EMAIL=... E2E_SENHA=... npm run e2e` com uma conta de **teste**.
Contra a VPS: `E2E_URL=https://seu-dominio npm run e2e`.

## 1. Conta e empresa
- [ ] Criar conta em `/signup`, confirmar o e-mail, entrar.
- [ ] Onboarding cria a empresa; `/app` abre sem erro.
- [ ] Convidar um segundo usuário como **atendente** (`/app/empresa`); ele entra pelo link do convite.

## 2. Leads e pipeline
- [ ] Criar lead manual com telefone do celular de teste.
- [ ] Importar CSV com 3 linhas (uma com acento, uma com vírgula no nome) — as 3 aparecem.
- [ ] Exportar CSV e abrir no Excel: acentos certos, colunas certas.
- [ ] Criar negócio no pipeline e mover de etapa.

## 3. WhatsApp
- [ ] `/app/conexoes` → "Conectar novo WhatsApp" → QR aparece → ler com o celular → status **Conectado**.
- [ ] (alternativa) "Gerar código" com o número → digitar no celular → conecta.
- [ ] Do celular de teste, mandar "oi" → aparece no Inbox em segundos, ligado ao lead do passo 2.
- [ ] Mandar uma **foto** e um **áudio** → aparecem na bolha e abrem (não "arquivo não encontrado").
- [ ] Responder pelo Inbox → chega no celular; o ✓ vira ✓✓ e fica azul ao ler.
- [ ] Apagar uma mensagem no celular ("apagar para todos") → Inbox mostra "apagada pelo contato".
- [ ] Filtro "Sem responsável" mostra a conversa nova; responder → ela vai para "Minhas conversas".

## 4. Assistente de IA
- [ ] `/app/assistente` abre sem aviso de tabela faltando; preencher Empresa e salvar.
- [ ] Conhecimento: criar uma FAQ ("Qual o horário?" → "8h às 18h").
- [ ] Aba Testar: perguntar o horário → resposta usa a FAQ (fonte aparece).
- [ ] Do celular, perguntar o horário → IA responde em alguns segundos, sem inventar.
- [ ] Pedir "quero falar com um humano" → conversa passa para humano (IA para de responder).
- [ ] Atendente **não** vê modelo/provedor de IA em lugar nenhum.

## 5. Agendador e saúde
- [ ] `docker compose logs agendador` sem erro; em `cron_execucoes` aparece `whatsapp-saude` a cada 5 min com `ok = true`.
- [ ] `docker compose restart waha` → em até 5 min a conexão volta a **Conectado** sem QR.

## 6. Admin
- [ ] `/admin` (e-mail admin): agente ativo, teste do agente responde, limites por empresa salvam.
- [ ] Usuário comum abrindo `/admin` é barrado.

## 7. Novidades desta versão
- [ ] Propostas: criar → "Gerar link" → abrir o link numa janela anônima → aceitar com nome → aparece "aceita por…" e uma tarefa no sino do dono.
- [ ] Empresa e equipe › Permissões: desmarcar "Pipeline" para Atendente → entrar como atendente: some do menu e `/app/pipeline` volta para o início com aviso.
- [ ] Automações: "Lead foi criado" → "Enviar e-mail ao lead" (com canal de e-mail configurado) → criar lead com e-mail → e-mail chega e aparece no Inbox.
- [ ] Tarefas: clicar numa tarefa → adicionar item de checklist e um lead extra.
- [ ] (se usar) WhatsApp oficial: Conexões › WhatsApp oficial → salvar IDs/token/secret → "Conectado"; colar URL e token de verificação no painel da Meta; mensagem do celular chega no Inbox; resposta chega no celular.
