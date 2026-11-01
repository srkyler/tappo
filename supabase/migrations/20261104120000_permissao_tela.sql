-- =============================================================
-- Tappo — Permissões por tela (antiga tela "Permissões", fundida em Empresa e
-- equipe). permissao_tela já existia (20261018120000), mas qualquer membro
-- podia gravar nela — um vendedor conseguiria se liberar. Agora: todos da
-- empresa leem, só dono/gestor grava. O dono nunca é bloqueado.
-- =============================================================

-- Remove repetidos antes da chave única (fica o mais recente)
DELETE FROM public.permissao_tela a
 USING public.permissao_tela b
 WHERE a.org_id = b.org_id AND a.papel = b.papel AND a.modulo = b.modulo
   AND (a.criado_em, a.id) < (b.criado_em, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS permissao_tela_unica ON public.permissao_tela (org_id, papel, modulo);

DROP POLICY IF EXISTS permissao_tela_org ON public.permissao_tela;
DROP POLICY IF EXISTS permissao_tela_ler ON public.permissao_tela;
DROP POLICY IF EXISTS permissao_tela_gravar ON public.permissao_tela;
CREATE POLICY permissao_tela_ler ON public.permissao_tela FOR SELECT TO authenticated
  USING (org_id = (SELECT public.org_atual()));
CREATE POLICY permissao_tela_gravar ON public.permissao_tela FOR ALL TO authenticated
  USING (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()))
  WITH CHECK (org_id = (SELECT public.org_atual()) AND (SELECT public.eh_gestor()) AND papel <> 'dono');

-- Consulta única feita pelo middleware a cada página do app
CREATE OR REPLACE FUNCTION public.tela_bloqueada(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.permissao_tela pt
     WHERE pt.org_id = public.org_atual()
       AND pt.papel = public.papel_atual()
       AND pt.papel <> 'dono'
       AND NOT pt.pode_ver
       AND (p_path = pt.modulo OR p_path LIKE pt.modulo || '/%')
  );
$$;
GRANT EXECUTE ON FUNCTION public.tela_bloqueada(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.tela_bloqueada(text) FROM anon, PUBLIC;
