-- =============================================================
-- 005_activities.sql
-- Histórico de atividades — log de ações sobre leads e deals
-- Exibido no feed "Atividade recente" do dashboard
-- =============================================================

-- -------------------------------------------------------------
-- Enum: tipo de atividade (mapeado para ícone no frontend)
-- Prefixo indica o emoji/ícone padrão exibido no UI
-- -------------------------------------------------------------
CREATE TYPE public.activity_tipo AS ENUM (
  'ligacao',        -- 📞  Ligação telefônica
  'email',          -- 📧  E-mail enviado/recebido
  'whatsapp',       -- 💬  Mensagem WhatsApp
  'linkedin',       -- 🔗  Ação no LinkedIn
  'reuniao',        -- 📅  Reunião agendada/realizada
  'nota',           -- 📝  Nota interna
  'importacao',     -- 📂  Importação de leads
  'movimentacao',   -- ✅  Movimentação no pipeline
  'proposta',       -- 📄  Proposta enviada
  'outro'           -- ⚡  Genérico
);

-- -------------------------------------------------------------
-- Tabela: activities
-- Cada linha é uma ação registrada no histórico
-- lead_id e deal_id são opcionais — a atividade pode se referir
-- a um lead, a um deal, a ambos, ou a nenhum (ex: importação)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo de atividade (define o ícone no feed)
  tipo          public.activity_tipo NOT NULL DEFAULT 'outro',

  -- Texto descritivo exibido no feed (ex: "Ligação com Rafael Nunes — demo agendada")
  descricao     TEXT NOT NULL,

  -- Referências opcionais ao contexto da atividade
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id       UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  -- Timestamp da atividade (pode ser retroativo — ex: registrar ligação passada)
  ocorreu_em    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timestamps de criação do registro
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activities IS
  'Feed de atividades recentes por lead e/ou deal. Exibido no dashboard e nas fichas.';
COMMENT ON COLUMN public.activities.tipo IS
  'Tipo da atividade, mapeado para ícone no frontend (emoji ou ícone SVG).';
COMMENT ON COLUMN public.activities.ocorreu_em IS
  'Quando a atividade aconteceu de fato (pode diferir de created_at em registros retroativos).';
COMMENT ON COLUMN public.activities.lead_id IS
  'Lead associado. Nullable — nem toda atividade tem um lead (ex: importação em lote).';
COMMENT ON COLUMN public.activities.deal_id IS
  'Deal associado. Nullable — atividade pode ser apenas sobre um lead.';

-- -------------------------------------------------------------
-- Índices para filtros e feed cronológico
-- -------------------------------------------------------------
-- Feed geral do usuário (ordenado por ocorreu_em DESC)
CREATE INDEX IF NOT EXISTS idx_activities_user_feed
  ON public.activities (user_id, ocorreu_em DESC);

-- Feed por lead (ex: aba de histórico de uma ficha)
CREATE INDEX IF NOT EXISTS idx_activities_lead_id
  ON public.activities (lead_id, ocorreu_em DESC);

-- Feed por deal
CREATE INDEX IF NOT EXISTS idx_activities_deal_id
  ON public.activities (deal_id, ocorreu_em DESC);

-- Filtro por tipo
CREATE INDEX IF NOT EXISTS idx_activities_tipo
  ON public.activities (user_id, tipo);

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select_own"
  ON public.activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "activities_insert_own"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_update_own"
  ON public.activities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_delete_own"
  ON public.activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_activities_updated_at ON public.activities;
CREATE TRIGGER set_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
