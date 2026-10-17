-- =============================================================
-- Tappo — Bloco 2: tags, propostas, duplicados, score, comissões,
-- campos personalizados, contas/pessoas, tarefas recorrentes, SLA
-- Todas as tabelas novas usam org_id com DEFAULT public.org_atual():
-- nenhuma precisa que a action do app informe org_id manualmente.
-- =============================================================

-- -------------------------------------------------------------
-- Tags de lead / contato
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome        text NOT NULL CHECK (length(trim(nome)) > 0),
  cor         text NOT NULL DEFAULT '#6B7280',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_tags_org ON public.lead_tags (org_id);

CREATE TABLE IF NOT EXISTS public.lead_tag_rel (
  org_id  uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_tag_rel_org ON public.lead_tag_rel (org_id);

-- -------------------------------------------------------------
-- Propostas / orçamentos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propostas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id       uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  titulo        text NOT NULL,
  valor         numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status        text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','visualizado','aceito','rejeitado','expirado')),
  pdf_url       text,
  enviado_em    timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_propostas_org ON public.propostas (org_id);
CREATE INDEX IF NOT EXISTS idx_propostas_lead ON public.propostas (lead_id);

-- -------------------------------------------------------------
-- Detecção de duplicados de lead (telefone/e-mail)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_duplicados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  duplicado_de  uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campo         text NOT NULL CHECK (campo IN ('telefone','email')),
  valor         text NOT NULL,
  resolvido_em  timestamptz,
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_duplicados_org ON public.lead_duplicados (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_duplicados_lead ON public.lead_duplicados (lead_id);

-- -------------------------------------------------------------
-- Tarefas recorrentes
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas_recorrentes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo            text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao         text,
  tipo              text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('ligacao','whatsapp','email','reuniao','visita','outro')),
  prioridade        text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  recorrencia       text NOT NULL DEFAULT 'diaria' CHECK (recorrencia IN ('diaria','semanal','mensal','anual')),
  proxima_execucao  timestamptz NOT NULL,
  ativa             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarefas_recorrentes_org ON public.tarefas_recorrentes (org_id);

-- -------------------------------------------------------------
-- SLA de atendimento
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tempo_resposta_min int NOT NULL DEFAULT 15 CHECK (tempo_resposta_min > 0),
  ativo              boolean NOT NULL DEFAULT true,
  criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_config_org ON public.sla_config (org_id);

-- -------------------------------------------------------------
-- Histórico de alterações por lead
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  usuario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campo       text NOT NULL,
  valor_antigo text,
  valor_novo  text,
  alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_historico_lead ON public.lead_historico (lead_id);

-- -------------------------------------------------------------
-- Score automático de lead
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_score (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score         int NOT NULL CHECK (score BETWEEN 0 AND 100),
  classificacao text NOT NULL DEFAULT 'frio' CHECK (classificacao IN ('frio','morno','quente','qualificado')),
  fatores       jsonb NOT NULL DEFAULT '{}',
  calculado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_score_lead ON public.lead_score (lead_id);

-- -------------------------------------------------------------
-- Comissões por vendedor
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comissoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id        uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  percentual     numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  valor_comissao numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0),
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  mes            date NOT NULL CHECK (extract(day FROM mes) = 1),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comissoes_org ON public.comissoes (org_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_user ON public.comissoes (user_id);

-- -------------------------------------------------------------
-- Campos personalizados por empresa/segmento
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tabela      text NOT NULL CHECK (tabela IN ('leads','deals','contatos')),
  nome        text NOT NULL CHECK (length(trim(nome)) > 0),
  tipo        text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','numero','data','selecao','booleano')),
  opcoes      jsonb,
  obrigatorio boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campos_personalizados_org ON public.campos_personalizados (org_id);

-- -------------------------------------------------------------
-- Contas e Pessoas (empresa vs contato)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(trim(nome)) > 0),
  cnpj_cpf      text,
  segmento      text,
  telefone      text,
  email         text,
  endereco      text,
  cidade        text,
  estado        text,
  cep           text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_org ON public.contas (org_id);

CREATE TABLE IF NOT EXISTS public.pessoas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id          uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  org_id            uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome              text NOT NULL CHECK (length(trim(nome)) > 0),
  cargo             text,
  telefone          text,
  email             text,
  telefone_whatsapp text,
  lider_decisao     boolean NOT NULL DEFAULT false,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoas_org ON public.pessoas (org_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_conta ON public.pessoas (conta_id);

-- -------------------------------------------------------------
-- RLS — todas por empresa (org_id = org_atual()); nenhuma expõe nada ao anon
-- -------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_tags','lead_tag_rel','propostas','lead_duplicados','tarefas_recorrentes',
                           'sla_config','lead_historico','lead_score','comissoes','campos_personalizados',
                           'contas','pessoas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (org_id = (SELECT public.org_atual()))
         WITH CHECK (org_id = (SELECT public.org_atual()))', t || '_org', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
