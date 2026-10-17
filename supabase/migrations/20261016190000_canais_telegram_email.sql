-- =============================================================
-- Tappo — Inbox multicanal: Telegram e E-mail além do WhatsApp.
-- wa_conversas/wa_mensagens ganham "canal" em vez de criar tabelas
-- paralelas: a Inbox já mostra tudo junto, só muda o ícone/origem.
-- =============================================================

ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'whatsapp';
DO $$ BEGIN
  ALTER TABLE public.wa_conversas ADD CONSTRAINT wa_conversas_canal_check CHECK (canal IN ('whatsapp','telegram','instagram','email'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.wa_mensagens ADD CONSTRAINT wa_mensagens_canal_check CHECK (canal IN ('whatsapp','telegram','instagram','email'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_wa_conversas_canal ON public.wa_conversas (org_id, canal);

-- -------------------------------------------------------------
-- Telegram — um bot por empresa
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_conexoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL UNIQUE DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  bot_token_cifrada text,                -- AES-256-GCM (lib/ai/cofre.ts), nunca em texto puro
  bot_username      text,
  webhook_secret    text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status            text NOT NULL DEFAULT 'DESCONHECIDO',
  ia_ativa          boolean NOT NULL DEFAULT false,
  ia_instrucoes     text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- E-mail — endereço de recebimento por empresa (Resend Inbound)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_conexoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL UNIQUE DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  endereco_recebe   text UNIQUE,          -- ex.: empresaXYZ@inbox.suaempresa.com
  endereco_envia    text,                 -- remetente usado nas respostas (Resend "from")
  webhook_secret    text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ia_ativa          boolean NOT NULL DEFAULT false,
  ia_instrucoes     text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['telegram_conexoes','email_conexoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (org_id = (SELECT public.org_atual()))
         WITH CHECK (org_id = (SELECT public.org_atual()))', t || '_org', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
