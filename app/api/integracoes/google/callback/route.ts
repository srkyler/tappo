import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";
import { concluirOAuth, lerEstado } from "@/lib/google/agenda";
import { registrarErro } from "@/lib/erros";

/*
 * Volta do Google. O state é assinado e amarrado a um nonce em cookie httpOnly; além
 * disso a sessão atual tem que ser do mesmo usuário/empresa que iniciou e ainda gestor.
 */
export async function GET(req: NextRequest) {
  const volta = (q: string) => {
    const r = NextResponse.redirect(new URL(`/app/assistente?agenda=${q}`, req.url));
    r.cookies.delete({ name: "tappo_google_oauth", path: "/api/integracoes/google" });
    return r;
  };
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return volta("cancelado");
  const estado = lerEstado(p.get("state") ?? "", req.cookies.get("tappo_google_oauth")?.value);
  const code = p.get("code");
  if (!estado || !code) return volta("expirado");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empresa = await empresaAtual();
  if (!user || user.id !== estado.userId || empresa?.id !== estado.orgId || !ehGestor(empresa.papel)) return volta("sem_permissao");

  try {
    await concluirOAuth(createAdminClient(), estado.orgId, user.id, code);
    return volta("conectada");
  } catch (e) {
    await registrarErro("google:oauth", e, { orgId: estado.orgId });
    return volta("erro");
  }
}
