-- WAHA passa a ser configurado no .env do servidor (WAHA_BASE_URL/WAHA_DOMAIN +
-- WAHA_API_KEY); base_url na linha vira opcional (fallback/local).
-- Integração: aceitar Meta Ads (e WhatsApp Cloud no futuro).

ALTER TABLE public.wa_conexoes ALTER COLUMN base_url DROP NOT NULL;
ALTER TABLE public.wa_conexoes DROP CONSTRAINT IF EXISTS wa_conexoes_base_url_check;

ALTER TABLE public.integracao DROP CONSTRAINT IF EXISTS integracao_tipo_check;
ALTER TABLE public.integracao ADD CONSTRAINT integracao_tipo_check
  CHECK (tipo IN ('google_calendar', 'google_contacts', 'zapier', 'n8n', 'make', 'meta_ads', 'whatsapp_cloud'));
