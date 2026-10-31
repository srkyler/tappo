import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Leitura da proposta pelo link público /p/<token>. Sem sessão: usa service
 * role e SEMPRE filtra pelo token (nunca por id vindo do navegador).
 */

export type PropostaPublica = {
  id: string;
  org_id: string;
  titulo: string;
  descricao: string | null;
  valor: number;
  status: string;
  pdf_url: string | null;
  enviado_em: string | null;
  link_expira_em: string | null;
  respondido_em: string | null;
  resposta_nome: string | null;
  empresa: string;
  cliente: string | null;
  expirada: boolean;
};

export const TOKEN_OK = /^[A-Za-z0-9_-]{20,64}$/;

export async function propostaPorToken(token: string, marcarVista = false): Promise<PropostaPublica | null> {
  if (!TOKEN_OK.test(token)) return null;
  const db = createAdminClient();
  const { data: p } = await db
    .from("propostas")
    .select("id, org_id, lead_id, titulo, descricao, valor, status, pdf_url, enviado_em, link_expira_em, respondido_em, resposta_nome, visualizado_em")
    .eq("token_publico", token)
    .maybeSingle();
  if (!p) return null;
  const [{ data: org }, { data: lead }] = await Promise.all([
    db.from("organizacoes").select("nome").eq("id", p.org_id).maybeSingle(),
    p.lead_id ? db.from("leads").select("nome").eq("id", p.lead_id).eq("org_id", p.org_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const expirada = !!p.link_expira_em && new Date(p.link_expira_em).getTime() < Date.now();

  if (marcarVista && !expirada && !p.visualizado_em) {
    const agora = new Date().toISOString();
    await db.from("propostas").update({ visualizado_em: agora }).eq("id", p.id).is("visualizado_em", null);
    await db.from("propostas").update({ status: "visualizado", atualizado_em: agora }).eq("id", p.id).eq("status", "enviado");
    if (p.status === "enviado") p.status = "visualizado";
  }

  return {
    id: p.id, org_id: p.org_id, titulo: p.titulo, descricao: p.descricao ?? null, valor: Number(p.valor ?? 0),
    status: p.status, pdf_url: p.pdf_url, enviado_em: p.enviado_em, link_expira_em: p.link_expira_em,
    respondido_em: p.respondido_em, resposta_nome: p.resposta_nome,
    empresa: (org as { nome?: string } | null)?.nome ?? "", cliente: (lead as { nome?: string } | null)?.nome ?? null, expirada,
  };
}
