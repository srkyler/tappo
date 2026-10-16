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
