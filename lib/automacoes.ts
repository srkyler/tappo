import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatilhoAutomacao } from "@/lib/data/types";

/* Motor de automações QUANDO/SE/ENTÃO — versão simples do Tappo (sem fila/worker):
 * roda de forma síncrona dentro da própria Server Action, logo após a mutação principal.
 * Uma automação com erro nunca derruba a ação que a disparou.
 *
 * Com sessão (createClient) o RLS isola a empresa. Chamado de rota pública com
 * service role (createAdminClient), passe `orgId` (e `userId` do dono): o filtro
 * por empresa passa a ser manual e os inserts levam org_id/user_id. */

type Contexto = { leadId?: string | null; dealId?: string | null; orgId?: string | null; userId?: string | null };

/** acao_valor do "enviar_email": JSON { assunto, texto } com {{nome}}, {{empresa}}, {{primeiro_nome}}. */
export type EmailAutomacao = { assunto: string; texto: string };

export function lerEmailAutomacao(valor: string | null): EmailAutomacao | null {
  if (!valor) return null;
  try {
    const j = JSON.parse(valor) as Partial<EmailAutomacao>;
    if (typeof j.assunto === "string" && typeof j.texto === "string" && j.assunto.trim() && j.texto.trim()) return { assunto: j.assunto, texto: j.texto };
  } catch { /* formato antigo/ inválido */ }
  return null;
}

export function preencherVariaveis(modelo: string, lead: { nome?: string | null; empresa?: string | null }): string {
  const nome = (lead.nome ?? "").trim();
  return modelo
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, nome.split(/\s+/)[0] ?? "")
    .replace(/\{\{\s*nome\s*\}\}/gi, nome)
    .replace(/\{\{\s*empresa\s*\}\}/gi, (lead.empresa ?? "").trim());
}

export async function dispararAutomacoes(supabase: SupabaseClient, gatilho: GatilhoAutomacao, valor: string | null, ctx: Contexto) {
  try {
    let q = supabase
      .from("automacoes")
      .select("id, org_id, acao, acao_valor, gatilho_valor, execucoes")
      .eq("ativo", true)
      .eq("gatilho", gatilho);
    if (ctx.orgId) q = q.eq("org_id", ctx.orgId);
    const { data: regras } = await q;
    for (const r of regras ?? []) {
      if (r.gatilho_valor && r.gatilho_valor !== valor) continue;
      try {
        await aplicarAcao(supabase, r.acao as string, r.acao_valor as string | null, { ...ctx, orgId: ctx.orgId ?? (r.org_id as string) });
        await supabase.from("automacoes").update({ execucoes: (r.execucoes as number) + 1 }).eq("id", r.id);
      } catch { /* uma regra com erro não impede as demais nem a ação original */ }
    }
  } catch { /* tabela indisponível, RLS, etc — nunca interrompe quem chamou */ }
}

async function aplicarAcao(supabase: SupabaseClient, acao: string, valor: string | null, ctx: Contexto) {
  if (!valor) return;
  const vencimento = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Em service role, auth.uid() é nulo: os defaults de org_id/user_id não valem
  const dono = ctx.userId ? { org_id: ctx.orgId, user_id: ctx.userId } : {};
  if (acao === "mover_etapa" && ctx.dealId) {
    await supabase.from("deals").update({ stage_id: valor }).eq("id", ctx.dealId);
  } else if (acao === "adicionar_tag" && ctx.leadId) {
    await supabase.from("lead_tag_rel").upsert({ lead_id: ctx.leadId, tag_id: valor, ...(ctx.userId ? { org_id: ctx.orgId } : {}) }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
  } else if (acao === "criar_tarefa") {
    await supabase.from("tarefas").insert({ ...dono, titulo: valor, lead_id: ctx.leadId ?? null, deal_id: ctx.dealId ?? null, vence_em: vencimento });
  } else if (acao === "atribuir_responsavel") {
    // Não há coluna de responsável direto em leads/deals: a automação cria uma tarefa
    // para a pessoa escolhida, reaproveitando tarefas.responsavel_id.
    await supabase.from("tarefas").insert({ ...dono, titulo: "Acompanhar lead", responsavel_id: valor, lead_id: ctx.leadId ?? null, deal_id: ctx.dealId ?? null, vence_em: vencimento });
  } else if (acao === "enviar_email" && ctx.leadId) {
    await enviarEmailAoLead(supabase, valor, ctx);
  }
}

/** E-mail para o lead pelo endereço da empresa; fica na conversa de e-mail do inbox. */
async function enviarEmailAoLead(supabase: SupabaseClient, valor: string, ctx: Contexto) {
  const modelo = lerEmailAutomacao(valor);
  if (!modelo || !process.env.RESEND_API_KEY || !ctx.orgId) return;
  const [{ data: lead }, { data: con }] = await Promise.all([
    supabase.from("leads").select("id, nome, empresa, email").eq("id", ctx.leadId!).eq("org_id", ctx.orgId).maybeSingle(),
    supabase.from("email_conexoes").select("endereco_envia").eq("org_id", ctx.orgId).maybeSingle(),
  ]);
  const para = lead?.email?.trim().toLowerCase();
  if (!lead || !para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para) || !con?.endereco_envia) return;

  const assunto = preencherVariaveis(modelo.assunto, lead).slice(0, 200);
  const texto = preencherVariaveis(modelo.texto, lead).slice(0, 10000);
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: con.endereco_envia, to: para, subject: assunto, text: texto });
  if (error) throw new Error(error.message);

  // Registro no inbox (best-effort): conversa de e-mail do lead
  const { data: conversa } = await supabase.from("wa_conversas")
    .upsert({ org_id: ctx.orgId, canal: "email", chat_id: para, nome: lead.nome, lead_id: lead.id }, { onConflict: "org_id,chat_id" })
    .select("id").single();
  if (conversa) {
    await supabase.from("wa_mensagens").insert({
      org_id: ctx.orgId, conversa_id: conversa.id, canal: "email", direcao: "saida", autor: "humano",
      tipo: "texto", corpo: `${assunto}\n\n${texto}`, status: "enviada",
    });
    await supabase.from("wa_conversas").update({ ultima_mensagem: assunto.slice(0, 140), ultima_em: new Date().toISOString() }).eq("id", conversa.id);
  }
}
