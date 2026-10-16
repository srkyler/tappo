-- =============================================================
-- Tappo — login (Google + Resend), papel de admin e agentes de IA
-- Substitui 006_auth_login.sql (que sobrescrevia handle_new_user e
-- deixava novos usuários sem etapas de pipeline).
-- =============================================================

-- -------------------------------------------------------------
-- profiles: campos de autenticação + papel
-- -------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email                  text,
  ADD COLUMN IF NOT EXISTS provedor               text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS ultimo_login_em        timestamptz,
  ADD COLUMN IF NOT EXISTS boas_vindas_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS papel                  text NOT NULL DEFAULT 'membro';

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_papel_check CHECK (papel IN ('membro','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- Novo usuário: perfil (e-mail ou Google) + etapas padrão do pipeline
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo, avatar_url, empresa, provedor)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    NEW.raw_user_meta_data ->> 'empresa',
    coalesce(NEW.raw_app_meta_data ->> 'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE user_id = NEW.id) THEN
    INSERT INTO public.pipeline_stages (user_id, nome, ordem, probabilidade, tipo) VALUES
      (NEW.id, 'Prospecção',  1, 10,  'aberto'),
      (NEW.id, 'Qualificado', 2, 30,  'aberto'),
      (NEW.id, 'Reunião',     3, 50,  'aberto'),
      (NEW.id, 'Proposta',    4, 70,  'aberto'),
      (NEW.id, 'Ganho',       5, 100, 'ganho'),
      (NEW.id, 'Perdido',     6, 0,   'perdido');
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Usuários que já existiam antes deste script: cria perfil e etapas
INSERT INTO public.profiles (id, email, nome_completo, provedor)
SELECT u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'nome_completo', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       coalesce(u.raw_app_meta_data ->> 'provider', 'email')
  FROM auth.users u
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

INSERT INTO public.pipeline_stages (user_id, nome, ordem, probabilidade, tipo)
SELECT u.id, s.nome, s.ordem, s.prob, s.tipo::public.stage_tipo
  FROM auth.users u
 CROSS JOIN (VALUES ('Prospecção',1,10,'aberto'),('Qualificado',2,30,'aberto'),('Reunião',3,50,'aberto'),
                    ('Proposta',4,70,'aberto'),('Ganho',5,100,'ganho'),('Perdido',6,0,'perdido')) AS s(nome, ordem, prob, tipo)
 WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages p WHERE p.user_id = u.id);

-- Membro não consegue se promover: só SQL Editor / service role mudam "papel"
CREATE OR REPLACE FUNCTION public.proteger_papel()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.papel IS DISTINCT FROM OLD.papel AND current_user IN ('authenticated', 'anon') THEN
    NEW.papel := OLD.papel;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_papel ON public.profiles;
CREATE TRIGGER trg_proteger_papel BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_papel();

-- -------------------------------------------------------------
-- email_log: histórico de envios pelo Resend (escrita só pela service role)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('confirmacao', 'boas_vindas', 'recuperar_senha')),
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

-- =============================================================
-- Agentes de IA — gerenciados só pelo admin.
-- RLS ligado e SEM políticas: membros não leem nem escrevem.
-- O servidor acessa com a service role depois de checar o admin.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL CHECK (length(trim(nome)) > 0),
  descricao         text,
  -- 'anthropic' (SDK oficial) ou 'openai' (qualquer API compatível: NVIDIA NIM, OpenAI, Groq, OpenRouter…)
  provedor          text NOT NULL DEFAULT 'anthropic' CHECK (provedor IN ('anthropic','openai')),
  preset            text NOT NULL DEFAULT 'anthropic',
  base_url          text,
  modelo            text NOT NULL CHECK (length(trim(modelo)) > 0),
  -- chave AES-256-GCM (segredo AI_KEYS_SECRET no servidor); nunca volta para o navegador
  api_key_cifrada   text,
  api_key_final     text,
  esforco           text NOT NULL DEFAULT 'low' CHECK (esforco IN ('low','medium','high')),
  max_tokens        int  NOT NULL DEFAULT 1500 CHECK (max_tokens BETWEEN 256 AND 16000),
  temperatura       numeric(3,2) CHECK (temperatura IS NULL OR temperatura BETWEEN 0 AND 2),
  max_historico     int  NOT NULL DEFAULT 10 CHECK (max_historico BETWEEN 2 AND 40),
  instrucoes        text NOT NULL DEFAULT '',
  pode_editar_dados boolean NOT NULL DEFAULT true,
  ativo             boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- No máximo um agente ativo por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_um_ativo ON public.ai_agents (ativo) WHERE ativo;

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_agents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_agents FROM anon, authenticated;

-- Ativar um agente desativa os outros numa transação só
CREATE OR REPLACE FUNCTION public.ativar_agente(agente uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.ai_agents SET ativo = false WHERE ativo AND id <> agente;
  UPDATE public.ai_agents SET ativo = true WHERE id = agente;
END $$;
REVOKE EXECUTE ON FUNCTION public.ativar_agente(uuid) FROM PUBLIC, anon, authenticated;

-- Uso do agente (para o admin acompanhar consumo)
CREATE TABLE IF NOT EXISTS public.ai_uso (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  modelo         text NOT NULL,
  tokens_entrada int  NOT NULL DEFAULT 0,
  tokens_cache   int  NOT NULL DEFAULT 0,
  tokens_saida   int  NOT NULL DEFAULT 0,
  ferramentas    int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_uso_data ON public.ai_uso (created_at DESC);
ALTER TABLE public.ai_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_uso FROM anon, authenticated;

-- Agente inicial (ativo, Claude). Sem chave própria ele usa ANTHROPIC_API_KEY do servidor.
-- Edite, troque de provedor ou crie outros em /admin.
INSERT INTO public.ai_agents (nome, descricao, provedor, preset, modelo, esforco, instrucoes, ativo)
SELECT 'Assistente de Prospecção',
       'Analisa a base, sugere próximos passos e redige mensagens.',
       'anthropic', 'anthropic', 'claude-opus-5-5', 'low',
       'Priorize leads com contato atrasado e negócios parados há mais de 7 dias. Mensagens: tom consultivo, curto, sem jargão.',
       true
 WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents);

-- =============================================================
-- Tornar alguém admin: troque o e-mail e rode a linha abaixo.
-- (Alternativa sem SQL: ADMIN_EMAILS no .env.local)
-- =============================================================
-- UPDATE public.profiles SET papel = 'admin' WHERE lower(email) = lower('seu@email.com');
