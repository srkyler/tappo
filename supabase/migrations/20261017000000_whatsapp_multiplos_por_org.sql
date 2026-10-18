-- =============================================================
-- Tappo — Múltiplos WhatsApp por empresa
-- Remove a unicidade de org_id em wa_conexoes para permitir
-- várias conexões WAHA por organização (ex: suporte, vendas, comercial).
-- =============================================================

-- Remove a constraint UNIQUE (org_id) se existir
DO $$
BEGIN
  ALTER TABLE public.wa_conexoes DROP CONSTRAINT IF EXISTS wa_conexoes_org_key;
EXCEPTION WHEN others THEN NULL; END $$;

-- Remove o índice único associado se existir
DO $$
BEGIN
  DROP INDEX IF EXISTS public.wa_conexoes_org_key_idx;
EXCEPTION WHEN others THEN NULL; END $$;

-- Índice normal (não único) para consulta por org
CREATE INDEX IF NOT EXISTS idx_wa_conexoes_org ON public.wa_conexoes (org_id);

-- Comentário documentando a mudança
COMMENT ON TABLE public.wa_conexoes IS 'Uma ou mais conexões WAHA por organização';
