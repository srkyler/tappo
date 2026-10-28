-- email_log: garante existência + aceita tipo 'convite' (enviado pelo código de convite).
-- Idempotente: pode rodar em projetos onde a versão antiga da tabela já existe.

CREATE TABLE IF NOT EXISTS public.email_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('confirmacao', 'boas_vindas', 'recuperar_senha', 'convite')),
  status       text NOT NULL CHECK (status IN ('enviado', 'falhou')),
  resend_id    text,
  erro         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_log (user_id, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_log_select_own ON public.email_log;
DROP POLICY IF EXISTS "email_log_select_own" ON public.email_log;
CREATE POLICY email_log_select_own ON public.email_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_log_tipo_check'
  ) THEN
    ALTER TABLE public.email_log DROP CONSTRAINT email_log_tipo_check;
    ALTER TABLE public.email_log ADD CONSTRAINT email_log_tipo_check
      CHECK (tipo IN ('confirmacao', 'boas_vindas', 'recuperar_senha', 'convite'));
  END IF;
END $$;
