-- =============================================================
-- Tappo — Calendário de marketing: promoções/ofertas por empresa.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.promocoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao     text,
  oferta        text,
  canal         text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','email','instagram','site','outro')),
  data_inicio   date NOT NULL,
  data_fim      date,
  status        text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','ativa','concluida','cancelada')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);
CREATE INDEX IF NOT EXISTS idx_promocoes_org ON public.promocoes (org_id, data_inicio);

-- Nota: NÃO usar o trigger genérico set_updated_at() aqui — ele escreve em
-- "updated_at", e esta tabela usa "atualizado_em" (como propostas/contas).
-- A Server Action seta atualizado_em manualmente a cada update.

ALTER TABLE public.promocoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promocoes_org ON public.promocoes;
CREATE POLICY promocoes_org ON public.promocoes FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));
REVOKE ALL ON public.promocoes FROM anon;
