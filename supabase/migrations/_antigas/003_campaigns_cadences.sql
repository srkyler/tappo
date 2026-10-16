-- =============================================================
-- 003_campaigns_cadences.sql
-- Campanhas de prospecção e suas cadências de contato
-- Relação: 1 campanha → N cadências (etapas da sequência)
-- =============================================================

-- -------------------------------------------------------------
-- Enum: status da campanha
-- -------------------------------------------------------------
CREATE TYPE public.campaign_status AS ENUM (
  'Rascunho',
  'Ativa',
  'Pausada',
  'Concluída'
);

-- -------------------------------------------------------------
-- Enum: canal de contato na cadência
-- -------------------------------------------------------------
CREATE TYPE public.cadence_canal AS ENUM (
  'E-mail',
  'LinkedIn',
  'Telefone',
  'WhatsApp',
  'Videoconf',
  'Outro'
);

-- =============================================================
-- Tabela: campaigns
-- =============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Dono da campanha
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidade
  nome          TEXT NOT NULL,
  descricao     TEXT,

  -- Estado
  status        public.campaign_status NOT NULL DEFAULT 'Rascunho',

  -- Progresso da cadência (etapa_atual vai de 0 a total_etapas)
  etapa_atual   INT NOT NULL DEFAULT 0 CHECK (etapa_atual >= 0),
  total_etapas  INT NOT NULL DEFAULT 0 CHECK (total_etapas >= 0),

  -- Contadores desnormalizados para exibição rápida no dashboard
  -- Atualizados por trigger ou função chamada pela aplicação
  leads_count     INT NOT NULL DEFAULT 0 CHECK (leads_count >= 0),
  respostas_count INT NOT NULL DEFAULT 0 CHECK (respostas_count >= 0),
  reunioes_count  INT NOT NULL DEFAULT 0 CHECK (reunioes_count >= 0),

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaigns IS
  'Campanhas de prospecção. Cada campanha tem uma cadência de N etapas de contato.';
COMMENT ON COLUMN public.campaigns.etapa_atual IS
  'Índice da etapa em andamento (0 = não iniciada). Incrementado pela aplicação.';
COMMENT ON COLUMN public.campaigns.leads_count IS
  'Contador desnormalizado do total de leads associados à campanha.';

-- -------------------------------------------------------------
-- Índices — campaigns
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON public.campaigns (status);

-- -------------------------------------------------------------
-- RLS — campaigns
-- -------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select_own"
  ON public.campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "campaigns_insert_own"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "campaigns_update_own"
  ON public.campaigns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "campaigns_delete_own"
  ON public.campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- Tabela: cadences
-- Cada linha é uma etapa da cadência de uma campanha
-- A ordem das etapas é definida pela coluna `ordem`
-- =============================================================
CREATE TABLE IF NOT EXISTS public.cadences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Herda o user_id da campanha para simplificar RLS sem JOIN
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  -- Descrição da ação (ex: "E-mail de apresentação personalizado")
  acao          TEXT NOT NULL,

  -- Texto de agendamento exibido no UI (ex: "Dia 1", "Dia 3")
  quando        TEXT NOT NULL,

  -- Canal de contato
  canal         public.cadence_canal NOT NULL DEFAULT 'E-mail',

  -- Posição na sequência (1-based)
  ordem         INT NOT NULL DEFAULT 1 CHECK (ordem >= 1),

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ordem única por campanha
  CONSTRAINT cadences_campaign_ordem_unique UNIQUE (campaign_id, ordem)
);

COMMENT ON TABLE public.cadences IS
  'Etapas da cadência de contato de uma campanha. Ordenadas pelo campo `ordem`.';
COMMENT ON COLUMN public.cadences.quando IS
  'Texto descritivo do momento da etapa (ex: "Dia 1", "Dia 7"). Não é uma data absoluta.';

-- -------------------------------------------------------------
-- Índices — cadences
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cadences_user_id     ON public.cadences (user_id);
CREATE INDEX IF NOT EXISTS idx_cadences_campaign_id ON public.cadences (campaign_id);
CREATE INDEX IF NOT EXISTS idx_cadences_canal       ON public.cadences (canal);

-- -------------------------------------------------------------
-- RLS — cadences
-- Política baseada em user_id (copiado da campanha na inserção)
-- -------------------------------------------------------------
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadences_select_own"
  ON public.cadences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "cadences_insert_own"
  ON public.cadences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cadences_update_own"
  ON public.cadences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cadences_delete_own"
  ON public.cadences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_cadences_updated_at ON public.cadences;
CREATE TRIGGER set_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- Tabela: campaign_leads (relação M:N entre campaigns e leads)
-- Registra quais leads estão em qual campanha e em qual etapa
-- =============================================================
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Etapa da cadência em que o lead se encontra (NULL = não iniciado)
  cadence_id    UUID REFERENCES public.cadences(id) ON DELETE SET NULL,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT campaign_leads_unique UNIQUE (campaign_id, lead_id)
);

COMMENT ON TABLE public.campaign_leads IS
  'Associação M:N entre campanhas e leads, com rastreamento da etapa atual da cadência.';

CREATE INDEX IF NOT EXISTS idx_campaign_leads_user_id     ON public.campaign_leads (user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id     ON public.campaign_leads (lead_id);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_leads_select_own"
  ON public.campaign_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaign_leads_insert_own"
  ON public.campaign_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaign_leads_update_own"
  ON public.campaign_leads FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaign_leads_delete_own"
  ON public.campaign_leads FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_campaign_leads_updated_at ON public.campaign_leads;
CREATE TRIGGER set_campaign_leads_updated_at
  BEFORE UPDATE ON public.campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
