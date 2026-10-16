-- =============================================================
-- 006_auth_login.sql
-- Login com Google + e-mails transacionais via Resend
-- =============================================================

-- -------------------------------------------------------------
-- profiles: campos de autenticação
-- -------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email                   TEXT,
  ADD COLUMN IF NOT EXISTS provedor                TEXT NOT NULL DEFAULT 'email', -- 'email' | 'google'
  ADD COLUMN IF NOT EXISTS ultimo_login_em         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boas_vindas_enviada_em  TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- Trigger de criação: entende metadados do cadastro por e-mail E do Google
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo, avatar_url, empresa, provedor)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome_completo',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    ),
    NEW.raw_user_meta_data ->> 'empresa',
    COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------
-- email_log: histórico de envios pelo Resend
-- Escrita só pelo servidor (service role). Usuário lê os próprios.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('confirmacao', 'boas_vindas', 'recuperar_senha')),
  status       TEXT NOT NULL CHECK (status IN ('enviado', 'falhou')),
  resend_id    TEXT,
  erro         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_dest ON public.email_log (lower(destinatario), created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_select_own"
  ON public.email_log
  FOR SELECT
  USING (auth.uid() = user_id);
-- Sem políticas de INSERT/UPDATE/DELETE: só a service role escreve.
