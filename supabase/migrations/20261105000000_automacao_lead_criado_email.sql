-- =============================================================
-- Tappo — Automações: gatilho "lead criado" e ação "enviar e-mail"
-- (substitui a antiga tela "E-mail de boas-vindas", fundida em Automações).
-- O e-mail sai pelo endereço do canal de e-mail da empresa (email_conexoes)
-- e fica registrado na conversa do lead no inbox.
-- =============================================================

ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check;
ALTER TABLE public.automacoes ADD CONSTRAINT automacoes_gatilho_check
  CHECK (gatilho IN ('lead_mudou_status','lead_entrou_campanha','deal_mudou_etapa','tag_adicionada','lead_criado'));

ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_acao_check;
ALTER TABLE public.automacoes ADD CONSTRAINT automacoes_acao_check
  CHECK (acao IN ('mover_etapa','adicionar_tag','atribuir_responsavel','criar_tarefa','enviar_email'));
