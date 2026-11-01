-- =============================================================
-- Tappo — WhatsApp oficial (Cloud API da Meta) como alternativa ao WAHA,
-- por conexão (plano 2.8). O resto do inbox (conversas, mensagens, IA,
-- atendentes, follow-up) é o mesmo: só o "fio" de envio/recebimento muda.
--
-- Credenciais: o token de acesso e o app secret ficam cifrados (AES-256-GCM,
-- lib/ai/cofre.ts). O webhook da Meta chega em /api/v1/whatsapp-cloud/<token>,
-- é conferido pelo X-Hub-Signature-256 (app secret) e pelo verify_token no GET.
-- =============================================================

ALTER TABLE public.wa_conexoes
  ADD COLUMN IF NOT EXISTS provedor                 text NOT NULL DEFAULT 'waha',
  ADD COLUMN IF NOT EXISTS cloud_phone_number_id    text,
  ADD COLUMN IF NOT EXISTS cloud_waba_id            text,
  ADD COLUMN IF NOT EXISTS cloud_token_cifrado      text,
  ADD COLUMN IF NOT EXISTS cloud_app_secret_cifrado text,
  ADD COLUMN IF NOT EXISTS cloud_verify_token       text;

DO $$ BEGIN
  ALTER TABLE public.wa_conexoes ADD CONSTRAINT wa_conexoes_provedor_check CHECK (provedor IN ('waha','cloud'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Um número oficial só pode estar ligado a uma conexão (senão o webhook não sabe de quem é)
CREATE UNIQUE INDEX IF NOT EXISTS wa_conexoes_cloud_numero ON public.wa_conexoes (cloud_phone_number_id) WHERE cloud_phone_number_id IS NOT NULL;
