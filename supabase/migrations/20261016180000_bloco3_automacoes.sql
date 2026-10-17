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
