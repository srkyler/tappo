-- =============================================================
-- Tappo — sistema operacional de vendas
-- Captação por webhook, respostas rápidas e teto de gasto da IA
-- =============================================================

-- -------------------------------------------------------------
-- Fontes de captação: URL pública que recebe leads (landing, Zapier, n8n)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome           text NOT NULL CHECK (length(trim(nome)) > 0),
  token          text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  origem         public.lead_origem NOT NULL DEFAULT 'Site',
  status_inicial public.lead_status NOT NULL DEFAULT 'Nova',
  ativo          boolean NOT NULL DEFAULT true,
  recebidos      int NOT NULL DEFAULT 0,
  ultimo_em      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_sources_user ON public.lead_sources (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.webhook_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id  uuid REFERENCES public.lead_sources(id) ON DELETE CASCADE,
  ok         boolean NOT NULL,
  resultado  text,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_log_source ON public.webhook_log (source_id, created_at DESC);

-- -------------------------------------------------------------
-- Respostas rápidas (modelos com {{nome}}, {{empresa}}, {{cargo}})
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo     text NOT NULL CHECK (length(trim(titulo)) > 0),
  canal      public.canal NOT NULL DEFAULT 'E-mail',
  assunto    text,
  corpo      text NOT NULL CHECK (length(trim(corpo)) > 0),
  usos       int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON public.templates (user_id, usos DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_sources','templates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_sources_own ON public.lead_sources;
CREATE POLICY lead_sources_own ON public.lead_sources FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS templates_own ON public.templates;
CREATE POLICY templates_own ON public.templates FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- Log: dono só lê; quem escreve é o servidor (service role)
DROP POLICY IF EXISTS webhook_log_select_own ON public.webhook_log;
CREATE POLICY webhook_log_select_own ON public.webhook_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.lead_sources, public.webhook_log, public.templates FROM anon;

-- Modelos iniciais para quem já existe e para novos usuários
CREATE OR REPLACE FUNCTION public.templates_padrao(uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.templates (user_id, titulo, canal, assunto, corpo)
  SELECT uid, x.titulo, x.canal::public.canal, x.assunto, x.corpo
    FROM (VALUES
      ('Primeiro contato', 'E-mail', '{{empresa}} + Tappo',
       'Oi {{nome}}, tudo bem?' || chr(10) || chr(10) || 'Vi que a {{empresa}} está crescendo e queria entender como vocês organizam a prospecção hoje. Tenho uma ideia que pode poupar horas do time comercial.' || chr(10) || chr(10) || 'Faz sentido uma conversa de 15 minutos esta semana?'),
      ('Follow-up curto', 'WhatsApp', NULL,
       'Oi {{nome}}! Passando para retomar nossa conversa. Conseguiu ver minha última mensagem?'),
      ('Conexão LinkedIn', 'LinkedIn', NULL,
       'Olá {{nome}}, acompanho o trabalho da {{empresa}} e gostaria de me conectar para trocar ideias sobre vendas B2B.')
    ) AS x(titulo, canal, assunto, corpo)
   WHERE NOT EXISTS (SELECT 1 FROM public.templates t WHERE t.user_id = uid);
$$;
REVOKE EXECUTE ON FUNCTION public.templates_padrao(uuid) FROM PUBLIC, anon, authenticated;

SELECT public.templates_padrao(id) FROM auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user_templates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.templates_padrao(NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_templates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_templates ON auth.users;
CREATE TRIGGER on_auth_user_created_templates AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_templates();

-- -------------------------------------------------------------
-- Teto de gasto da IA (tokens) — por agente/mês e por membro/dia
-- -------------------------------------------------------------
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS teto_tokens_mes         int CHECK (teto_tokens_mes IS NULL OR teto_tokens_mes > 0),
  ADD COLUMN IF NOT EXISTS teto_tokens_usuario_dia int CHECK (teto_tokens_usuario_dia IS NULL OR teto_tokens_usuario_dia > 0);

CREATE INDEX IF NOT EXISTS idx_ai_uso_agente ON public.ai_uso (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_uso_usuario ON public.ai_uso (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ai_tokens_usados(agente uuid, desde timestamptz, usuario uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(tokens_entrada + tokens_saida), 0)
    FROM public.ai_uso
   WHERE agent_id = agente AND created_at >= desde AND (usuario IS NULL OR user_id = usuario);
$$;
REVOKE EXECUTE ON FUNCTION public.ai_tokens_usados(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
