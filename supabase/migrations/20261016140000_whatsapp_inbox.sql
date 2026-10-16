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
