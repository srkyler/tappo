-- =============================================================
-- Tappo — IA: resumo na transferência, follow-up automático e FAQs sugeridas
--
-- wa_conversas.resumo_ia: quando a IA passa para um humano, deixa um resumo
--   (quem é, o que quer, o que já foi dito, próximo passo) no topo da conversa.
-- wa_conversas.followups / ultimo_followup_em: quantos lembretes a IA já mandou
--   para um cliente que parou de responder (o agendador respeita o limite).
-- ia_perfil.followup_*: a empresa liga e regula o follow-up em /app/assistente.
-- ia_conhecimento.pergunta_origem: FAQ sugerida a partir de uma pergunta que a IA
--   não soube responder e um humano respondeu (evita sugerir a mesma duas vezes).
-- =============================================================

ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS resumo_ia text;
ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS resumo_em timestamptz;
ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS followups int NOT NULL DEFAULT 0;
ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS ultimo_followup_em timestamptz;

ALTER TABLE public.ia_perfil ADD COLUMN IF NOT EXISTS followup_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE public.ia_perfil ADD COLUMN IF NOT EXISTS followup_dias int NOT NULL DEFAULT 2;
ALTER TABLE public.ia_perfil ADD COLUMN IF NOT EXISTS followup_max int NOT NULL DEFAULT 2;
DO $$ BEGIN
  ALTER TABLE public.ia_perfil ADD CONSTRAINT ia_perfil_followup_check CHECK (followup_dias BETWEEN 1 AND 30 AND followup_max BETWEEN 0 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ia_conhecimento ADD COLUMN IF NOT EXISTS pergunta_origem text;
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_origem ON public.ia_conhecimento (org_id, pergunta_origem) WHERE pergunta_origem IS NOT NULL;

-- Candidatas a follow-up: última mensagem é nossa, cliente calado
CREATE INDEX IF NOT EXISTS idx_wa_conversas_followup ON public.wa_conversas (org_id, ultima_em) WHERE status <> 'resolvida';
