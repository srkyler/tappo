-- =============================================================
-- 001_profiles.sql
-- Perfil do usuário — extensão da tabela auth.users do Supabase
-- Criado automaticamente via trigger ao confirmar e-mail
-- =============================================================

-- Habilitar extensão UUID (já disponível no Supabase, mas garante compatibilidade)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- Tabela: profiles
-- Campos extras do usuário além do que o auth.users já possui
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- O id é o mesmo do auth.users, sem coluna user_id separada

  -- Dados pessoais
  nome_completo   TEXT,
  avatar_url      TEXT,

  -- Dados da empresa (SaaS B2B)
  empresa         TEXT,
  cargo           TEXT,
  telefone        TEXT,

  -- Configurações
  onboarding_concluido BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Perfil estendido do usuário — espelha auth.users com dados extras de negócio.';

-- -------------------------------------------------------------
-- Índices
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_empresa ON public.profiles (empresa);

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas o próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuário insere apenas o próprio perfil
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Usuário atualiza apenas o próprio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Usuário pode excluir apenas o próprio perfil
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- -------------------------------------------------------------
-- Trigger: auto-criar perfil ao registrar novo usuário
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome_completo',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Dispara o trigger após inserção em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------
-- Trigger: atualizar updated_at automaticamente
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
