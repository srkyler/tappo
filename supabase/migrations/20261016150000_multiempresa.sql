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
