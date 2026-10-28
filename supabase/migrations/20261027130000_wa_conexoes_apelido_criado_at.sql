-- Colunas que o app usa em wa_conexoes mas estavam fora do setup:
-- apelido (nome exibido da conexão) e criado_at (ordenação da lista).

ALTER TABLE public.wa_conexoes
  ADD COLUMN IF NOT EXISTS apelido  text NOT NULL DEFAULT 'Conexão WhatsApp',
  ADD COLUMN IF NOT EXISTS criado_at timestamptz NOT NULL DEFAULT now();

UPDATE public.wa_conexoes SET criado_at = created_at WHERE criado_at IS DISTINCT FROM created_at;
