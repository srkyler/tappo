-- =============================================================
-- Tappo — múltiplos funis por empresa (Vendas, Pós-venda, Suporte...).
-- Cada empresa ganha um funil "Principal" (padrao=true) automático —
-- as etapas que já existem migram pra ele, nada se perde.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.pipelines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT public.org_atual() REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome       text NOT NULL CHECK (length(trim(nome)) > 0),
  padrao     boolean NOT NULL DEFAULT false,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipelines_org ON public.pipelines (org_id);
-- só um padrao=true por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_padrao_unico ON public.pipelines (org_id) WHERE padrao;

DROP TRIGGER IF EXISTS set_updated_at ON public.pipelines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pipelines_org ON public.pipelines;
CREATE POLICY pipelines_org ON public.pipelines FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()))
  WITH CHECK (org_id = (SELECT public.org_atual()));
REVOKE ALL ON public.pipelines FROM anon;

-- -------------------------------------------------------------
-- Backfill: toda empresa com etapas (ou sem nenhuma ainda) ganha um
-- funil "Principal" padrão. Idempotente — não duplica em reruns.
-- -------------------------------------------------------------
INSERT INTO public.pipelines (org_id, nome, padrao)
SELECT DISTINCT s.org_id, 'Principal', true
  FROM public.pipeline_stages s
 WHERE NOT EXISTS (SELECT 1 FROM public.pipelines p WHERE p.org_id = s.org_id AND p.padrao);

INSERT INTO public.pipelines (org_id, nome, padrao)
SELECT o.id, 'Principal', true
  FROM public.organizacoes o
 WHERE NOT EXISTS (SELECT 1 FROM public.pipelines p WHERE p.org_id = o.id AND p.padrao);

-- -------------------------------------------------------------
-- pipeline_id em pipeline_stages: etapas existentes migram pro
-- funil padrão da própria empresa.
-- -------------------------------------------------------------
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE;

UPDATE public.pipeline_stages s
   SET pipeline_id = (SELECT p.id FROM public.pipelines p WHERE p.org_id = s.org_id AND p.padrao LIMIT 1)
 WHERE s.pipeline_id IS NULL;

ALTER TABLE public.pipeline_stages ALTER COLUMN pipeline_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON public.pipeline_stages (pipeline_id);

-- "ordem" agora é único por funil, não por empresa inteira
ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_ordem_org;
ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_ordem;
DO $$ BEGIN
  ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_ordem_pipeline UNIQUE (pipeline_id, ordem) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------
-- Novo usuário / nova empresa: cria o funil "Principal" antes das etapas.
-- (redefine handle_new_user — mesma lógica de antes, só com o pipeline a mais)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE conv record; nova uuid; seg text; pid uuid;
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo, avatar_url, empresa, provedor)
  VALUES (
    NEW.id, NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'nome_completo', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
    NEW.raw_user_meta_data ->> 'empresa',
    coalesce(NEW.raw_app_meta_data ->> 'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO conv FROM public.org_convites
   WHERE lower(email) = lower(NEW.email) AND aceito_em IS NULL AND expira_em > now()
   ORDER BY created_at DESC LIMIT 1;

  IF conv.id IS NOT NULL THEN
    INSERT INTO public.org_membros (org_id, user_id, papel) VALUES (conv.org_id, NEW.id, conv.papel) ON CONFLICT DO NOTHING;
    UPDATE public.org_convites SET aceito_em = now() WHERE id = conv.id;
    UPDATE public.profiles SET org_atual = conv.org_id WHERE id = NEW.id;
  ELSE
    seg := coalesce(NEW.raw_user_meta_data ->> 'segmento', 'geral');
    INSERT INTO public.organizacoes (nome, segmento)
    VALUES (coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'empresa'), ''), 'Minha empresa'), seg)
    RETURNING id INTO nova;
    INSERT INTO public.org_membros (org_id, user_id, papel) VALUES (nova, NEW.id, 'dono');
    UPDATE public.profiles SET org_atual = nova WHERE id = NEW.id;
    INSERT INTO public.pipelines (org_id, nome, padrao) VALUES (nova, 'Principal', true) RETURNING id INTO pid;
    INSERT INTO public.pipeline_stages (org_id, user_id, pipeline_id, nome, ordem, probabilidade, tipo)
    SELECT nova, NEW.id, pid, e.nome, e.ordem, e.probabilidade, e.tipo FROM public.etapas_do_segmento(seg) e;
  END IF;
  RETURN NEW;
END $$;
