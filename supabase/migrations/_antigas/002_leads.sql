-- =============================================================
-- 002_leads.sql
-- Base de leads — fichas de prospecção comercial
-- Formato de código: GAR-XXXX (ex: GAR-0241)
-- =============================================================

-- -------------------------------------------------------------
-- Enum: status do lead
-- -------------------------------------------------------------
CREATE TYPE public.lead_status AS ENUM (
  'Nova',
  'Contatado',
  'Qualificado',
  'Reunião',
  'Follow-up',
  'Perdido'
);

-- -------------------------------------------------------------
-- Enum: canal de origem do lead
-- -------------------------------------------------------------
CREATE TYPE public.lead_origem AS ENUM (
  'LinkedIn',
  'Indicação',
  'Evento',
  'Prospecção',
  'Site',
  'Outro'
);

-- -------------------------------------------------------------
-- Tabela: leads
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Vínculo com o usuário dono do lead (obrigatório para RLS)
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Código único visível no UI (formato GAR-XXXX)
  -- Gerado via trigger abaixo; único por user_id
  cod         TEXT NOT NULL,

  -- Dados da ficha
  nome        TEXT NOT NULL,
  empresa     TEXT NOT NULL,
  cargo       TEXT,
  email       TEXT,
  telefone    TEXT,

  -- Classificação
  origem      public.lead_origem NOT NULL DEFAULT 'Prospecção',
  status      public.lead_status NOT NULL DEFAULT 'Nova',

  -- Notas livres (texto longo)
  notas       TEXT,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Código único por usuário
  CONSTRAINT leads_cod_user_unique UNIQUE (user_id, cod)
);

COMMENT ON TABLE public.leads IS
  'Fichas de leads de prospecção. Cada lead pertence a um único usuário.';
COMMENT ON COLUMN public.leads.cod IS
  'Código legível exibido no UI, formato GAR-XXXX (ex: GAR-0241). Gerado automaticamente.';

-- -------------------------------------------------------------
-- Índices para filtros e buscas frequentes
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_user_id   ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_origem    ON public.leads (origem);
CREATE INDEX IF NOT EXISTS idx_leads_empresa   ON public.leads (empresa);
-- Busca full-text por nome + empresa
CREATE INDEX IF NOT EXISTS idx_leads_nome_trgm
  ON public.leads USING GIN (to_tsvector('portuguese', nome || ' ' || empresa));

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own"
  ON public.leads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "leads_insert_own"
  ON public.leads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update_own"
  ON public.leads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_delete_own"
  ON public.leads
  FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Trigger: gerar código GAR-XXXX sequencial por usuário
-- Usa a sequência de leads do usuário para garantir unicidade
-- -------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.leads_cod_seq START 241 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_lead_cod()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INT;
BEGIN
  -- Pega próximo número da sequência global
  next_num := nextval('public.leads_cod_seq');
  NEW.cod := 'GAR-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_lead_cod ON public.leads;
CREATE TRIGGER trg_generate_lead_cod
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  WHEN (NEW.cod IS NULL OR NEW.cod = '')
  EXECUTE FUNCTION public.generate_lead_cod();

-- -------------------------------------------------------------
-- Trigger: updated_at automático
-- (reutiliza a função set_updated_at criada em 001_profiles.sql)
-- -------------------------------------------------------------
DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
