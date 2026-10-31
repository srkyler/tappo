import { createAdminClient } from "@/lib/supabase/admin";
import { verificarSaude } from "@/lib/saude";

/*
 * GET /api/health — para monitor externo (UptimeRobot etc.). Público, então só
 * diz se está ok; o detalhe de cada item fica no /admin.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const itens = await verificarSaude(createAdminClient());
    const ok = !itens.some((i) => i.estado === "falha");
    return Response.json({ ok, itens: itens.map((i) => ({ nome: i.nome, estado: i.estado })) }, { status: ok ? 200 : 503 });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
