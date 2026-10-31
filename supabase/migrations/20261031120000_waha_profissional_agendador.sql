-- =============================================================
-- Tappo — WhatsApp (WAHA) no padrão profissional + agendador
--
-- wa_mensagens: ack do WhatsApp (enviada → entregue → lida), mensagem apagada
--               pelo contato e mimetype da mídia (o proxy de mídia usa).
-- wa_conversas: conexao_id = número (sessão) que recebeu a conversa; a resposta
--               humana sai por ele (a empresa pode ter vários números).
-- wa_conexoes:  quando o status mudou e quantas vezes o vigia religou a sessão
--               desde o último WORKING (para não religar em loop).
-- cron_execucoes: registro de cada rodada do agendador (/api/v1/cron/*).
--               Só o servidor (service role) lê e escreve.
-- =============================================================

ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS ack smallint;
ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS apagada boolean NOT NULL DEFAULT false;
ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS midia_mime text;

ALTER TABLE public.wa_conversas ADD COLUMN IF NOT EXISTS conexao_id uuid REFERENCES public.wa_conexoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conversas_conexao ON public.wa_conversas (conexao_id);

ALTER TABLE public.wa_conexoes ADD COLUMN IF NOT EXISTS status_em timestamptz;
ALTER TABLE public.wa_conexoes ADD COLUMN IF NOT EXISTS verificado_em timestamptz;
ALTER TABLE public.wa_conexoes ADD COLUMN IF NOT EXISTS religadas int NOT NULL DEFAULT 0;


CREATE TABLE IF NOT EXISTS public.cron_execucoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa      text NOT NULL,
  inicio      timestamptz NOT NULL DEFAULT now(),
  fim         timestamptz,
  ok          boolean,
  detalhe     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cron_execucoes_tarefa ON public.cron_execucoes (tarefa, inicio DESC);

-- Sem policies: RLS ligado e nenhuma regra = só a service role acessa
ALTER TABLE public.cron_execucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_execucoes FROM anon, authenticated;
