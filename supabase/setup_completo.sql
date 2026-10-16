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
