import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatilhoAutomacao } from "@/lib/data/types";

/* Motor de automações QUANDO/SE/ENTÃO — versão simples do Tappo (sem fila/worker):
 * roda de forma síncrona dentro da própria Server Action, logo após a mutação principal.
 * Uma automação com erro nunca derruba a ação que a disparou. */

type Contexto = { leadId?: string | null; dealId?: string | null };

export async function dispararAutomacoes(supabase: SupabaseClient, gatilho: GatilhoAutomacao, valor: string | null, ctx: Contexto) {
  try {
    const { data: regras } = await supabase
      .from("automacoes")
      .select("id, acao, acao_valor, gatilho_valor, execucoes")
      .eq("ativo", true)
      .eq("gatilho", gatilho);
    for (const r of regras ?? []) {
      if (r.gatilho_valor && r.gatilho_valor !== valor) continue;
      try {
        await aplicarAcao(supabase, r.acao as string, r.acao_valor as string | null, ctx);
        await supabase.from("automacoes").update({ execucoes: (r.execucoes as number) + 1 }).eq("id", r.id);
      } catch { /* uma regra com erro não impede as demais nem a ação original */ }
    }
  } catch { /* tabela indisponível, RLS, etc — nunca interrompe quem chamou */ }
}

async function aplicarAcao(supabase: SupabaseClient, acao: string, valor: string | null, ctx: Contexto) {
  if (!valor) return;
  const vencimento = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (acao === "mover_etapa" && ctx.dealId) {
    await supabase.from("deals").update({ stage_id: valor }).eq("id", ctx.dealId);
  } else if (acao === "adicionar_tag" && ctx.leadId) {
    await supabase.from("lead_tag_rel").upsert({ lead_id: ctx.leadId, tag_id: valor }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
  } else if (acao === "criar_tarefa") {
    await supabase.from("tarefas").insert({ titulo: valor, lead_id: ctx.leadId ?? null, deal_id: ctx.dealId ?? null, vence_em: vencimento });
  } else if (acao === "atribuir_responsavel") {
    // Não há coluna de responsável direto em leads/deals: a automação cria uma tarefa
    // para a pessoa escolhida, reaproveitando tarefas.responsavel_id.
    await supabase.from("tarefas").insert({ titulo: "Acompanhar lead", responsavel_id: valor, lead_id: ctx.leadId ?? null, deal_id: ctx.dealId ?? null, vence_em: vencimento });
  }
}
