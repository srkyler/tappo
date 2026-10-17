-- =============================================================
-- Tappo — telegram_conexoes ganha user_id/distribuicao, no mesmo
-- formato de wa_conexoes, pra reaproveitar distribuir()/conversaDo().
-- =============================================================
ALTER TABLE public.telegram_conexoes
  ADD COLUMN IF NOT EXISTS user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS distribuicao text NOT NULL DEFAULT 'manual';
DO $$ BEGIN
  ALTER TABLE public.telegram_conexoes ADD CONSTRAINT telegram_conexoes_distribuicao_check CHECK (distribuicao IN ('manual','rodizio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
