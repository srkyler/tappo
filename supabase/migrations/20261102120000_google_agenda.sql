-- =============================================================
-- Tappo — Google Agenda por empresa (a IA consulta horários livres e agenda)
--
-- O refresh token fica cifrado (AES-256-GCM, lib/ai/cofre.ts) e a tabela é só da
-- service role: a tela lê o status pelo servidor, filtrando a empresa. O app OAuth
-- é da plataforma (GOOGLE_CLIENT_ID/SECRET no .env).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.google_agenda (
  org_id                uuid PRIMARY KEY REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  email                 text,
  refresh_token_cifrado text NOT NULL,
  agenda_id             text NOT NULL DEFAULT 'primary',
  duracao_min           int  NOT NULL DEFAULT 30 CHECK (duracao_min BETWEEN 10 AND 240),
  antecedencia_horas    int  NOT NULL DEFAULT 2  CHECK (antecedencia_horas BETWEEN 0 AND 168),
  dias_a_frente         int  NOT NULL DEFAULT 14 CHECK (dias_a_frente BETWEEN 1 AND 60),
  ativo                 boolean NOT NULL DEFAULT true,
  conectado_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_agenda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_agenda FROM anon, authenticated;

-- Evento criado pela IA/equipe fica ligado à tarefa do CRM
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS google_evento_id text;
