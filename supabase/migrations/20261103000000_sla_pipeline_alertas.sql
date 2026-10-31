-- =============================================================
-- Tappo — SLA no pipeline e alertas de SLA no atendimento (plano 4.4 / 4.5)
-- =============================================================

-- Dias máximos de um negócio numa etapa (o código já esperava a coluna)
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS sla_dias int CHECK (sla_dias IS NULL OR sla_dias BETWEEN 1 AND 365);

-- Conversa esperando além do SLA: o agendador avisa UMA vez por espera
ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS sla_alertado_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_wa_conversas_aguardando ON public.wa_conversas (org_id, aguardando_desde)
  WHERE aguardando_desde IS NOT NULL;

-- Quem recebe alerta por e-mail (além do sino)
ALTER TABLE public.sla_config ADD COLUMN IF NOT EXISTS alertar_email boolean NOT NULL DEFAULT true;

-- email_log aceita o alerta de SLA
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_log_tipo_check') THEN
    ALTER TABLE public.email_log DROP CONSTRAINT email_log_tipo_check;
  END IF;
  ALTER TABLE public.email_log ADD CONSTRAINT email_log_tipo_check
    CHECK (tipo IN ('confirmacao', 'boas_vindas', 'recuperar_senha', 'convite', 'alerta_sla'));
END $$;
