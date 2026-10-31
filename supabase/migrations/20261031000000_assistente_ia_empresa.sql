-- =============================================================
-- Tappo — Assistente de IA da empresa
--
-- Divisão de responsabilidades:
--  - Admin da plataforma (/admin): provedor, modelo, chave e limites (ai_agents,
--    ia_limites_org). Clientes nunca leem nem alteram isso.
--  - Empresa (dono/gestor em /app/assistente): O QUE a IA sabe e COMO atende —
--    perfil do negócio, base de conhecimento, memória, regras de transferência e
--    horário. Tudo por org_id com RLS.
--
-- Padrões portados do DeskcommCRM (MIT) e do Chatwoot Captain: conhecimento por
-- tenant, memória da empresa e do contato, skills durante o atendimento, handoff
-- com motivo registrado, teto de gasto por empresa e log de execuções.
-- Busca do conhecimento: full-text em português (tsvector) — não depende de
-- nenhum provedor de embeddings.
-- =============================================================

-- -------------------------------------------------------------
-- Perfil do negócio (1 linha por empresa)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_perfil (
  org_id            uuid PRIMARY KEY DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome_assistente   text NOT NULL DEFAULT 'Assistente' CHECK (length(trim(nome_assistente)) BETWEEN 1 AND 60),
  tom               text NOT NULL DEFAULT 'cordial' CHECK (tom IN ('cordial','formal','descontraido','consultivo')),
  usar_emojis       boolean NOT NULL DEFAULT false,
  saudacao          text NOT NULL DEFAULT '',
  sobre             text NOT NULL DEFAULT '',
  produtos          text NOT NULL DEFAULT '',
  publico           text NOT NULL DEFAULT '',
  diferenciais      text NOT NULL DEFAULT '',
  politicas         text NOT NULL DEFAULT '',  -- pagamento, entrega, troca, cancelamento
  contato           text NOT NULL DEFAULT '',  -- endereço, site, telefones, redes
  objetivo          text NOT NULL DEFAULT 'qualificar' CHECK (objetivo IN ('qualificar','agendar','vender','suporte')),
  regras            text NOT NULL DEFAULT '',  -- o que a IA deve sempre / nunca fazer
  transferir_quando text NOT NULL DEFAULT '',  -- gatilhos extras de transferência para humano
  -- {"1":["08:00","18:00"], ...} — chave = dia da semana (0 = domingo). Vazio = sem horário definido.
  horario           jsonb NOT NULL DEFAULT '{}'::jsonb,
  fora_horario      text NOT NULL DEFAULT '',
  usar_qualificacao boolean NOT NULL DEFAULT true,
  aprender_contatos boolean NOT NULL DEFAULT true,
  pode_criar_lead   boolean NOT NULL DEFAULT true,
  pode_criar_tarefa boolean NOT NULL DEFAULT true,
  updated_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.ia_perfil;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ia_perfil
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------
-- Base de conhecimento: FAQs e documentos. Os trechos (chunks) são gerados
-- por trigger e indexados para busca full-text.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_conhecimento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  tipo          text NOT NULL DEFAULT 'faq' CHECK (tipo IN ('faq','documento')),
  titulo        text NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 300),  -- a pergunta, no caso de FAQ
  conteudo      text NOT NULL CHECK (length(trim(conteudo)) BETWEEN 1 AND 60000),
  status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','sugerido','arquivado')),
  origem        text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','conversa')),
  usos          int  NOT NULL DEFAULT 0,
  ultimo_uso_em timestamptz,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_org ON public.ia_conhecimento (org_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.ia_conhecimento;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ia_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ia_conhecimento_trechos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  conhecimento_id uuid NOT NULL REFERENCES public.ia_conhecimento(id) ON DELETE CASCADE,
  ordem           int  NOT NULL DEFAULT 0,
  conteudo        text NOT NULL,
  busca           tsvector GENERATED ALWAYS AS (to_tsvector('portuguese'::regconfig, conteudo)) STORED
);
CREATE INDEX IF NOT EXISTS idx_ia_trechos_busca ON public.ia_conhecimento_trechos USING gin (busca);
CREATE INDEX IF NOT EXISTS idx_ia_trechos_org ON public.ia_conhecimento_trechos (org_id);
CREATE INDEX IF NOT EXISTS idx_ia_trechos_conhecimento ON public.ia_conhecimento_trechos (conhecimento_id);

-- Quebra o conteúdo em trechos de ~1200 caracteres (por parágrafo). FAQ = 1 trecho.
CREATE OR REPLACE FUNCTION public.ia_gerar_trechos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  par   text;
  atual text := '';
  n     int  := 0;
BEGIN
  DELETE FROM public.ia_conhecimento_trechos WHERE conhecimento_id = NEW.id;

  IF NEW.tipo = 'faq' THEN
    INSERT INTO public.ia_conhecimento_trechos (org_id, conhecimento_id, ordem, conteudo)
    VALUES (NEW.org_id, NEW.id, 0, 'Pergunta: ' || NEW.titulo || E'\nResposta: ' || NEW.conteudo);
    RETURN NEW;
  END IF;

  FOREACH par IN ARRAY regexp_split_to_array(NEW.conteudo, E'\\n\\s*\\n') LOOP
    par := trim(par);
    CONTINUE WHEN par = '';
    -- Parágrafo enorme: fecha o trecho atual e fatia o parágrafo
    WHILE length(par) > 1500 LOOP
      IF atual <> '' THEN
        INSERT INTO public.ia_conhecimento_trechos (org_id, conhecimento_id, ordem, conteudo)
        VALUES (NEW.org_id, NEW.id, n, NEW.titulo || E'\n' || atual);
        n := n + 1; atual := '';
      END IF;
      INSERT INTO public.ia_conhecimento_trechos (org_id, conhecimento_id, ordem, conteudo)
      VALUES (NEW.org_id, NEW.id, n, NEW.titulo || E'\n' || substr(par, 1, 1200));
      n := n + 1;
      par := substr(par, 1201);
    END LOOP;
    IF atual <> '' AND length(atual) + length(par) > 1200 THEN
      INSERT INTO public.ia_conhecimento_trechos (org_id, conhecimento_id, ordem, conteudo)
      VALUES (NEW.org_id, NEW.id, n, NEW.titulo || E'\n' || atual);
      n := n + 1; atual := '';
    END IF;
    atual := CASE WHEN atual = '' THEN par ELSE atual || E'\n\n' || par END;
  END LOOP;

  IF atual <> '' THEN
    INSERT INTO public.ia_conhecimento_trechos (org_id, conhecimento_id, ordem, conteudo)
    VALUES (NEW.org_id, NEW.id, n, NEW.titulo || E'\n' || atual);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.ia_gerar_trechos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ia_gerar_trechos ON public.ia_conhecimento;
CREATE TRIGGER trg_ia_gerar_trechos AFTER INSERT OR UPDATE OF titulo, conteudo, tipo ON public.ia_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.ia_gerar_trechos();

-- Busca: palavras da pergunta (stemizadas em português) combinadas com OU,
-- ordenadas por relevância. org NULL = empresa da sessão (uso pelo agente do CRM).
CREATE OR REPLACE FUNCTION public.ia_buscar_conhecimento(consulta text, limite int DEFAULT 4, org uuid DEFAULT NULL)
RETURNS TABLE (conhecimento_id uuid, titulo text, tipo text, trecho text, relevancia real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH q AS (
    SELECT to_tsquery('simple', string_agg(quote_literal(l), ' | ')) AS tsq
      FROM unnest(tsvector_to_array(to_tsvector('portuguese'::regconfig, coalesce(consulta, '')))) AS l
  )
  SELECT t.conhecimento_id, k.titulo, k.tipo, t.conteudo, ts_rank_cd(t.busca, q.tsq)
    FROM q
    JOIN public.ia_conhecimento_trechos t ON t.busca @@ q.tsq
    JOIN public.ia_conhecimento k ON k.id = t.conhecimento_id
   WHERE q.tsq IS NOT NULL
     AND t.org_id = coalesce(org, public.org_atual())
     AND k.status = 'ativo'
   ORDER BY 5 DESC
   LIMIT least(greatest(coalesce(limite, 4), 1), 8);
$$;
GRANT EXECUTE ON FUNCTION public.ia_buscar_conhecimento(text, int, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ia_buscar_conhecimento(text, int, uuid) FROM anon, PUBLIC;

-- Contador de uso (só o servidor chama, depois de cada resposta da IA)
CREATE OR REPLACE FUNCTION public.ia_registrar_uso_conhecimento(ids uuid[])
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.ia_conhecimento SET usos = usos + 1, ultimo_uso_em = now() WHERE id = ANY(ids);
$$;
REVOKE EXECUTE ON FUNCTION public.ia_registrar_uso_conhecimento(uuid[]) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------
-- Memória: avisos da empresa (com validade opcional) e fatos sobre cada contato
-- (a IA aprende durante a conversa; a equipe revisa e apaga).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_memoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  escopo      text NOT NULL DEFAULT 'empresa' CHECK (escopo IN ('empresa','contato')),
  contato     text,  -- telefone (só dígitos) ou chat_id do contato
  lead_id     uuid,
  conversa_id uuid REFERENCES public.wa_conversas(id) ON DELETE SET NULL,
  fato        text NOT NULL CHECK (length(trim(fato)) BETWEEN 1 AND 500),
  origem      text NOT NULL DEFAULT 'humano' CHECK (origem IN ('humano','ia')),
  valido_ate  date,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ia_memoria_contato CHECK (escopo = 'empresa' OR contato IS NOT NULL),
  CONSTRAINT ia_memoria_lead FOREIGN KEY (lead_id, org_id) REFERENCES public.leads (id, org_id) ON DELETE SET NULL (lead_id)
);
CREATE INDEX IF NOT EXISTS idx_ia_memoria_org ON public.ia_memoria (org_id, escopo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_memoria_contato ON public.ia_memoria (org_id, contato) WHERE escopo = 'contato';

-- -------------------------------------------------------------
-- Execuções: cada resposta da IA no atendimento (auditoria + "perguntas sem resposta")
-- Escrita só pela service role; leitura pelo dono/gestor da empresa.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_execucoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  conversa_id      uuid REFERENCES public.wa_conversas(id) ON DELETE SET NULL,
  canal            text NOT NULL DEFAULT 'whatsapp',
  teste            boolean NOT NULL DEFAULT false,
  agent_id         uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  pergunta         text,
  resposta         text,
  ferramentas      text[] NOT NULL DEFAULT '{}',
  conhecimento_ids uuid[] NOT NULL DEFAULT '{}',
  transferiu       boolean NOT NULL DEFAULT false,
  motivo           text,
  tokens           int NOT NULL DEFAULT 0,
  ms               int,
  erro             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_org ON public.ia_execucoes (org_id, created_at DESC);

-- -------------------------------------------------------------
-- Limites por empresa — definidos SÓ pelo admin da plataforma (service role).
-- A empresa pode ler o próprio limite (para mostrar o consumo), nunca alterar.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ia_limites_org (
  org_id          uuid PRIMARY KEY DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  teto_tokens_mes int CHECK (teto_tokens_mes IS NULL OR teto_tokens_mes > 0),
  bloqueado       boolean NOT NULL DEFAULT false,
  observacao      text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.ia_limites_org;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ia_limites_org
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_uso_org ON public.ai_uso (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ia_tokens_org(org uuid, desde timestamptz)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(sum(tokens_entrada + tokens_saida), 0) FROM public.ai_uso WHERE org_id = org AND created_at >= desde;
$$;
REVOKE EXECUTE ON FUNCTION public.ia_tokens_org(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------
-- Chatbot de qualificação: a tela /app/chatbot-qualificacao e as actions já
-- usavam esta tabela, mas ela nunca tinha sido criada. Agora o assistente usa
-- as perguntas do segmento da empresa durante o atendimento.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatbot_qualificacao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  segmento       text NOT NULL,
  pergunta       text NOT NULL CHECK (length(trim(pergunta)) > 0),
  ordem          int  NOT NULL DEFAULT 1,
  campo_resposta text NOT NULL DEFAULT 'resposta',
  obrigatoria    boolean NOT NULL DEFAULT false,
  ativa          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_qualificacao_org ON public.chatbot_qualificacao (org_id, segmento, ordem);

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
ALTER TABLE public.ia_perfil               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_conhecimento         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_conhecimento_trechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_memoria              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_execucoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_limites_org          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_qualificacao    ENABLE ROW LEVEL SECURITY;

-- Equipe lê; dono/gestor escreve
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ia_perfil','ia_conhecimento','ia_memoria','chatbot_qualificacao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (org_id = (SELECT public.org_atual()))', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_gestor', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))
         WITH CHECK (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))', t || '_gestor', t);
  END LOOP;
END $$;

-- Trechos: só leitura (escritos pelo trigger SECURITY DEFINER)
DROP POLICY IF EXISTS ia_conhecimento_trechos_select ON public.ia_conhecimento_trechos;
CREATE POLICY ia_conhecimento_trechos_select ON public.ia_conhecimento_trechos FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));

-- Execuções: só dono/gestor lê; ninguém escreve pela sessão
DROP POLICY IF EXISTS ia_execucoes_gestor ON public.ia_execucoes;
CREATE POLICY ia_execucoes_gestor ON public.ia_execucoes FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()));

-- Limites: a equipe vê o próprio limite; escrita só pela service role (admin)
DROP POLICY IF EXISTS ia_limites_org_select ON public.ia_limites_org;
CREATE POLICY ia_limites_org_select ON public.ia_limites_org FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));
REVOKE INSERT, UPDATE, DELETE ON public.ia_limites_org FROM anon, authenticated;
