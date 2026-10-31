-- =============================================================
-- Tappo — telas complementares (enriquecimento, previsão, assinaturas,
-- integrações, permissões por tela, notificações, gravação de chamada,
-- checklist e multi-lead de tarefas, templates de WhatsApp, e-mail de
-- boas-vindas, config avançada de WhatsApp).
--
-- Estas tabelas existiam SÓ no setup_completo.sql, coladas à mão (ver Bug 7 de
-- BUGS-TAPP0-CRM.md); regenerar o setup a partir das migrations as apagava.
-- Agora são uma migration versionada, datada antes de 20261027120000 (que altera
-- public.integracao). Ajustes em relação ao original: DROP POLICY IF EXISTS antes
-- de cada CREATE POLICY (o setup pode rodar mais de uma vez) e org_id com
-- DEFAULT public.org_atual().
-- =============================================================


-- =============================================================
-- Enriquecimento automático de leads (CNPJ/LinkedIn)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.enriquecimento_lead (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cnpj_cpf      text,
  razao_social  text,
  nome_fantasia text,
  cnae          text,
  cep           text,
  logradouro    text,
  numero        text,
  bairro        text,
  municipio     text,
  uf            text,
  telefone      text,
  email         text,
  capital_social text,
  porte         text,
  fonte         text,
  enriquecido_em timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enriquecimento_lead_org ON public.enriquecimento_lead (org_id);
CREATE INDEX IF NOT EXISTS idx_enriquecimento_lead ON public.enriquecimento_lead (lead_id);

ALTER TABLE public.enriquecimento_lead ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enriquecimento_lead_org ON public.enriquecimento_lead;
CREATE POLICY enriquecimento_lead_org ON public.enriquecimento_lead FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Previsão de fechamento por IA
-- =============================================================
CREATE TABLE IF NOT EXISTS public.previsao_fechamento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  probabilidade_fechamento int NOT NULL DEFAULT 0 CHECK (probabilidade_fechamento BETWEEN 0 AND 100),
  valor_previsto      numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  prazo_previsto_dias int NOT NULL DEFAULT 0 CHECK (prazo_previsto_dias >= 0),
  fatores             jsonb NOT NULL DEFAULT '{}',
  calculado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_previsao_fechamento_org ON public.previsao_fechamento (org_id);
CREATE INDEX IF NOT EXISTS idx_previsao_fechamento_lead ON public.previsao_fechamento (lead_id);

ALTER TABLE public.previsao_fechamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS previsao_fechamento_org ON public.previsao_fechamento;
CREATE POLICY previsao_fechamento_org ON public.previsao_fechamento FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Assinaturas / receita recorrente
-- =============================================================
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  cliente_id       uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  plano            text NOT NULL,
  valor_mensal     numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0),
  data_inicio      date NOT NULL,
  data_renovacao   date,
  status           text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','cancelada','expirada')),
  dia_cobranca     int NOT NULL DEFAULT 1 CHECK (dia_cobranca BETWEEN 1 AND 31),
  metodo_pagamento text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_org ON public.assinaturas (org_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_cliente ON public.assinaturas (cliente_id);

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assinaturas_org ON public.assinaturas;
CREATE POLICY assinaturas_org ON public.assinaturas FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Integrações externas
-- =============================================================
CREATE TABLE IF NOT EXISTS public.integracao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('google_calendar','google_contacts','zapier','n8n','make')),
  ativo        boolean NOT NULL DEFAULT false,
  configuracao jsonb NOT NULL DEFAULT '{}',
  ultimo_sync  timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integracao_org ON public.integracao (org_id);

ALTER TABLE public.integracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integracao_org ON public.integracao;
CREATE POLICY integracao_org ON public.integracao FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Controle de acesso granular por tela
-- =============================================================
CREATE TABLE IF NOT EXISTS public.permissao_tela (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  papel      text NOT NULL CHECK (papel IN ('dono','gestor','vendedor','atendente')),
  modulo     text NOT NULL,
  pode_ver   boolean NOT NULL DEFAULT true,
  pode_editar boolean NOT NULL DEFAULT true,
  pode_excluir boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permissao_tela_org ON public.permissao_tela (org_id);

ALTER TABLE public.permissao_tela ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissao_tela_org ON public.permissao_tela;
CREATE POLICY permissao_tela_org ON public.permissao_tela FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Notificações toast
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notificacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'info' CHECK (tipo IN ('info','sucesso','aviso','erro')),
  titulo      text NOT NULL,
  mensagem    text NOT NULL,
  lida        boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacao_org ON public.notificacao (org_id);
CREATE INDEX IF NOT EXISTS idx_notificacao_usuario ON public.notificacao (usuario_id);

ALTER TABLE public.notificacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificacao_org ON public.notificacao;
CREATE POLICY notificacao_org ON public.notificacao FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Gravação de chamada
-- =============================================================
CREATE TABLE IF NOT EXISTS public.gravacao_chamada (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  conversa_id    uuid REFERENCES public.wa_conversas(id) ON DELETE SET NULL,
  lead_id        uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  numero         text NOT NULL,
  duracao_seg    int NOT NULL DEFAULT 0 CHECK (duracao_seg >= 0),
  arquivo_url    text,
  transcricao    text,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gravacao_chamada_org ON public.gravacao_chamada (org_id);

ALTER TABLE public.gravacao_chamada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gravacao_chamada_org ON public.gravacao_chamada;
CREATE POLICY gravacao_chamada_org ON public.gravacao_chamada FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- Checklist da tarefa
-- =============================================================
CREATE TABLE IF NOT EXISTS public.checklist_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  titulo      text NOT NULL CHECK (length(trim(titulo)) > 0),
  concluido   boolean NOT NULL DEFAULT false,
  ordem       int NOT NULL DEFAULT 0 CHECK (ordem >= 0)
);
CREATE INDEX IF NOT EXISTS idx_checklist_item_tarefa ON public.checklist_item (tarefa_id);

ALTER TABLE public.checklist_item ENABLE ROW LEVEL SECURITY;
-- tabela-filha: org derivado via tarefas
DROP POLICY IF EXISTS checklist_item_org ON public.checklist_item;
CREATE POLICY checklist_item_org ON public.checklist_item FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = checklist_item.tarefa_id AND t.org_id = (SELECT public.org_atual())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = checklist_item.tarefa_id AND t.org_id = (SELECT public.org_atual())));

-- =============================================================
-- Tarefa vinculada a múltiplos leads
-- =============================================================
CREATE TABLE IF NOT EXISTS public.tarefa_lead_rel (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tarefa_lead_rel_tarefa ON public.tarefa_lead_rel (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_lead_rel_lead ON public.tarefa_lead_rel (lead_id);

ALTER TABLE public.tarefa_lead_rel ENABLE ROW LEVEL SECURITY;
-- tabela-filha: org derivado via tarefas
DROP POLICY IF EXISTS tarefa_lead_rel_org ON public.tarefa_lead_rel;
CREATE POLICY tarefa_lead_rel_org ON public.tarefa_lead_rel FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_lead_rel.tarefa_id AND t.org_id = (SELECT public.org_atual())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_lead_rel.tarefa_id AND t.org_id = (SELECT public.org_atual())));

-- =============================================================
-- WhatsApp Template aprovado
-- =============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_template (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  categoria      text NOT NULL,
  idioma         text NOT NULL DEFAULT 'pt_BR',
  texto          text NOT NULL,
  variaveis      jsonb NOT NULL DEFAULT '[]',
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  waba_template_id text,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_template_org ON public.whatsapp_template (org_id);

ALTER TABLE public.whatsapp_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_template_org ON public.whatsapp_template;
CREATE POLICY whatsapp_template_org ON public.whatsapp_template FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- E-mail de boas-vindas
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_boas_vindas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  assunto     text NOT NULL,
  texto       text NOT NULL,
  variaveis   jsonb NOT NULL DEFAULT '[]',
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_boas_vindas_org ON public.email_boas_vindas (org_id);

ALTER TABLE public.email_boas_vindas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_boas_vindas_org ON public.email_boas_vindas;
CREATE POLICY email_boas_vindas_org ON public.email_boas_vindas FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- =============================================================
-- WhatsApp 100% customizável
-- =============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_config_avancada (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome_instancia       text NOT NULL DEFAULT 'WhatsApp Principal',
  waba_id              text,
  numero_telefone      text,
  qr_code_url          text,
  status_conexao       text NOT NULL DEFAULT 'desconectado' CHECK (status_conexao IN ('desconectado','conectado','qr_pendente','erro')),
  mensagem_boas_vindas text NOT NULL DEFAULT 'Olá! Bem-vindo à nossa empresa. Em que podemos ajudar?',
  mensagem_fora_horario text NOT NULL DEFAULT 'Olá! Nosso horário de atendimento é das 9h às 18h. Retornaremos sua mensagem assim que possível.',
  horario_inicio       text NOT NULL DEFAULT '09:00',
  horario_fim          text NOT NULL DEFAULT '18:00',
  dias_funcionamento   jsonb NOT NULL DEFAULT '["seg","ter","qua","qui","sex"]',
  rodizio_ativo        boolean NOT NULL DEFAULT false,
  distribuicao         text NOT NULL DEFAULT 'manual' CHECK (distribuicao IN ('manual','rodizio','saldo','especialista')),
  usar_ia              boolean NOT NULL DEFAULT false,
  ia_temperatura       numeric(3,2) NOT NULL DEFAULT 0.7 CHECK (ia_temperatura BETWEEN 0 AND 2),
  ia_max_tokens        int NOT NULL DEFAULT 1500 CHECK (ia_max_tokens BETWEEN 256 AND 16000),
  criar_lead_automatico boolean NOT NULL DEFAULT true,
  atualizado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_avancada_org ON public.whatsapp_config_avancada (org_id);

ALTER TABLE public.whatsapp_config_avancada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_config_avancada_org ON public.whatsapp_config_avancada;
CREATE POLICY whatsapp_config_avancada_org ON public.whatsapp_config_avancada FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));

-- Bancos onde as tabelas já existiam: aplica o DEFAULT de org_id
ALTER TABLE public.enriquecimento_lead ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.previsao_fechamento ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.assinaturas ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.integracao ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.permissao_tela ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.notificacao ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.gravacao_chamada ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.whatsapp_template ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.email_boas_vindas ALTER COLUMN org_id SET DEFAULT public.org_atual();
ALTER TABLE public.whatsapp_config_avancada ALTER COLUMN org_id SET DEFAULT public.org_atual();
