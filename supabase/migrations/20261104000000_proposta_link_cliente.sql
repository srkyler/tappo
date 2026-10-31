-- =============================================================
-- Tappo — Proposta com link para o cliente aceitar/recusar (antiga tela
-- "Aprovação de proposta", fundida em Propostas). A página pública /p/<token>
-- lê e responde pelo servidor (service role), sempre filtrando pelo token.
-- =============================================================

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS descricao         text,
  ADD COLUMN IF NOT EXISTS token_publico     text UNIQUE,
  ADD COLUMN IF NOT EXISTS link_expira_em    timestamptz,
  ADD COLUMN IF NOT EXISTS visualizado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_em     timestamptz,
  ADD COLUMN IF NOT EXISTS resposta_nome     text,
  ADD COLUMN IF NOT EXISTS resposta_mensagem text,
  ADD COLUMN IF NOT EXISTS user_id           uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;
