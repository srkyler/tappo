import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Registro de falhas técnicas (tabela erros_app, só service role). O detalhe real
 * (resposta do provedor de IA, do WAHA, stack) fica aqui para o admin da plataforma
 * ver em /admin; o cliente recebe só mensagem genérica. Nunca lança: registrar um
 * erro não pode derrubar quem chamou.
 */
export async function registrarErro(
  origem: string,
  e: unknown,
  ctx: { orgId?: string | null; detalhe?: Record<string, unknown> } = {},
): Promise<void> {
  const mensagem = (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e) ?? "erro").slice(0, 2000);
  console.error(`[${origem}]`, ctx.orgId ?? "-", mensagem);
  try {
    await createAdminClient().from("erros_app").insert({
      origem: origem.slice(0, 80),
      org_id: ctx.orgId ?? null,
      mensagem,
      detalhe: { ...(ctx.detalhe ?? {}), ...(e instanceof Error && e.stack ? { stack: e.stack.split("\n").slice(0, 6).join("\n") } : {}) },
    });
  } catch {
    /* tabela ainda não criada ou banco fora do ar: o console.error acima já registrou */
  }
}
