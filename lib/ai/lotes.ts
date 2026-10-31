import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LEAD_STATUS } from "@/lib/data/types";

/*
 * Lotes do agente do CRM (plano 5.2/5.3). O agente só PROPÕE: grava o lote como
 * "pendente" e o chat mostra o que vai mudar. Quem executa é o usuário, clicando
 * em Aprovar (server action com a sessão dele — o RLS vale para cada linha).
 * Cada ação executada deixa a receita para desfazer.
 */

const quando = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "use AAAA-MM-DD ou AAAA-MM-DDTHH:MM");

export const AcaoLote = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("criar_tarefa"),
    titulo: z.string().min(3).max(140),
    descricao: z.string().max(800).optional(),
    lead_id: z.string().uuid().optional(),
    quando: quando.optional(),
    tipo_tarefa: z.enum(["ligacao", "whatsapp", "email", "reuniao", "visita", "outro"]).optional(),
    prioridade: z.enum(["baixa", "media", "alta"]).optional(),
  }),
  z.object({
    tipo: z.literal("atualizar_lead"),
    lead_id: z.string().uuid(),
    status: z.enum(LEAD_STATUS).optional(),
    proximo_contato_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }),
  z.object({ tipo: z.literal("mover_negocio"), negocio_id: z.string().uuid(), etapa: z.string().min(1).max(60) }),
  z.object({ tipo: z.literal("concluir_tarefa"), tarefa_id: z.string().uuid() }),
]);
export type AcaoLote = z.infer<typeof AcaoLote>;
export const MAX_ACOES_LOTE = 200;

type Desfazer =
  | { t: "apagar_tarefa"; id: string }
  | { t: "lead"; id: string; antes: Record<string, unknown> }
  | { t: "negocio"; id: string; stage_id: string; etapa_entrada_em: string }
  | { t: "reabrir_tarefa"; id: string };

/** Texto curto de cada ação, para o cartão de aprovação. */
export function descreverAcao(a: AcaoLote, nomes: Record<string, string> = {}): string {
  switch (a.tipo) {
    case "criar_tarefa": return `Criar tarefa "${a.titulo}"${a.lead_id && nomes[a.lead_id] ? ` para ${nomes[a.lead_id]}` : ""}${a.quando ? ` (${a.quando.replace("T", " ")})` : ""}`;
    case "atualizar_lead": return `Atualizar ${nomes[a.lead_id] ?? "lead"}${a.status ? ` → status ${a.status}` : ""}${a.proximo_contato_em !== undefined ? ` · próximo contato ${a.proximo_contato_em ?? "(limpar)"}` : ""}`;
    case "mover_negocio": return `Mover ${nomes[a.negocio_id] ?? "negócio"} para "${a.etapa}"`;
    case "concluir_tarefa": return `Concluir ${nomes[a.tarefa_id] ? `"${nomes[a.tarefa_id]}"` : "tarefa"}`;
  }
}

/** Nomes legíveis dos registros citados (leads, negócios, tarefas) — só os que o usuário enxerga. */
export async function nomesDoLote(sb: SupabaseClient, acoes: AcaoLote[]) {
  const ids = (t: AcaoLote["tipo"], k: string) => [...new Set(acoes.filter((a) => a.tipo === t || (k === "lead_id" && a.tipo === "criar_tarefa")).map((a) => (a as Record<string, unknown>)[k]).filter(Boolean) as string[])];
  const leads = ids("atualizar_lead", "lead_id"), deals = ids("mover_negocio", "negocio_id"), tarefas = ids("concluir_tarefa", "tarefa_id");
  const [l, d, t] = await Promise.all([
    leads.length ? sb.from("leads").select("id, nome").in("id", leads) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    deals.length ? sb.from("deals").select("id, titulo").in("id", deals) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
    tarefas.length ? sb.from("tarefas").select("id, titulo").in("id", tarefas) : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
  ]);
  const nomes: Record<string, string> = {};
  for (const x of l.data ?? []) nomes[x.id] = x.nome;
  for (const x of d.data ?? []) nomes[x.id] = x.titulo;
  for (const x of t.data ?? []) nomes[x.id] = x.titulo;
  return nomes;
}

const deBrasilia = (q: string) => new Date(`${q.length === 10 ? `${q}T09:00` : q}:00-03:00`).toISOString();

/** Executa o lote aprovado. Para no primeiro erro e desfaz o que já tinha feito. */
export async function executarAcoes(sb: SupabaseClient, acoes: AcaoLote[]): Promise<{ desfazer: Desfazer[]; erro: string | null }> {
  const { data: orgId } = await sb.rpc("org_atual");
  const { data: etapas } = await sb.from("pipeline_stages").select("id, nome, pipeline_id").order("ordem");
  const feito: Desfazer[] = [];
  try {
    for (const a of acoes) {
      if (a.tipo === "criar_tarefa") {
        const { data, error } = await sb.from("tarefas").insert({
          org_id: orgId, titulo: a.titulo, descricao: [a.descricao, "Criada pelo agente de IA."].filter(Boolean).join("\n\n"),
          lead_id: a.lead_id ?? null, tipo: a.tipo_tarefa ?? "outro", prioridade: a.prioridade ?? "media",
          vence_em: a.quando ? deBrasilia(a.quando) : null,
        }).select("id").single();
        if (error) throw error;
        feito.push({ t: "apagar_tarefa", id: data.id });
      } else if (a.tipo === "atualizar_lead") {
        const { data: antes, error: e1 } = await sb.from("leads").select("status, proximo_contato_em").eq("id", a.lead_id).maybeSingle();
        if (e1) throw e1;
        if (!antes) throw new Error("Lead não encontrado.");
        const campos: Record<string, unknown> = {};
        if (a.status) campos.status = a.status;
        if (a.proximo_contato_em !== undefined) campos.proximo_contato_em = a.proximo_contato_em;
        if (!Object.keys(campos).length) continue;
        const { error } = await sb.from("leads").update(campos).eq("id", a.lead_id);
        if (error) throw error;
        feito.push({ t: "lead", id: a.lead_id, antes: Object.fromEntries(Object.keys(campos).map((k) => [k, (antes as Record<string, unknown>)[k]])) });
      } else if (a.tipo === "mover_negocio") {
        const { data: d, error: e1 } = await sb.from("deals").select("stage_id, etapa_entrada_em").eq("id", a.negocio_id).maybeSingle();
        if (e1) throw e1;
        if (!d) throw new Error("Negócio não encontrado.");
        const atual = etapas?.find((e) => e.id === d.stage_id);
        const alvo = etapas?.find((e) => e.pipeline_id === atual?.pipeline_id && e.nome.toLowerCase() === a.etapa.trim().toLowerCase());
        if (!alvo) throw new Error(`Etapa "${a.etapa}" não existe no funil desse negócio.`);
        if (alvo.id === d.stage_id) continue;
        const { error } = await sb.from("deals").update({ stage_id: alvo.id, etapa_entrada_em: new Date().toISOString() }).eq("id", a.negocio_id);
        if (error) throw error;
        feito.push({ t: "negocio", id: a.negocio_id, stage_id: d.stage_id, etapa_entrada_em: d.etapa_entrada_em });
      } else {
        const { data, error } = await sb.from("tarefas").update({ concluida_em: new Date().toISOString() }).eq("id", a.tarefa_id).is("concluida_em", null).select("id");
        if (error) throw error;
        if (data?.length) feito.push({ t: "reabrir_tarefa", id: a.tarefa_id });
      }
    }
    return { desfazer: feito, erro: null };
  } catch (e) {
    await desfazerAcoes(sb, feito).catch(() => {});
    const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "falha";
    return { desfazer: [], erro: `Parou na ação ${feito.length + 1} de ${acoes.length}: ${msg}. Nada foi alterado.` };
  }
}

/** Reverte na ordem inversa. */
export async function desfazerAcoes(sb: SupabaseClient, passos: Desfazer[]) {
  for (const p of [...passos].reverse()) {
    if (p.t === "apagar_tarefa") await sb.from("tarefas").delete().eq("id", p.id);
    else if (p.t === "lead") await sb.from("leads").update(p.antes).eq("id", p.id);
    else if (p.t === "negocio") await sb.from("deals").update({ stage_id: p.stage_id, etapa_entrada_em: p.etapa_entrada_em }).eq("id", p.id);
    else await sb.from("tarefas").update({ concluida_em: null }).eq("id", p.id);
  }
}
