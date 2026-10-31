-- =============================================================
-- Tappo — fila de jobs (com retentativa) + IA que entende áudio e imagem
--
-- jobs: trabalho assíncrono (transcrever áudio, descrever imagem, follow-up…).
--   O agendador (/api/v1/cron/tick → tarefa "fila") e o próprio webhook consomem.
--   Falhou → volta para a fila com espera exponencial até max_tentativas; o erro
--   fica visível. Só service role.
-- ia_midia_config: linha única da plataforma (admin). Transcrição = API compatível
--   com OpenAI /audio/transcriptions (Groq whisper-large-v3, OpenAI…). Visão = qual
--   agente (ai_agents) descreve imagens; null = o agente ativo.
-- wa_mensagens.transcricao: texto do áudio / descrição da imagem (a IA lê isso).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text NOT NULL,
  org_id         uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','rodando','feito','falhou')),
  executar_em    timestamptz NOT NULL DEFAULT now(),
  tentativas     int NOT NULL DEFAULT 0,
  max_tentativas int NOT NULL DEFAULT 5,
  erro           text,
  -- Evita o mesmo trabalho duas vezes (ex.: retentativa do webhook)
  chave          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_fila ON public.jobs (executar_em) WHERE status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_chave ON public.jobs (chave) WHERE chave IS NOT NULL;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jobs FROM anon, authenticated;

-- Pega até `limite` jobs vencidos e marca como rodando, sem dois processos pegarem o mesmo.
-- Job preso em "rodando" há mais de 10 min (processo morreu) volta a ser elegível.
CREATE OR REPLACE FUNCTION public.jobs_pegar(limite int DEFAULT 10)
RETURNS SETOF public.jobs
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.jobs j
     SET status = 'rodando', tentativas = j.tentativas + 1, updated_at = now()
   WHERE j.id IN (
     SELECT id FROM public.jobs
      WHERE (status = 'pendente' AND executar_em <= now())
         OR (status = 'rodando' AND updated_at < now() - interval '10 minutes')
      ORDER BY executar_em
      LIMIT greatest(1, least(limite, 50))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
$$;
REVOKE EXECUTE ON FUNCTION public.jobs_pegar(int) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ia_midia_config (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  transcricao_ativa      boolean NOT NULL DEFAULT false,
  transcricao_base_url   text NOT NULL DEFAULT 'https://api.groq.com/openai/v1',
  transcricao_modelo     text NOT NULL DEFAULT 'whisper-large-v3',
  transcricao_chave      text,      -- AES-256-GCM (lib/ai/cofre.ts)
  visao_ativa            boolean NOT NULL DEFAULT false,
  visao_agent_id         uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ia_midia_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ia_midia_config FROM anon, authenticated;
INSERT INTO public.ia_midia_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS transcricao text;
