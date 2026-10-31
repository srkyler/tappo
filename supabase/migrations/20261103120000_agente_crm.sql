-- =============================================================
-- Tappo — Agente do CRM "tipo Claude Code" (plano 5.2–5.4)
--
-- agente_lotes: o agente PROPÕE um lote de alterações; nada é gravado até o
-- usuário aprovar. Ao executar, guarda o necessário para desfazer.
-- agente_memoria_usuario: preferências e metas do usuário que o agente lembra.
-- Ambas por usuário (RLS: só o dono vê e mexe).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.agente_lotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao     text NOT NULL CHECK (length(trim(descricao)) > 0),
  acoes         jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','executado','cancelado','desfeito','falhou')),
  desfazer      jsonb,
  resultado     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  executado_em  timestamptz,
  desfeito_em   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agente_lotes_user ON public.agente_lotes (user_id, created_at DESC);
ALTER TABLE public.agente_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agente_lotes_dono ON public.agente_lotes;
CREATE POLICY agente_lotes_dono ON public.agente_lotes FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND org_id = (SELECT public.org_atual()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND org_id = (SELECT public.org_atual()));
REVOKE ALL ON public.agente_lotes FROM anon;

CREATE TABLE IF NOT EXISTS public.agente_memoria_usuario (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  fato       text NOT NULL CHECK (length(trim(fato)) BETWEEN 3 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agente_memoria_user ON public.agente_memoria_usuario (user_id, created_at DESC);
ALTER TABLE public.agente_memoria_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agente_memoria_dono ON public.agente_memoria_usuario;
CREATE POLICY agente_memoria_dono ON public.agente_memoria_usuario FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND org_id = (SELECT public.org_atual()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND org_id = (SELECT public.org_atual()));
REVOKE ALL ON public.agente_memoria_usuario FROM anon;
