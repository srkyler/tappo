-- =============================================================
-- 004_pipeline.sql
-- Pipeline de vendas: etapas (Kanban) e deals (negociações)
-- Fluxo: Prospecção → Qualificado → Reunião → Proposta → Fechado
-- =============================================================

-- =============================================================
-- Tabela: pipeline_stages
-- Etapas configuráveis do Kanban de pipeline
-- Cada usuário pode ter seu próprio conjunto de etapas
-- =============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Nome exibido na coluna do Kanban
  nome        TEXT NOT NULL,

  -- Posição da coluna (1 = primeira coluna à esquerda)
  ordem       INT NOT NULL DEFAULT 1 CHECK (ordem >= 1),

  -- Cor opcional para identificação visual (hex, ex: '#274B6D')
  cor         TEXT,

  -- Etapa "fechado" marca o fim do funil (deals ganhos)
  is_fechado  BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ordem única por usuário
  CONSTRAINT pipeline_stages_user_ordem_unique UNIQUE (user_id, ordem)
);

COMMENT ON TABLE public.pipeline_stages IS
  'Etapas configuráveis do pipeline de vendas (colunas do Kanban). Ordenadas pelo campo `ordem`.';
COMMENT ON COLUMN public.pipeline_stages.is_fechado IS
  'Quando true, deals nesta etapa são considerados ganhos/fechados.';

-- -------------------------------------------------------------
-- Índices — pipeline_stages
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON public.pipeline_stages (user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_ordem   ON public.pipeline_stages (user_id, ordem);

-- -------------------------------------------------------------
-- RLS — pipeline_stages
-- -------------------------------------------------------------
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_stages_select_own"
  ON public.pipeline_stages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "pipeline_stages_insert_own"
  ON public.pipeline_stages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pipeline_stages_update_own"
  ON public.pipeline_stages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pipeline_stages_delete_own"
  ON public.pipeline_stages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER set_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- Tabela: deals
-- Negociações individuais no pipeline — cards do Kanban
-- =============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Título do deal (ex: "Proposta Moreno Q4")
  nome            TEXT NOT NULL,

  -- Dados da empresa e contato
  empresa         TEXT NOT NULL,
  contato         TEXT,           -- nome do contato principal

  -- Referência ao lead (opcional — deal pode existir sem lead)
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Valor estimado do contrato em BRL
  valor           NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (valor >= 0),

  -- Etapa atual no pipeline
  stage_id        UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,

  -- Dias que o deal está na etapa atual
  -- Calculado pela aplicação ou via função de atualização
  dias_em_etapa   INT NOT NULL DEFAULT 0 CHECK (dias_em_etapa >= 0),

  -- Data em que o deal entrou na etapa atual (para calcular dias_em_etapa)
  etapa_entrada_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Data de fechamento prevista
  data_fechamento_previsto DATE,

  -- Notas / observações
  notas           TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.deals IS
  'Negociações do pipeline de vendas — cards arrastáveis no Kanban.';
COMMENT ON COLUMN public.deals.dias_em_etapa IS
  'Contador de dias desde que o deal entrou na etapa atual. Atualizado pela aplicação.';
COMMENT ON COLUMN public.deals.etapa_entrada_em IS
  'Timestamp de quando o deal entrou na etapa atual. Resetado ao mover de etapa.';

-- -------------------------------------------------------------
-- Índices — deals
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deals_user_id  ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals (stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id  ON public.deals (lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_empresa  ON public.deals (empresa);
-- Para ordenação por valor no dashboard
CREATE INDEX IF NOT EXISTS idx_deals_valor    ON public.deals (user_id, valor DESC);

-- -------------------------------------------------------------
-- RLS — deals
-- -------------------------------------------------------------
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_select_own"
  ON public.deals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deals_insert_own"
  ON public.deals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_update_own"
  ON public.deals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals_delete_own"
  ON public.deals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_deals_updated_at ON public.deals;
CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------
-- Trigger: ao mover deal de etapa, resetar etapa_entrada_em
-- e zerar dias_em_etapa
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se a etapa mudou, reseta o contador de dias
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.etapa_entrada_em := now();
    NEW.dias_em_etapa    := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON public.deals;
CREATE TRIGGER trg_deal_stage_change
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();
