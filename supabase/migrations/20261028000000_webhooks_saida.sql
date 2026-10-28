-- =============================================================
-- Tappo — Webhooks de SAÍDA (v1)
-- O Tappo POSTa eventos (ex.: lead.criado) para URLs da própria
-- empresa, com assinatura HMAC-SHA256 no header x-tappo-assinatura.
-- Padrão inspirado no DeskcommCRM (MIT), adaptado ao schema do Tappo.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.webhook_saida (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  url        text NOT NULL CHECK (url ~ '^https?://'),
  eventos    text[] NOT NULL DEFAULT '{lead.criado}'
             CHECK (eventos <@ ARRAY['lead.criado','lead.atualizado','lead.etapa_mudou','conversa.nova','mensagem.nova']::text[]),
  ativo      boolean NOT NULL DEFAULT true,
  secret     text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.webhook_saida_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.webhook_saida(id) ON DELETE CASCADE,
  evento     text NOT NULL,
  payload    jsonb NOT NULL,
  status     integer,
  erro       text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_saida_org    ON public.webhook_saida (org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_saida_log_org ON public.webhook_saida_log (org_id, enviado_em DESC);

COMMENT ON TABLE public.webhook_saida     IS 'Webhooks de saída: o Tappo envia POSTs assinados (HMAC-SHA256) para URLs da empresa';
COMMENT ON TABLE public.webhook_saida_log IS 'Histórico de envios (status HTTP, erro) com suporte a reenvio manual';

ALTER TABLE public.webhook_saida     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_saida_log ENABLE ROW LEVEL SECURITY;

-- webhook_saida: membros leem (UI); só dono/gestor cria, edita, pausa e exclui.
DROP POLICY IF EXISTS webhook_saida_leitura ON public.webhook_saida;
DROP POLICY IF EXISTS webhook_saida_mutacao ON public.webhook_saida;
CREATE POLICY webhook_saida_leitura ON public.webhook_saida FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));
CREATE POLICY webhook_saida_mutacao ON public.webhook_saida FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))
  WITH CHECK (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()));

-- webhook_saida_log: membros leem (histórico); o emitter insere de qualquer sessão
-- de membro (org deve bater); nenhuma alteração/exclusão via cliente.
DROP POLICY IF EXISTS webhook_saida_log_leitura ON public.webhook_saida_log;
DROP POLICY IF EXISTS webhook_saida_log_insert ON public.webhook_saida_log;
CREATE POLICY webhook_saida_log_leitura ON public.webhook_saida_log FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));
CREATE POLICY webhook_saida_log_insert ON public.webhook_saida_log FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.org_atual()));
