"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitar } from "@/lib/auth/rate-limit";
import { ehGestor } from "@/lib/segmentos";

/**
 * Resposta do cliente (sem login) à proposta do link /p/<token>.
 * Service role, sempre filtrando pelo token; só responde uma vez, só se a
 * proposta ainda estiver aberta (enviado/visualizado) e o link não expirou.
 * Avisa o dono com uma tarefa (aparece no sino de notificações).
 */
export async function responderProposta(
  token: string,
  aceitar: boolean,
  nome: string,
  mensagem: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, erro: "Link inválido." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  if (limitar({ acao: "proposta-resposta", ip, id: token }, 10, 3600)) return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };

  const quem = nome.trim().slice(0, 120);
  if (quem.length < 2) return { ok: false, erro: "Informe seu nome." };
  const msg = mensagem.trim().slice(0, 2000) || null;

  const db = createAdminClient();
  const { data: p } = await db
    .from("propostas")
    .select("id, org_id, lead_id, deal_id, titulo, valor, status, link_expira_em, user_id")
    .eq("token_publico", token)
    .maybeSingle();
  if (!p) return { ok: false, erro: "Proposta não encontrada." };
  if (p.link_expira_em && new Date(p.link_expira_em).getTime() < Date.now()) return { ok: false, erro: "Este link expirou. Peça um novo a quem enviou a proposta." };
  if (!["enviado", "visualizado"].includes(p.status)) return { ok: false, erro: "Esta proposta já foi respondida." };

  const agora = new Date().toISOString();
  const { data: mudou, error } = await db
    .from("propostas")
    .update({ status: aceitar ? "aceito" : "rejeitado", respondido_em: agora, resposta_nome: quem, resposta_mensagem: msg, atualizado_em: agora })
    .eq("id", p.id)
    .in("status", ["enviado", "visualizado"]) // condicional: dois cliques não respondem duas vezes
    .select("id");
  if (error) return { ok: false, erro: "Não consegui registrar sua resposta. Tente de novo." };
  if (!mudou?.length) return { ok: false, erro: "Esta proposta já foi respondida." };

  // Dono da proposta; se for antiga (sem user_id), avisa um gestor da empresa
  let dono: string | null = p.user_id ?? null;
  if (!dono) {
    const { data: ms } = await db.from("org_membros").select("user_id, papel").eq("org_id", p.org_id).eq("ativo", true);
    dono = (ms ?? []).find((m) => ehGestor(m.papel))?.user_id ?? null;
  }
  if (dono) {
    const valor = Number(p.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await db.from("tarefas").insert({
      org_id: p.org_id, user_id: dono, responsavel_id: dono, lead_id: p.lead_id, deal_id: p.deal_id,
      titulo: `${aceitar ? "✅ Proposta aceita" : "❌ Proposta recusada"}: ${p.titulo}`.slice(0, 200),
      descricao: [`${quem} ${aceitar ? "aceitou" : "recusou"} a proposta (${valor}) pelo link.`, msg ? `Mensagem: ${msg}` : ""].filter(Boolean).join("\n\n"),
      tipo: "outro", prioridade: "alta", vence_em: agora,
    });
  }
  return { ok: true };
}
