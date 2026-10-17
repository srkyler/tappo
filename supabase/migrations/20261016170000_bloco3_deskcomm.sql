-- =============================================================
-- Tappo — Bloco 3: funcionalidades portadas do DeskcommCRM (MIT),
-- adaptadas ao schema/convenções do Tappo. Só lógica, sem UI copiada.
-- =============================================================

-- -------------------------------------------------------------
-- Motivo de perda no negócio (deal)
-- -------------------------------------------------------------
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS motivo_perda text;
