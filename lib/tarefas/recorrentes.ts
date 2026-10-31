import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Tarefas recorrentes: o agendador (tick a cada 15 min) cria a tarefa do dia e
 * empurra proxima_execucao para a próxima ocorrência. Se o servidor ficou parado,
 * gera UMA tarefa (não uma rajada com todas as perdidas) e pula para o futuro.
 * A troca de proxima_execucao é condicional ao valor lido — dois ticks ao mesmo
 * tempo não duplicam a tarefa.
 */

export type Recorrencia = "diaria" | "semanal" | "mensal" | "anual";

export function proximaOcorrencia(de: Date, r: Recorrencia, agora = new Date()): Date {
  const dia = de.getUTCDate();
  const d = new Date(de);
  do {
    if (r === "diaria") d.setUTCDate(d.getUTCDate() + 1);
    else if (r === "semanal") d.setUTCDate(d.getUTCDate() + 7);
    else if (r === "mensal") {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      // 31/jan → 28/fev (não 3/mar), e volta ao dia 31 em março
      d.setUTCDate(Math.min(dia, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
    } else d.setUTCFullYear(d.getUTCFullYear() + 1);
  } while (d <= agora);
  return d;
}

export async function gerarTarefasRecorrentes(db: SupabaseClient) {
  const agora = new Date();
  const { data, error } = await db.from("tarefas_recorrentes").select("*")
    .eq("ativa", true).lte("proxima_execucao", agora.toISOString()).limit(500);
  if (error) throw error;
  let criadas = 0;
  for (const r of data ?? []) {
    const proxima = proximaOcorrencia(new Date(r.proxima_execucao), r.recorrencia as Recorrencia, agora);
    const { data: pega } = await db.from("tarefas_recorrentes")
      .update({ proxima_execucao: proxima.toISOString(), atualizado_em: agora.toISOString() })
      .eq("id", r.id).eq("proxima_execucao", r.proxima_execucao).select("id");
    if (!pega?.length) continue; // outro tick já pegou
    const { error: e2 } = await db.from("tarefas").insert({
      org_id: r.org_id, user_id: r.user_id, responsavel_id: r.user_id,
      titulo: r.titulo, descricao: [r.descricao, "Gerada por uma tarefa recorrente."].filter(Boolean).join("\n\n"),
      tipo: r.tipo, prioridade: r.prioridade, vence_em: r.proxima_execucao,
    });
    if (!e2) criadas++;
  }
  return { vencidas: data?.length ?? 0, criadas };
}
