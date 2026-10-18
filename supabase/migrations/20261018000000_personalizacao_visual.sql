-- =============================================================
-- Tappo — personalização visual: cor de destaque por usuário.
-- A base preto/branco não muda; isso só troca a cor de
-- botões/realces (calcula o texto preto/branco automaticamente
-- no app, não precisa de coluna extra pra isso).
-- =============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cor_destaque text NOT NULL DEFAULT '#FFFFFF';
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_cor_destaque_check CHECK (cor_destaque ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_icone text;
