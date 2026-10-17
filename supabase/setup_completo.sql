-- =============================================================
-- Tappo — SETUP COMPLETO
-- Cole tudo no Supabase > SQL Editor > Run. Pode rodar mais de uma vez.
-- Gerado a partir de supabase/migrations/*.sql (em ordem) — não edite à mão.
-- =============================================================


-- >>>>> 20261016000000_tappo_schema.sql

-- =============================================================
-- Tappo — schema completo (substitui 001…005)
-- Multiusuário com RLS: cada usuário só enxerga as próprias linhas.
-- Sem dados de exemplo. Etapas de pipeline padrão são criadas
-- automaticamente no cadastro de cada usuário.
-- =============================================================

-- -------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('Nova','Contatado','Qualificado','Reunião','Follow-up','Perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_origem AS ENUM ('LinkedIn','Indicação','Evento','Prospecção','Site','Outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('Rascunho','Ativa','Pausada','Concluída');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.canal AS ENUM ('E-mail','LinkedIn','Telefone','WhatsApp','Videoconf','Outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_lead_status AS ENUM ('Ativo','Respondeu','Reunião','Concluído','Removido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stage_tipo AS ENUM ('aberto','ganho','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_tipo AS ENUM (
    'ligacao','email','whatsapp','linkedin','reuniao','nota',
    'importacao','movimentacao','proposta','campanha','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------
-- Função utilitária: updated_at
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- =============================================================
-- profiles
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo        text,
  empresa              text,
  cargo                text,
  telefone             text,
  avatar_url           text,
  meta_reunioes_semana int  NOT NULL DEFAULT 5 CHECK (meta_reunioes_semana >= 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- pipeline_stages
-- =============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(trim(nome)) > 0),
  ordem         int  NOT NULL CHECK (ordem >= 1),
  probabilidade int  NOT NULL DEFAULT 0 CHECK (probabilidade BETWEEN 0 AND 100),
  tipo          public.stage_tipo NOT NULL DEFAULT 'aberto',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pipeline_stages_id_user UNIQUE (id, user_id),
  CONSTRAINT pipeline_stages_ordem UNIQUE (user_id, ordem) DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================
-- leads
-- =============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cod                text NOT NULL DEFAULT '',
  nome               text NOT NULL CHECK (length(trim(nome)) > 0),
  empresa            text NOT NULL CHECK (length(trim(empresa)) > 0),
  cargo              text,
  email              text,
  telefone           text,
  linkedin_url       text,
  segmento           text,
  origem             public.lead_origem NOT NULL DEFAULT 'Prospecção',
  status             public.lead_status NOT NULL DEFAULT 'Nova',
  notas              text,
  proximo_contato_em date,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_id_user UNIQUE (id, user_id),
  CONSTRAINT leads_cod_user UNIQUE (user_id, cod)
);

CREATE INDEX IF NOT EXISTS idx_leads_user_status  ON public.leads (user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_user_created ON public.leads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_proximo ON public.leads (user_id, proximo_contato_em);

-- Código GAR-0001 sequencial por usuário
CREATE OR REPLACE FUNCTION public.generate_lead_cod()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  n int;
BEGIN
  IF NEW.cod IS NULL OR NEW.cod = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('lead_cod:' || NEW.user_id::text));
    SELECT coalesce(max(substring(cod FROM 5)::int), 0) + 1 INTO n
      FROM public.leads
     WHERE user_id = NEW.user_id AND cod ~ '^GAR-[0-9]+$';
    NEW.cod := 'GAR-' || lpad(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

-- =============================================================
-- campaigns + campaign_steps (cadência) + campaign_leads
-- =============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL CHECK (length(trim(nome)) > 0),
  descricao   text,
  status      public.campaign_status NOT NULL DEFAULT 'Rascunho',
  iniciada_em timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_id_user UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON public.campaigns (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  ordem       int  NOT NULL CHECK (ordem >= 1),
  dia         int  NOT NULL DEFAULT 1 CHECK (dia >= 0),
  canal       public.canal NOT NULL DEFAULT 'E-mail',
  acao        text NOT NULL CHECK (length(trim(acao)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_steps_campaign FOREIGN KEY (campaign_id, user_id)
    REFERENCES public.campaigns (id, user_id) ON DELETE CASCADE,
  CONSTRAINT campaign_steps_ordem UNIQUE (campaign_id, ordem) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON public.campaign_steps (campaign_id, ordem);

CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id       uuid NOT NULL,
  lead_id           uuid NOT NULL,
  -- quantas etapas da cadência já foram executadas para este lead
  etapas_concluidas int  NOT NULL DEFAULT 0 CHECK (etapas_concluidas >= 0),
  status            public.campaign_lead_status NOT NULL DEFAULT 'Ativo',
  proximo_passo_em  date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_leads_campaign FOREIGN KEY (campaign_id, user_id)
    REFERENCES public.campaigns (id, user_id) ON DELETE CASCADE,
  CONSTRAINT campaign_leads_lead FOREIGN KEY (lead_id, user_id)
    REFERENCES public.leads (id, user_id) ON DELETE CASCADE,
  CONSTRAINT campaign_leads_unique UNIQUE (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON public.campaign_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead     ON public.campaign_leads (lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_proximo  ON public.campaign_leads (user_id, proximo_passo_em);

-- =============================================================
-- deals
-- =============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo                   text NOT NULL CHECK (length(trim(titulo)) > 0),
  empresa                  text NOT NULL CHECK (length(trim(empresa)) > 0),
  contato                  text,
  lead_id                  uuid,
  stage_id                 uuid NOT NULL,
  valor                    numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  data_fechamento_previsto date,
  notas                    text,
  etapa_entrada_em         timestamptz NOT NULL DEFAULT now(),
  fechado_em               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_id_user UNIQUE (id, user_id),
  CONSTRAINT deals_stage FOREIGN KEY (stage_id, user_id)
    REFERENCES public.pipeline_stages (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT deals_lead FOREIGN KEY (lead_id, user_id)
    REFERENCES public.leads (id, user_id) ON DELETE SET NULL (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_deals_user_stage ON public.deals (user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead       ON public.deals (lead_id);

-- =============================================================
-- activities
-- =============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        public.activity_tipo NOT NULL DEFAULT 'outro',
  descricao   text NOT NULL CHECK (length(trim(descricao)) > 0),
  lead_id     uuid,
  deal_id     uuid,
  campaign_id uuid,
  ocorreu_em  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_lead FOREIGN KEY (lead_id, user_id)
    REFERENCES public.leads (id, user_id) ON DELETE SET NULL (lead_id),
  CONSTRAINT activities_deal FOREIGN KEY (deal_id, user_id)
    REFERENCES public.deals (id, user_id) ON DELETE SET NULL (deal_id),
  CONSTRAINT activities_campaign FOREIGN KEY (campaign_id, user_id)
    REFERENCES public.campaigns (id, user_id) ON DELETE SET NULL (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_feed ON public.activities (user_id, ocorreu_em DESC);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON public.activities (lead_id, ocorreu_em DESC);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON public.activities (deal_id, ocorreu_em DESC);
CREATE INDEX IF NOT EXISTS idx_activities_campaign ON public.activities (campaign_id);

-- =============================================================
-- Triggers: updated_at
-- =============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_generate_lead_cod ON public.leads;
CREATE TRIGGER trg_generate_lead_cod
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.generate_lead_cod();

-- =============================================================
-- Triggers: regras de negócio + feed de atividades automático
-- =============================================================

-- Lead criado / status alterado
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (user_id, tipo, descricao, lead_id)
    VALUES (NEW.user_id, 'nota', 'Ficha criada: ' || NEW.nome || ' (' || NEW.empresa || ')', NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activities (user_id, tipo, descricao, lead_id)
    VALUES (NEW.user_id, 'movimentacao',
            NEW.nome || ': ' || OLD.status::text || ' → ' || NEW.status::text, NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_lead ON public.leads;
CREATE TRIGGER trg_log_lead
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_activity();

-- Deal: ao trocar de etapa, reinicia contador e marca fechamento
CREATE OR REPLACE FUNCTION public.handle_deal_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  st public.stage_tipo;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT tipo INTO st FROM public.pipeline_stages WHERE id = NEW.stage_id;
    NEW.etapa_entrada_em := now();
    NEW.fechado_em := CASE WHEN st IN ('ganho','perdido') THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_stage ON public.deals;
CREATE TRIGGER trg_deal_stage
  BEFORE INSERT OR UPDATE OF stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage();

CREATE OR REPLACE FUNCTION public.log_deal_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  nome_etapa text;
BEGIN
  SELECT nome INTO nome_etapa FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (user_id, tipo, descricao, deal_id, lead_id)
    VALUES (NEW.user_id, 'proposta', 'Deal aberto: ' || NEW.titulo || ' em ' || nome_etapa, NEW.id, NEW.lead_id);
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.activities (user_id, tipo, descricao, deal_id, lead_id)
    VALUES (NEW.user_id, 'movimentacao', NEW.titulo || ' movido para ' || nome_etapa, NEW.id, NEW.lead_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_deal ON public.deals;
CREATE TRIGGER trg_log_deal
  AFTER INSERT OR UPDATE OF stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_activity();

-- Campanha: marca início ao ativar
CREATE OR REPLACE FUNCTION public.handle_campaign_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'Ativa' AND NEW.iniciada_em IS NULL THEN
    NEW.iniciada_em := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_campaign_status ON public.campaigns;
CREATE TRIGGER trg_campaign_status
  BEFORE INSERT OR UPDATE OF status ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_campaign_status();

-- Lead entrou na campanha / avançou na cadência / respondeu
CREATE OR REPLACE FUNCTION public.log_campaign_lead_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  c_nome text;
  l_nome text;
BEGIN
  SELECT nome INTO c_nome FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT nome INTO l_nome FROM public.leads WHERE id = NEW.lead_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.user_id, 'campanha', l_nome || ' entrou na campanha ' || c_nome, NEW.lead_id, NEW.campaign_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activities (user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.user_id, CASE WHEN NEW.status = 'Reunião' THEN 'reuniao' ELSE 'campanha' END::public.activity_tipo,
            l_nome || ' · ' || c_nome || ': ' || NEW.status::text, NEW.lead_id, NEW.campaign_id);
  ELSIF NEW.etapas_concluidas > OLD.etapas_concluidas THEN
    INSERT INTO public.activities (user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.user_id, 'campanha',
            l_nome || ' · ' || c_nome || ': etapa ' || NEW.etapas_concluidas || ' executada', NEW.lead_id, NEW.campaign_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_campaign_lead ON public.campaign_leads;
CREATE TRIGGER trg_log_campaign_lead
  AFTER INSERT OR UPDATE OF status, etapas_concluidas ON public.campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.log_campaign_lead_activity();

-- =============================================================
-- Novo usuário: cria perfil + etapas padrão do pipeline
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, empresa)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'nome'),
    NEW.raw_user_meta_data ->> 'empresa'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pipeline_stages (user_id, nome, ordem, probabilidade, tipo) VALUES
    (NEW.id, 'Prospecção',  1, 10,  'aberto'),
    (NEW.id, 'Qualificado', 2, 30,  'aberto'),
    (NEW.id, 'Reunião',     3, 50,  'aberto'),
    (NEW.id, 'Proposta',    4, 70,  'aberto'),
    (NEW.id, 'Ganho',       5, 100, 'ganho'),
    (NEW.id, 'Perdido',     6, 0,   'perdido');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =============================================================
-- RLS — tudo fechado por dono
-- =============================================================
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_own ON public.profiles;
CREATE POLICY profiles_own ON public.profiles
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals','activities']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT auth.uid()) = user_id)
         WITH CHECK ((SELECT auth.uid()) = user_id)', t || '_own', t);
  END LOOP;
END $$;

-- anon não acessa nada
REVOKE ALL ON public.profiles, public.pipeline_stages, public.leads, public.campaigns,
  public.campaign_steps, public.campaign_leads, public.deals, public.activities FROM anon;

-- =============================================================
-- Analytics — agrega tudo do usuário logado num período
-- SECURITY INVOKER: respeita o RLS
-- =============================================================
CREATE OR REPLACE FUNCTION public.analytics_resumo(dias int DEFAULT 30)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH
  periodo AS (
    SELECT now() - make_interval(days => dias) AS ini,
           now() - make_interval(days => dias * 2) AS ini_ant
  ),
  l AS (SELECT * FROM public.leads),
  cl AS (SELECT * FROM public.campaign_leads),
  d AS (
    SELECT d.*, s.tipo AS stage_tipo, s.nome AS stage_nome, s.ordem AS stage_ordem
      FROM public.deals d JOIN public.pipeline_stages s ON s.id = d.stage_id
  ),
  a AS (SELECT * FROM public.activities)
  SELECT jsonb_build_object(
    'leads_periodo',      (SELECT count(*) FROM l, periodo p WHERE l.created_at >= p.ini),
    'leads_anterior',     (SELECT count(*) FROM l, periodo p WHERE l.created_at >= p.ini_ant AND l.created_at < p.ini),
    'leads_total',        (SELECT count(*) FROM l),
    'contatados_periodo', (SELECT count(DISTINCT lead_id) FROM a, periodo p
                            WHERE a.ocorreu_em >= p.ini AND a.lead_id IS NOT NULL
                              AND a.tipo IN ('ligacao','email','whatsapp','linkedin','reuniao','campanha')),
    'respostas_periodo',  (SELECT count(*) FROM cl, periodo p
                            WHERE cl.status IN ('Respondeu','Reunião') AND cl.updated_at >= p.ini),
    'em_campanha_periodo',(SELECT count(*) FROM cl, periodo p WHERE cl.created_at >= p.ini),
    'reunioes_periodo',   (SELECT count(*) FROM a, periodo p WHERE a.tipo = 'reuniao' AND a.ocorreu_em >= p.ini),
    'reunioes_anterior',  (SELECT count(*) FROM a, periodo p WHERE a.tipo = 'reuniao'
                              AND a.ocorreu_em >= p.ini_ant AND a.ocorreu_em < p.ini),
    'ganhos_periodo',     (SELECT count(*) FROM d, periodo p WHERE d.stage_tipo = 'ganho' AND d.fechado_em >= p.ini),
    'valor_ganho_periodo',(SELECT coalesce(sum(valor),0) FROM d, periodo p WHERE d.stage_tipo = 'ganho' AND d.fechado_em >= p.ini),
    'perdidos_periodo',   (SELECT count(*) FROM d, periodo p WHERE d.stage_tipo = 'perdido' AND d.fechado_em >= p.ini),
    'pipeline_aberto',    (SELECT coalesce(sum(valor),0) FROM d WHERE d.stage_tipo = 'aberto'),
    'leads_por_status',   (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                             FROM (SELECT status::text, count(*) n FROM l GROUP BY status) x),
    'leads_por_origem',   (SELECT coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'total', n) ORDER BY n DESC), '[]'::jsonb)
                             FROM (SELECT origem::text, count(*) n FROM l, periodo p WHERE l.created_at >= p.ini GROUP BY origem) x),
    'leads_por_semana',   (SELECT coalesce(jsonb_agg(jsonb_build_object('semana', to_char(s, 'DD/MM'), 'total', n) ORDER BY s), '[]'::jsonb)
                             FROM (
                               SELECT gs AS s,
                                      (SELECT count(*) FROM l WHERE l.created_at >= gs AND l.created_at < gs + interval '7 days') AS n
                                 FROM periodo p,
                                      generate_series(date_trunc('week', p.ini), date_trunc('week', now()), interval '7 days') gs
                             ) x),
    'funil',              (SELECT coalesce(jsonb_agg(jsonb_build_object('etapa', s.nome, 'tipo', s.tipo, 'total',
                                (SELECT count(*) FROM d WHERE d.stage_id = s.id),
                                'valor', (SELECT coalesce(sum(valor),0) FROM d WHERE d.stage_id = s.id)) ORDER BY s.ordem), '[]'::jsonb)
                             FROM public.pipeline_stages s),
    'top_campanhas',      (SELECT coalesce(jsonb_agg(x ORDER BY x.respostas DESC, x.leads DESC), '[]'::jsonb)
                             FROM (
                               SELECT c.nome,
                                      count(cl.id) AS leads,
                                      count(cl.id) FILTER (WHERE cl.status IN ('Respondeu','Reunião')) AS respostas,
                                      count(cl.id) FILTER (WHERE cl.status = 'Reunião') AS reunioes
                                 FROM public.campaigns c LEFT JOIN cl ON cl.campaign_id = c.id
                                GROUP BY c.id, c.nome
                                ORDER BY 3 DESC, 2 DESC
                                LIMIT 5
                             ) x)
  );
$$;

GRANT EXECUTE ON FUNCTION public.analytics_resumo(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_resumo(int) FROM anon, PUBLIC;


-- >>>>> 20261016120000_admin_agentes_ia.sql

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


-- >>>>> 20261016130000_sistema_vendas.sql

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


-- >>>>> 20261016140000_whatsapp_inbox.sql

-- =============================================================
-- Tappo — WhatsApp (WAHA) + Inbox de atendimento
-- Uma conexão WAHA por usuário; conversas e mensagens com RLS por dono.
-- O webhook do WAHA escreve pela service role.
-- =============================================================

-- -------------------------------------------------------------
-- Conexão com o servidor WAHA
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_conexoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url        text NOT NULL CHECK (base_url ~ '^https?://'),
  api_key_cifrada text,                -- AES-256-GCM (lib/ai/cofre.ts)
  sessao          text NOT NULL DEFAULT 'default' CHECK (sessao ~ '^[A-Za-z0-9_-]{1,64}$'),
  token           text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status          text NOT NULL DEFAULT 'DESCONHECIDO',
  numero          text,
  ia_ativa        boolean NOT NULL DEFAULT false,  -- IA responde clientes automaticamente
  ia_instrucoes   text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- Conversas (uma por contato)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_conversas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id         text NOT NULL,
  nome            text,
  telefone        text,
  lead_id         uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','pendente','resolvida')),
  ia_ativa        boolean NOT NULL DEFAULT true,   -- false = humano assumiu
  nao_lidas       int NOT NULL DEFAULT 0,
  ultima_mensagem text,
  ultima_em       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_conversas_user ON public.wa_conversas (user_id, ultima_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversas_lead ON public.wa_conversas (lead_id);

-- -------------------------------------------------------------
-- Mensagens
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_mensagens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.wa_conversas(id) ON DELETE CASCADE,
  waha_id     text,
  direcao     text NOT NULL CHECK (direcao IN ('entrada','saida')),
  autor       text NOT NULL CHECK (autor IN ('contato','humano','ia','celular')),
  tipo        text NOT NULL DEFAULT 'texto',
  corpo       text,
  midia_url   text,
  status      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, waha_id)  -- NULLs não colidem; dedupe dos eventos do WAHA
);
CREATE INDEX IF NOT EXISTS idx_wa_mensagens_conversa ON public.wa_mensagens (conversa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_mensagens_user ON public.wa_mensagens (user_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_conexoes','wa_conversas'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

ALTER TABLE public.wa_conexoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_mensagens ENABLE ROW LEVEL SECURITY;

-- Conexão: dono lê e altera (a chave fica cifrada; a tela nunca a recebe)
DROP POLICY IF EXISTS wa_conexoes_own ON public.wa_conexoes;
CREATE POLICY wa_conexoes_own ON public.wa_conexoes FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wa_conversas_own ON public.wa_conversas;
CREATE POLICY wa_conversas_own ON public.wa_conversas FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wa_mensagens_own ON public.wa_mensagens;
CREATE POLICY wa_mensagens_own ON public.wa_mensagens FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.wa_conexoes, public.wa_conversas, public.wa_mensagens FROM anon;

-- Inbox ao vivo (Realtime respeita o RLS)
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['wa_conversas','wa_mensagens'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;


-- >>>>> 20261016150000_multiempresa.sql

-- =============================================================
-- Tappo — SaaS multiempresa
--  * organizacoes + org_membros (dono/gestor/vendedor/atendente) + convites
--  * org_id em todas as tabelas de negócio; RLS por empresa (org atual)
--  * funil e termos por segmento (odontologia, clínica, TI, imobiliária…)
--  * tarefas, metas e fila/atribuição do inbox
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================

-- -------------------------------------------------------------
-- Empresas e equipe
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL CHECK (length(trim(nome)) > 0),
  segmento   text NOT NULL DEFAULT 'geral',
  plano      text NOT NULL DEFAULT 'teste' CHECK (plano IN ('teste','essencial','profissional','empresa','cancelado')),
  teste_ate  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_membros (
  org_id     uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel      text NOT NULL DEFAULT 'vendedor' CHECK (papel IN ('dono','gestor','vendedor','atendente')),
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_membros_user ON public.org_membros (user_id);

CREATE TABLE IF NOT EXISTS public.org_convites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  email         text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+$'),
  papel         text NOT NULL DEFAULT 'vendedor' CHECK (papel IN ('gestor','vendedor','atendente')),
  token         text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  convidado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aceito_em     timestamptz,
  expira_em     timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_convites_email ON public.org_convites (lower(email)) WHERE aceito_em IS NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_atual uuid REFERENCES public.organizacoes(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.organizacoes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------
-- Contexto do usuário logado
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_atual()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.org_atual
    FROM public.profiles p
    JOIN public.org_membros m ON m.org_id = p.org_atual AND m.user_id = p.id AND m.ativo
   WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.papel_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.papel FROM public.profiles p
    JOIN public.org_membros m ON m.org_id = p.org_atual AND m.user_id = p.id AND m.ativo
   WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.eh_gestor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(public.papel_atual() IN ('dono','gestor'), false);
$$;

GRANT EXECUTE ON FUNCTION public.org_atual(), public.papel_atual(), public.eh_gestor() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.org_atual(), public.papel_atual(), public.eh_gestor() FROM anon, PUBLIC;

-- -------------------------------------------------------------
-- Funil padrão por segmento
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.etapas_do_segmento(seg text)
RETURNS TABLE (nome text, ordem int, probabilidade int, tipo public.stage_tipo)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT x.nome, x.ordem, x.prob, x.tipo::public.stage_tipo FROM (VALUES
    ('geral','Prospecção',1,10,'aberto'),('geral','Qualificado',2,30,'aberto'),('geral','Reunião',3,50,'aberto'),('geral','Proposta',4,70,'aberto'),('geral','Ganho',5,100,'ganho'),('geral','Perdido',6,0,'perdido'),
    ('odontologia','Novo contato',1,10,'aberto'),('odontologia','Avaliação agendada',2,30,'aberto'),('odontologia','Avaliação realizada',3,50,'aberto'),('odontologia','Orçamento enviado',4,65,'aberto'),('odontologia','Tratamento fechado',5,100,'ganho'),('odontologia','Não fechou',6,0,'perdido'),
    ('saude','Novo contato',1,10,'aberto'),('saude','Consulta agendada',2,35,'aberto'),('saude','Consulta realizada',3,55,'aberto'),('saude','Plano proposto',4,70,'aberto'),('saude','Paciente fechado',5,100,'ganho'),('saude','Não fechou',6,0,'perdido'),
    ('estetica','Novo contato',1,10,'aberto'),('estetica','Avaliação agendada',2,35,'aberto'),('estetica','Avaliação realizada',3,55,'aberto'),('estetica','Pacote proposto',4,70,'aberto'),('estetica','Pacote vendido',5,100,'ganho'),('estetica','Não fechou',6,0,'perdido'),
    ('tecnologia','Novo contato',1,10,'aberto'),('tecnologia','Diagnóstico',2,30,'aberto'),('tecnologia','Proposta enviada',3,55,'aberto'),('tecnologia','Negociação',4,75,'aberto'),('tecnologia','Contrato fechado',5,100,'ganho'),('tecnologia','Perdido',6,0,'perdido'),
    ('imobiliaria','Novo lead',1,10,'aberto'),('imobiliaria','Atendimento',2,25,'aberto'),('imobiliaria','Visita agendada',3,45,'aberto'),('imobiliaria','Proposta',4,70,'aberto'),('imobiliaria','Negócio fechado',5,100,'ganho'),('imobiliaria','Perdido',6,0,'perdido'),
    ('educacao','Interessado',1,10,'aberto'),('educacao','Visita / aula experimental',2,35,'aberto'),('educacao','Matrícula em negociação',3,65,'aberto'),('educacao','Matriculado',4,100,'ganho'),('educacao','Desistiu',5,0,'perdido'),
    ('servicos','Novo contato',1,10,'aberto'),('servicos','Orçamento solicitado',2,30,'aberto'),('servicos','Orçamento enviado',3,55,'aberto'),('servicos','Negociação',4,75,'aberto'),('servicos','Vendido',5,100,'ganho'),('servicos','Perdido',6,0,'perdido')
  ) AS x(seg, nome, ordem, prob, tipo)
  WHERE x.seg = CASE WHEN $1 IN ('odontologia','saude','estetica','tecnologia','imobiliaria','educacao','servicos') THEN $1 ELSE 'geral' END;
$$;

-- -------------------------------------------------------------
-- org_id em todas as tabelas de negócio
-- -------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals','activities',
                           'lead_sources','webhook_log','templates','wa_conexoes','wa_conversas','wa_mensagens','ai_uso'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE', t);
  END LOOP;
END $$;

-- Backfill: cada usuário existente sem empresa ganha a sua (como dono)
DO $$
DECLARE u record; nova uuid;
BEGIN
  FOR u IN SELECT p.id, p.empresa, p.nome_completo FROM public.profiles p
            WHERE NOT EXISTS (SELECT 1 FROM public.org_membros m WHERE m.user_id = p.id) LOOP
    INSERT INTO public.organizacoes (nome) VALUES (coalesce(nullif(trim(u.empresa), ''), 'Minha empresa')) RETURNING id INTO nova;
    INSERT INTO public.org_membros (org_id, user_id, papel) VALUES (nova, u.id, 'dono');
    UPDATE public.profiles SET org_atual = nova WHERE id = u.id;
  END LOOP;
  UPDATE public.profiles p SET org_atual = (SELECT m.org_id FROM public.org_membros m WHERE m.user_id = p.id ORDER BY m.created_at LIMIT 1)
   WHERE p.org_atual IS NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals','activities',
                           'lead_sources','webhook_log','templates','wa_conexoes','wa_conversas','wa_mensagens','ai_uso'] LOOP
    EXECUTE format('UPDATE public.%I x SET org_id = p.org_atual FROM public.profiles p WHERE x.org_id IS NULL AND p.id = x.user_id', t);
  END LOOP;
END $$;

-- Preenche org_id em inserts (sessão do usuário ou service role com user_id)
CREATE OR REPLACE FUNCTION public.preencher_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := coalesce(public.org_atual(), (SELECT p.org_atual FROM public.profiles p WHERE p.id = NEW.user_id));
  END IF;
  IF NEW.org_id IS NULL AND TG_TABLE_NAME <> 'ai_uso' THEN RAISE EXCEPTION 'Usuário sem empresa ativa.'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.preencher_org() FROM PUBLIC, anon, authenticated;

-- "aa_" garante que roda antes dos outros BEFORE triggers (ordem alfabética)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals','activities',
                           'lead_sources','webhook_log','templates','wa_conexoes','wa_conversas','wa_mensagens','ai_uso'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS aa_preencher_org ON public.%I', t);
    EXECUTE format('CREATE TRIGGER aa_preencher_org BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.preencher_org()', t);
    IF t <> 'ai_uso' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', t);
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', 'idx_' || t || '_org', t);
  END LOOP;
END $$;

-- Chaves compostas passam de (id, user_id) para (id, org_id): a equipe compartilha dados
ALTER TABLE public.deals          DROP CONSTRAINT IF EXISTS deals_stage, DROP CONSTRAINT IF EXISTS deals_lead;
ALTER TABLE public.activities     DROP CONSTRAINT IF EXISTS activities_lead, DROP CONSTRAINT IF EXISTS activities_deal, DROP CONSTRAINT IF EXISTS activities_campaign;
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_campaign;
ALTER TABLE public.campaign_leads DROP CONSTRAINT IF EXISTS campaign_leads_campaign, DROP CONSTRAINT IF EXISTS campaign_leads_lead;

DO $$
BEGIN
  ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_id_org UNIQUE (id, org_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leads     ADD CONSTRAINT leads_id_org     UNIQUE (id, org_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_id_org UNIQUE (id, org_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.deals     ADD CONSTRAINT deals_id_org     UNIQUE (id, org_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE public.deals ADD CONSTRAINT deals_stage FOREIGN KEY (stage_id, org_id) REFERENCES public.pipeline_stages (id, org_id) ON DELETE RESTRICT;
  ALTER TABLE public.deals ADD CONSTRAINT deals_lead  FOREIGN KEY (lead_id, org_id)  REFERENCES public.leads (id, org_id) ON DELETE SET NULL (lead_id);
  ALTER TABLE public.activities ADD CONSTRAINT activities_lead     FOREIGN KEY (lead_id, org_id)     REFERENCES public.leads (id, org_id)     ON DELETE SET NULL (lead_id);
  ALTER TABLE public.activities ADD CONSTRAINT activities_deal     FOREIGN KEY (deal_id, org_id)     REFERENCES public.deals (id, org_id)     ON DELETE SET NULL (deal_id);
  ALTER TABLE public.activities ADD CONSTRAINT activities_campaign FOREIGN KEY (campaign_id, org_id) REFERENCES public.campaigns (id, org_id) ON DELETE SET NULL (campaign_id);
  ALTER TABLE public.campaign_steps ADD CONSTRAINT campaign_steps_campaign FOREIGN KEY (campaign_id, org_id) REFERENCES public.campaigns (id, org_id) ON DELETE CASCADE;
  ALTER TABLE public.campaign_leads ADD CONSTRAINT campaign_leads_campaign FOREIGN KEY (campaign_id, org_id) REFERENCES public.campaigns (id, org_id) ON DELETE CASCADE;
  ALTER TABLE public.campaign_leads ADD CONSTRAINT campaign_leads_lead     FOREIGN KEY (lead_id, org_id)     REFERENCES public.leads (id, org_id)     ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unicidades por empresa
ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_ordem;
DO $$ BEGIN ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_ordem_org UNIQUE (org_id, ordem) DEFERRABLE INITIALLY DEFERRED; EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_cod_user;
DO $$ BEGIN ALTER TABLE public.leads ADD CONSTRAINT leads_cod_org UNIQUE (org_id, cod); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
ALTER TABLE public.wa_conexoes DROP CONSTRAINT IF EXISTS wa_conexoes_user_id_key;
DO $$ BEGIN ALTER TABLE public.wa_conexoes ADD CONSTRAINT wa_conexoes_org_key UNIQUE (org_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
ALTER TABLE public.wa_conversas DROP CONSTRAINT IF EXISTS wa_conversas_user_id_chat_id_key;
DO $$ BEGIN ALTER TABLE public.wa_conversas ADD CONSTRAINT wa_conversas_org_chat_key UNIQUE (org_id, chat_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
ALTER TABLE public.wa_mensagens DROP CONSTRAINT IF EXISTS wa_mensagens_user_id_waha_id_key;
DO $$ BEGIN ALTER TABLE public.wa_mensagens ADD CONSTRAINT wa_mensagens_org_waha_key UNIQUE (org_id, waha_id); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- Código do lead sequencial por empresa
CREATE OR REPLACE FUNCTION public.generate_lead_cod()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE n int;
BEGIN
  IF NEW.cod IS NULL OR NEW.cod = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('lead_cod:' || NEW.org_id::text));
    SELECT coalesce(max(substring(cod FROM 5)::int), 0) + 1 INTO n
      FROM public.leads WHERE org_id = NEW.org_id AND cod ~ '^GAR-[0-9]+$';
    NEW.cod := 'GAR-' || lpad(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

-- Atividades automáticas herdam a empresa do registro
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id)
    VALUES (NEW.org_id, NEW.user_id, 'nota', 'Ficha criada: ' || NEW.nome || ' (' || NEW.empresa || ')', NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id)
    VALUES (NEW.org_id, coalesce(auth.uid(), NEW.user_id), 'movimentacao', NEW.nome || ': ' || OLD.status::text || ' → ' || NEW.status::text, NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_deal_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE nome_etapa text;
BEGIN
  SELECT nome INTO nome_etapa FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, deal_id, lead_id)
    VALUES (NEW.org_id, NEW.user_id, 'proposta', 'Negócio aberto: ' || NEW.titulo || ' em ' || nome_etapa, NEW.id, NEW.lead_id);
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, deal_id, lead_id)
    VALUES (NEW.org_id, coalesce(auth.uid(), NEW.user_id), 'movimentacao', NEW.titulo || ' movido para ' || nome_etapa, NEW.id, NEW.lead_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_campaign_lead_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c_nome text; l_nome text;
BEGIN
  SELECT nome INTO c_nome FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT nome INTO l_nome FROM public.leads WHERE id = NEW.lead_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.org_id, NEW.user_id, 'campanha', l_nome || ' entrou na campanha ' || c_nome, NEW.lead_id, NEW.campaign_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.org_id, NEW.user_id, CASE WHEN NEW.status = 'Reunião' THEN 'reuniao' ELSE 'campanha' END::public.activity_tipo,
            l_nome || ' · ' || c_nome || ': ' || NEW.status::text, NEW.lead_id, NEW.campaign_id);
  ELSIF NEW.etapas_concluidas > OLD.etapas_concluidas THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id, campaign_id)
    VALUES (NEW.org_id, NEW.user_id, 'campanha', l_nome || ' · ' || c_nome || ': etapa ' || NEW.etapas_concluidas || ' executada', NEW.lead_id, NEW.campaign_id);
  END IF;
  RETURN NEW;
END $$;

-- -------------------------------------------------------------
-- Tarefas e metas
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  responsavel_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id        uuid,
  deal_id        uuid,
  conversa_id    uuid REFERENCES public.wa_conversas(id) ON DELETE SET NULL,
  titulo         text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao      text,
  tipo           text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('ligacao','whatsapp','email','reuniao','visita','outro')),
  prioridade     text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  vence_em       timestamptz,
  concluida_em   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarefas_lead FOREIGN KEY (lead_id, org_id) REFERENCES public.leads (id, org_id) ON DELETE SET NULL (lead_id),
  CONSTRAINT tarefas_deal FOREIGN KEY (deal_id, org_id) REFERENCES public.deals (id, org_id) ON DELETE SET NULL (deal_id)
);
CREATE INDEX IF NOT EXISTS idx_tarefas_resp ON public.tarefas (org_id, responsavel_id, concluida_em, vence_em);
CREATE INDEX IF NOT EXISTS idx_tarefas_lead ON public.tarefas (lead_id);

CREATE TABLE IF NOT EXISTS public.metas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- vendedor
  mes         date NOT NULL CHECK (extract(day FROM mes) = 1),
  meta_valor  numeric(15,2) NOT NULL DEFAULT 0 CHECK (meta_valor >= 0),
  meta_vendas int NOT NULL DEFAULT 0 CHECK (meta_vendas >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, mes)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tarefas','metas'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS aa_preencher_org ON public.tarefas;
CREATE TRIGGER aa_preencher_org BEFORE INSERT ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.preencher_org();

-- Tarefa concluída entra na linha do tempo do lead
CREATE OR REPLACE FUNCTION public.log_tarefa_concluida()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.concluida_em IS NOT NULL AND OLD.concluida_em IS NULL AND (NEW.lead_id IS NOT NULL OR NEW.deal_id IS NOT NULL) THEN
    INSERT INTO public.activities (org_id, user_id, tipo, descricao, lead_id, deal_id)
    VALUES (NEW.org_id, coalesce(auth.uid(), NEW.user_id),
            CASE NEW.tipo WHEN 'ligacao' THEN 'ligacao' WHEN 'whatsapp' THEN 'whatsapp' WHEN 'email' THEN 'email' WHEN 'reuniao' THEN 'reuniao' ELSE 'nota' END::public.activity_tipo,
            'Tarefa concluída: ' || NEW.titulo, NEW.lead_id, NEW.deal_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_tarefa ON public.tarefas;
CREATE TRIGGER trg_log_tarefa AFTER UPDATE OF concluida_em ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.log_tarefa_concluida();

-- -------------------------------------------------------------
-- Inbox: atribuição, fila e tempo de resposta
-- -------------------------------------------------------------
ALTER TABLE public.wa_conversas
  ADD COLUMN IF NOT EXISTS atribuido_a      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aguardando_desde timestamptz;
CREATE INDEX IF NOT EXISTS idx_wa_conversas_atrib ON public.wa_conversas (org_id, atribuido_a, status);
ALTER TABLE public.wa_mensagens
  ADD COLUMN IF NOT EXISTS enviado_por        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tempo_resposta_seg int;
ALTER TABLE public.wa_conexoes
  ADD COLUMN IF NOT EXISTS distribuicao text NOT NULL DEFAULT 'manual';
DO $$ BEGIN
  ALTER TABLE public.wa_conexoes ADD CONSTRAINT wa_conexoes_distribuicao_check CHECK (distribuicao IN ('manual','rodizio'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Próximo atendente no rodízio: quem tem menos conversas abertas
CREATE OR REPLACE FUNCTION public.proximo_atendente(org uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.user_id FROM public.org_membros m
   WHERE m.org_id = org AND m.ativo AND m.papel IN ('vendedor','atendente','gestor','dono')
   ORDER BY (SELECT count(*) FROM public.wa_conversas c WHERE c.org_id = org AND c.atribuido_a = m.user_id AND c.status <> 'resolvida'),
            (m.papel IN ('vendedor','atendente')) DESC, m.created_at
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.proximo_atendente(uuid) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------
-- RLS por empresa
-- -------------------------------------------------------------
ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_membros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','leads','campaigns','campaign_steps','campaign_leads','deals','activities',
                           'lead_sources','templates','wa_conexoes','wa_conversas','wa_mensagens','tarefas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (org_id = (SELECT public.org_atual()))
         WITH CHECK (org_id = (SELECT public.org_atual()))', t || '_org', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS webhook_log_select_own ON public.webhook_log;
DROP POLICY IF EXISTS webhook_log_select_org ON public.webhook_log;
CREATE POLICY webhook_log_select_org ON public.webhook_log FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));

-- Metas: equipe lê; só gestor altera
DROP POLICY IF EXISTS metas_select ON public.metas;
CREATE POLICY metas_select ON public.metas FOR SELECT TO authenticated USING (org_id = (SELECT public.org_atual()));
DROP POLICY IF EXISTS metas_gestor ON public.metas;
CREATE POLICY metas_gestor ON public.metas FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))
  WITH CHECK (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()));

-- Empresas: membro vê as suas; gestor edita a atual
DROP POLICY IF EXISTS organizacoes_membro ON public.organizacoes;
CREATE POLICY organizacoes_membro ON public.organizacoes FOR SELECT TO authenticated
  USING (id IN (SELECT m.org_id FROM public.org_membros m WHERE m.user_id = (SELECT auth.uid()) AND m.ativo));
DROP POLICY IF EXISTS organizacoes_gestor ON public.organizacoes;
CREATE POLICY organizacoes_gestor ON public.organizacoes FOR UPDATE TO authenticated
  USING (id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))
  WITH CHECK (id = (SELECT public.org_atual()));

-- Membros e convites: leitura pela equipe; escrita pelo servidor (actions com checagem de papel)
DROP POLICY IF EXISTS org_membros_select ON public.org_membros;
CREATE POLICY org_membros_select ON public.org_membros FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()) OR user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS org_convites_gestor ON public.org_convites;
CREATE POLICY org_convites_gestor ON public.org_convites FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()));

-- Colegas de equipe se enxergam (nome/avatar) para atribuição e ranking
DROP POLICY IF EXISTS profiles_equipe ON public.profiles;
CREATE POLICY profiles_equipe ON public.profiles FOR SELECT TO authenticated
  USING (id IN (SELECT m.user_id FROM public.org_membros m WHERE m.org_id = (SELECT public.org_atual())));

-- Membro só troca org_atual para uma empresa da qual participa
CREATE OR REPLACE FUNCTION public.proteger_org_atual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.org_atual IS DISTINCT FROM OLD.org_atual AND NEW.org_atual IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.org_membros m WHERE m.org_id = NEW.org_atual AND m.user_id = NEW.id AND m.ativo) THEN
    NEW.org_atual := OLD.org_atual;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_org_atual ON public.profiles;
CREATE TRIGGER trg_proteger_org_atual BEFORE UPDATE OF org_atual ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_org_atual();

REVOKE ALL ON public.organizacoes, public.org_membros, public.org_convites, public.tarefas, public.metas FROM anon;

-- -------------------------------------------------------------
-- Novo usuário: aceita convite pendente OU cria a própria empresa
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE conv record; nova uuid; seg text;
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo, avatar_url, empresa, provedor)
  VALUES (
    NEW.id, NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    NEW.raw_user_meta_data ->> 'empresa',
    coalesce(NEW.raw_app_meta_data ->> 'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO conv FROM public.org_convites
   WHERE lower(email) = lower(NEW.email) AND aceito_em IS NULL AND expira_em > now()
   ORDER BY created_at DESC LIMIT 1;

  IF conv.id IS NOT NULL THEN
    INSERT INTO public.org_membros (org_id, user_id, papel) VALUES (conv.org_id, NEW.id, conv.papel) ON CONFLICT DO NOTHING;
    UPDATE public.org_convites SET aceito_em = now() WHERE id = conv.id;
    UPDATE public.profiles SET org_atual = conv.org_id WHERE id = NEW.id;
  ELSE
    seg := coalesce(NEW.raw_user_meta_data ->> 'segmento', 'geral');
    INSERT INTO public.organizacoes (nome, segmento)
    VALUES (coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'empresa'), ''), 'Minha empresa'), seg)
    RETURNING id INTO nova;
    INSERT INTO public.org_membros (org_id, user_id, papel) VALUES (nova, NEW.id, 'dono');
    UPDATE public.profiles SET org_atual = nova WHERE id = NEW.id;
    INSERT INTO public.pipeline_stages (org_id, user_id, nome, ordem, probabilidade, tipo)
    SELECT nova, NEW.id, e.nome, e.ordem, e.probabilidade, e.tipo FROM public.etapas_do_segmento(seg) e;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Respostas rápidas iniciais: uma vez por empresa
CREATE OR REPLACE FUNCTION public.templates_padrao(uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.templates (org_id, user_id, titulo, canal, assunto, corpo)
  SELECT p.org_atual, uid, x.titulo, x.canal::public.canal, x.assunto, x.corpo
    FROM public.profiles p,
    (VALUES
      ('Primeiro contato', 'WhatsApp', NULL,
       'Oi {{nome}}, tudo bem? Aqui é da equipe. Vi seu interesse e queria entender melhor o que você precisa. Posso te ajudar agora?'),
      ('Follow-up curto', 'WhatsApp', NULL,
       'Oi {{nome}}! Passando para retomar nossa conversa. Conseguiu ver minha última mensagem?'),
      ('Proposta / orçamento', 'E-mail', 'Sua proposta',
       'Olá {{nome}},' || chr(10) || chr(10) || 'Conforme conversamos, segue a proposta. Fico à disposição para tirar qualquer dúvida.' || chr(10) || chr(10) || 'Podemos confirmar esta semana?')
    ) AS x(titulo, canal, assunto, corpo)
   WHERE p.id = uid AND p.org_atual IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.templates t WHERE t.org_id = p.org_atual);
$$;
REVOKE EXECUTE ON FUNCTION public.templates_padrao(uuid) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------
-- Painel do gestor (SECURITY INVOKER: respeita o RLS da empresa)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_gestor(dias int DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH p AS (SELECT now() - make_interval(days => dias) AS ini, date_trunc('month', now())::date AS mes),
  d AS (SELECT d.*, s.tipo AS st, s.probabilidade AS prob FROM public.deals d JOIN public.pipeline_stages s ON s.id = d.stage_id),
  eq AS (
    SELECT m.user_id, m.papel, coalesce(pr.nome_completo, split_part(pr.email, '@', 1), 'Membro') AS nome, pr.avatar_url
      FROM public.org_membros m LEFT JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.org_id = public.org_atual() AND m.ativo
  )
  SELECT jsonb_build_object(
    'ganho_valor',     (SELECT coalesce(sum(valor), 0) FROM d, p WHERE st = 'ganho' AND fechado_em >= p.ini),
    'ganho_qtd',       (SELECT count(*) FROM d, p WHERE st = 'ganho' AND fechado_em >= p.ini),
    'perdido_qtd',     (SELECT count(*) FROM d, p WHERE st = 'perdido' AND fechado_em >= p.ini),
    'aberto_valor',    (SELECT coalesce(sum(valor), 0) FROM d WHERE st = 'aberto'),
    'previsao',        (SELECT coalesce(sum(valor * prob / 100.0), 0) FROM d WHERE st = 'aberto'),
    'previsao_meses',  (SELECT coalesce(jsonb_agg(x ORDER BY x.mes), '[]'::jsonb) FROM (
                          SELECT to_char(date_trunc('month', coalesce(data_fechamento_previsto, now()::date)), 'YYYY-MM') AS mes,
                                 sum(valor * prob / 100.0) AS ponderado, sum(valor) AS bruto, count(*) AS qtd
                            FROM d WHERE st = 'aberto' GROUP BY 1 ORDER BY 1 LIMIT 6) x),
    'funil',           (SELECT coalesce(jsonb_agg(jsonb_build_object('etapa', s.nome, 'tipo', s.tipo,
                          'qtd', (SELECT count(*) FROM d WHERE d.stage_id = s.id),
                          'valor', (SELECT coalesce(sum(valor), 0) FROM d WHERE d.stage_id = s.id)) ORDER BY s.ordem), '[]'::jsonb)
                          FROM public.pipeline_stages s),
    'inbox',           jsonb_build_object(
                          'abertas',        (SELECT count(*) FROM public.wa_conversas WHERE status <> 'resolvida'),
                          'sem_responsavel',(SELECT count(*) FROM public.wa_conversas WHERE status <> 'resolvida' AND atribuido_a IS NULL),
                          'aguardando',     (SELECT count(*) FROM public.wa_conversas WHERE aguardando_desde IS NOT NULL AND status <> 'resolvida'),
                          'aguardando_15m', (SELECT count(*) FROM public.wa_conversas WHERE aguardando_desde < now() - interval '15 minutes' AND status <> 'resolvida'),
                          'tempo_medio_seg',(SELECT round(avg(tempo_resposta_seg)) FROM public.wa_mensagens m, p WHERE m.created_at >= p.ini AND m.tempo_resposta_seg IS NOT NULL),
                          'novas',          (SELECT count(*) FROM public.wa_conversas c, p WHERE c.created_at >= p.ini)),
    'equipe',          (SELECT coalesce(jsonb_agg(x ORDER BY x.ganho_valor DESC, x.atividades DESC), '[]'::jsonb) FROM (
                          SELECT eq.user_id, eq.nome, eq.papel, eq.avatar_url,
                            (SELECT coalesce(sum(valor), 0) FROM d, p WHERE d.user_id = eq.user_id AND st = 'ganho' AND fechado_em >= p.ini) AS ganho_valor,
                            (SELECT count(*) FROM d, p WHERE d.user_id = eq.user_id AND st = 'ganho' AND fechado_em >= p.ini) AS ganho_qtd,
                            (SELECT coalesce(sum(valor), 0) FROM d WHERE d.user_id = eq.user_id AND st = 'aberto') AS aberto_valor,
                            (SELECT count(*) FROM public.activities a, p WHERE a.user_id = eq.user_id AND a.ocorreu_em >= p.ini
                                AND a.tipo IN ('ligacao','email','whatsapp','linkedin','reuniao')) AS atividades,
                            (SELECT count(*) FROM public.tarefas t, p WHERE t.responsavel_id = eq.user_id AND t.concluida_em >= p.ini) AS tarefas_feitas,
                            (SELECT count(*) FROM public.tarefas t WHERE t.responsavel_id = eq.user_id AND t.concluida_em IS NULL AND t.vence_em < now()) AS tarefas_atrasadas,
                            (SELECT count(*) FROM public.wa_conversas c WHERE c.atribuido_a = eq.user_id AND c.status <> 'resolvida') AS conversas_abertas,
                            (SELECT round(avg(m.tempo_resposta_seg)) FROM public.wa_mensagens m, p WHERE m.enviado_por = eq.user_id AND m.created_at >= p.ini) AS tempo_resposta_seg,
                            (SELECT mt.meta_valor FROM public.metas mt, p WHERE mt.user_id = eq.user_id AND mt.mes = p.mes) AS meta_valor,
                            (SELECT coalesce(sum(valor), 0) FROM d, p WHERE d.user_id = eq.user_id AND st = 'ganho' AND fechado_em >= p.mes) AS ganho_mes
                          FROM eq) x)
  );
$$;
GRANT EXECUTE ON FUNCTION public.painel_gestor(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.painel_gestor(int) FROM anon, PUBLIC;

-- Realtime das tarefas (lembretes ao vivo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tarefas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;
  END IF;
END $$;


-- >>>>> 20261016160000_bloco2_schema.sql

-- =============================================================
-- Tappo — Bloco 2: tags, propostas, duplicados, score, comissões,
-- campos personalizados, contas/pessoas, tarefas recorrentes, SLA
-- Todas as tabelas novas usam org_id com DEFAULT public.org_atual():
-- nenhuma precisa que a action do app informe org_id manualmente.
-- =============================================================

-- -------------------------------------------------------------
-- Tags de lead / contato
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome        text NOT NULL CHECK (length(trim(nome)) > 0),
  cor         text NOT NULL DEFAULT '#6B7280',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_tags_org ON public.lead_tags (org_id);

CREATE TABLE IF NOT EXISTS public.lead_tag_rel (
  org_id  uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_tag_rel_org ON public.lead_tag_rel (org_id);

-- -------------------------------------------------------------
-- Propostas / orçamentos
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propostas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id       uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  titulo        text NOT NULL,
  valor         numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status        text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','visualizado','aceito','rejeitado','expirado')),
  pdf_url       text,
  enviado_em    timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_propostas_org ON public.propostas (org_id);
CREATE INDEX IF NOT EXISTS idx_propostas_lead ON public.propostas (lead_id);

-- -------------------------------------------------------------
-- Detecção de duplicados de lead (telefone/e-mail)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_duplicados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  duplicado_de  uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campo         text NOT NULL CHECK (campo IN ('telefone','email')),
  valor         text NOT NULL,
  resolvido_em  timestamptz,
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_duplicados_org ON public.lead_duplicados (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_duplicados_lead ON public.lead_duplicados (lead_id);

-- -------------------------------------------------------------
-- Tarefas recorrentes
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas_recorrentes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo            text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao         text,
  tipo              text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('ligacao','whatsapp','email','reuniao','visita','outro')),
  prioridade        text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  recorrencia       text NOT NULL DEFAULT 'diaria' CHECK (recorrencia IN ('diaria','semanal','mensal','anual')),
  proxima_execucao  timestamptz NOT NULL,
  ativa             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarefas_recorrentes_org ON public.tarefas_recorrentes (org_id);

-- -------------------------------------------------------------
-- SLA de atendimento
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tempo_resposta_min int NOT NULL DEFAULT 15 CHECK (tempo_resposta_min > 0),
  ativo              boolean NOT NULL DEFAULT true,
  criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_config_org ON public.sla_config (org_id);

-- -------------------------------------------------------------
-- Histórico de alterações por lead
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  usuario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campo       text NOT NULL,
  valor_antigo text,
  valor_novo  text,
  alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_historico_lead ON public.lead_historico (lead_id);

-- -------------------------------------------------------------
-- Score automático de lead
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_score (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score         int NOT NULL CHECK (score BETWEEN 0 AND 100),
  classificacao text NOT NULL DEFAULT 'frio' CHECK (classificacao IN ('frio','morno','quente','qualificado')),
  fatores       jsonb NOT NULL DEFAULT '{}',
  calculado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_score_lead ON public.lead_score (lead_id);

-- -------------------------------------------------------------
-- Comissões por vendedor
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comissoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id        uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  percentual     numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  valor_comissao numeric(15,2) NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0),
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  mes            date NOT NULL CHECK (extract(day FROM mes) = 1),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comissoes_org ON public.comissoes (org_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_user ON public.comissoes (user_id);

-- -------------------------------------------------------------
-- Campos personalizados por empresa/segmento
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tabela      text NOT NULL CHECK (tabela IN ('leads','deals','contatos')),
  nome        text NOT NULL CHECK (length(trim(nome)) > 0),
  tipo        text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','numero','data','selecao','booleano')),
  opcoes      jsonb,
  obrigatorio boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campos_personalizados_org ON public.campos_personalizados (org_id);

-- -------------------------------------------------------------
-- Contas e Pessoas (empresa vs contato)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(trim(nome)) > 0),
  cnpj_cpf      text,
  segmento      text,
  telefone      text,
  email         text,
  endereco      text,
  cidade        text,
  estado        text,
  cep           text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_org ON public.contas (org_id);

CREATE TABLE IF NOT EXISTS public.pessoas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id          uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  org_id            uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome              text NOT NULL CHECK (length(trim(nome)) > 0),
  cargo             text,
  telefone          text,
  email             text,
  telefone_whatsapp text,
  lider_decisao     boolean NOT NULL DEFAULT false,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoas_org ON public.pessoas (org_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_conta ON public.pessoas (conta_id);

-- -------------------------------------------------------------
-- RLS — todas por empresa (org_id = org_atual()); nenhuma expõe nada ao anon
-- -------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_tags','lead_tag_rel','propostas','lead_duplicados','tarefas_recorrentes',
                           'sla_config','lead_historico','lead_score','comissoes','campos_personalizados',
                           'contas','pessoas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (org_id = (SELECT public.org_atual()))
         WITH CHECK (org_id = (SELECT public.org_atual()))', t || '_org', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;


-- >>>>> 20261016170000_bloco3_deskcomm.sql

-- =============================================================
-- Tappo — Bloco 3: funcionalidades portadas do DeskcommCRM (MIT),
-- adaptadas ao schema/convenções do Tappo. Só lógica, sem UI copiada.
-- =============================================================

-- -------------------------------------------------------------
-- Motivo de perda no negócio (deal)
-- -------------------------------------------------------------
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS motivo_perda text;


-- >>>>> 20261016180000_bloco3_automacoes.sql

-- =============================================================
-- Tappo — Bloco 3: automações QUANDO/SE/ENTÃO (inspirado no
-- motor de automações do DeskcommCRM, MIT — versão simples,
-- síncrona, sem fila/worker: roda dentro da própria Server Action).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.automacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(trim(nome)) > 0),
  ativo         boolean NOT NULL DEFAULT false,
  gatilho       text NOT NULL CHECK (gatilho IN ('lead_mudou_status','lead_entrou_campanha','deal_mudou_etapa','tag_adicionada')),
  gatilho_valor text,
  acao          text NOT NULL CHECK (acao IN ('mover_etapa','adicionar_tag','atribuir_responsavel','criar_tarefa')),
  acao_valor    text,
  execucoes     int NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automacoes_org ON public.automacoes (org_id);
CREATE INDEX IF NOT EXISTS idx_automacoes_gatilho ON public.automacoes (org_id, gatilho, ativo);

ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automacoes_org ON public.automacoes;
CREATE POLICY automacoes_org ON public.automacoes FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));
REVOKE ALL ON public.automacoes FROM anon;
