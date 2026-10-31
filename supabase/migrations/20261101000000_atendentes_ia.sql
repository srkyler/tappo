-- =============================================================
-- Tappo — vários atendentes de IA por empresa (estilo DeskcommCRM) + registro de erros
--
-- ia_atendentes: cada empresa cria quantos atendentes quiser (Vendas, Suporte,
--   Financeiro…), com nome, função, tom, objetivo e instruções próprios. Todos usam
--   o perfil, o conhecimento e a memória da empresa (ia_perfil/ia_conhecimento).
--   Quem responde em cada canal: wa_conexoes/telegram_conexoes/email_conexoes.atendente_id;
--   sem atribuição, o atendente marcado como padrão. Uma conversa pode ser passada de
--   um atendente para outro (wa_conversas.atendente_id).
-- ia_atendente_modelo: QUAL MODELO (ai_agents) cada atendente usa. Só o admin da
--   plataforma escreve (service role) — o cliente nunca vê nem troca o modelo.
--   Sem linha = o agente ativo (padrão) da plataforma.
-- erros_app: falhas técnicas com o detalhe real (provedor, rota, empresa). Só o
--   admin da plataforma lê, em /admin.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.ia_atendentes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome              text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 60),
  funcao            text NOT NULL DEFAULT '' CHECK (length(funcao) <= 200),
  saudacao          text NOT NULL DEFAULT '' CHECK (length(saudacao) <= 500),
  tom               text CHECK (tom IN ('cordial','formal','descontraido','consultivo')),
  objetivo          text CHECK (objetivo IN ('qualificar','agendar','vender','suporte')),
  instrucoes        text NOT NULL DEFAULT '' CHECK (length(instrucoes) <= 8000),
  transferir_quando text NOT NULL DEFAULT '' CHECK (length(transferir_quando) <= 2000),
  ativo             boolean NOT NULL DEFAULT true,
  padrao            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_atendentes_org ON public.ia_atendentes (org_id);
-- No máximo um padrão por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_atendentes_um_padrao ON public.ia_atendentes (org_id) WHERE padrao;

DROP TRIGGER IF EXISTS set_updated_at ON public.ia_atendentes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ia_atendentes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ia_atendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ia_atendentes_select ON public.ia_atendentes;
CREATE POLICY ia_atendentes_select ON public.ia_atendentes FOR SELECT TO authenticated USING (org_id = public.org_atual());
DROP POLICY IF EXISTS ia_atendentes_gestor ON public.ia_atendentes;
CREATE POLICY ia_atendentes_gestor ON public.ia_atendentes FOR ALL TO authenticated
  USING (org_id = public.org_atual() AND public.eh_gestor())
  WITH CHECK (org_id = public.org_atual() AND public.eh_gestor());

-- Modelo de cada atendente: só a service role (admin da plataforma)
CREATE TABLE IF NOT EXISTS public.ia_atendente_modelo (
  atendente_id uuid PRIMARY KEY REFERENCES public.ia_atendentes(id) ON DELETE CASCADE,
  agent_id     uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ia_atendente_modelo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ia_atendente_modelo FROM anon, authenticated;

-- Quem atende cada canal
ALTER TABLE public.wa_conexoes       ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.ia_atendentes(id) ON DELETE SET NULL;
ALTER TABLE public.telegram_conexoes ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.ia_atendentes(id) ON DELETE SET NULL;
ALTER TABLE public.email_conexoes    ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.ia_atendentes(id) ON DELETE SET NULL;
-- Conversa passada de um atendente para outro (transferir_para_atendente)
ALTER TABLE public.wa_conversas      ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.ia_atendentes(id) ON DELETE SET NULL;
ALTER TABLE public.ia_execucoes      ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.ia_atendentes(id) ON DELETE SET NULL;

-- Registro de erros (só service role)
CREATE TABLE IF NOT EXISTS public.erros_app (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem     text NOT NULL,
  org_id     uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  mensagem   text NOT NULL,
  detalhe    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erros_app_data ON public.erros_app (created_at DESC);
ALTER TABLE public.erros_app ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erros_app FROM anon, authenticated;
