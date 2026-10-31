"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AcaoLote, MAX_ACOES_LOTE, desfazerAcoes, executarAcoes } from "@/lib/ai/lotes";
import type { ActionResult } from "@/lib/data/types";

/*
 * Aprovar / cancelar / desfazer lotes propostos pelo agente do CRM, e a memória
 * do usuário. Tudo com a sessão (RLS: o lote e a memória são só de quem conversa).
 */

const falha = (e: unknown): { ok: false; erro: string } => ({
  ok: false, erro: e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.",
});

const ATUALIZAR = ["/app/tarefas", "/app/leads", "/app/pipeline", "/app/calendario"];

export async function aprovarLote(id: string): Promise<ActionResult & { resultado?: string }> {
  try {
    const sb = await createClient();
    // Troca pendente → executado antes de rodar: dois cliques não executam duas vezes
    const { data: lote, error } = await sb.from("agente_lotes").update({ status: "executado", executado_em: new Date().toISOString() })
      .eq("id", id).eq("status", "pendente").select("acoes").maybeSingle();
    if (error) throw error;
    if (!lote) return { ok: false, erro: "Esse plano já foi aprovado, cancelado ou não existe." };
    const acoes = AcaoLote.array().max(MAX_ACOES_LOTE).safeParse(lote.acoes);
    if (!acoes.success) {
      await sb.from("agente_lotes").update({ status: "falhou", resultado: "Plano inválido." }).eq("id", id);
      return { ok: false, erro: "Plano inválido." };
    }
    const r = await executarAcoes(sb, acoes.data);
    if (r.erro) {
      await sb.from("agente_lotes").update({ status: "falhou", resultado: r.erro }).eq("id", id);
      return { ok: false, erro: r.erro };
    }
    const resultado = `${r.desfazer.length} de ${acoes.data.length} alterações feitas.`;
    await sb.from("agente_lotes").update({ desfazer: r.desfazer, resultado }).eq("id", id);
    ATUALIZAR.forEach((p) => revalidatePath(p));
    return { ok: true, resultado };
  } catch (e) { return falha(e); }
}

export async function cancelarLote(id: string): Promise<ActionResult> {
  try {
    const sb = await createClient();
    const { error } = await sb.from("agente_lotes").update({ status: "cancelado" }).eq("id", id).eq("status", "pendente");
    if (error) throw error;
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function desfazerLote(id: string): Promise<ActionResult> {
  try {
    const sb = await createClient();
    const { data: lote, error } = await sb.from("agente_lotes").update({ status: "desfeito", desfeito_em: new Date().toISOString() })
      .eq("id", id).eq("status", "executado").select("desfazer").maybeSingle();
    if (error) throw error;
    if (!lote) return { ok: false, erro: "Esse plano não pode mais ser desfeito." };
    await desfazerAcoes(sb, (lote.desfazer ?? []) as Parameters<typeof desfazerAcoes>[1]);
    ATUALIZAR.forEach((p) => revalidatePath(p));
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function statusDosLotes(ids: string[]): Promise<Record<string, { status: string; resultado: string | null }>> {
  if (!ids.length) return {};
  const sb = await createClient();
  const { data } = await sb.from("agente_lotes").select("id, status, resultado").in("id", ids.slice(0, 50));
  return Object.fromEntries((data ?? []).map((l) => [l.id, { status: l.status, resultado: l.resultado }]));
}

export async function minhaMemoria(): Promise<{ id: string; fato: string }[]> {
  const sb = await createClient();
  const { data } = await sb.from("agente_memoria_usuario").select("id, fato").order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function apagarMemoria(id: string): Promise<ActionResult> {
  try {
    const sb = await createClient();
    const { error } = await sb.from("agente_memoria_usuario").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return falha(e); }
}
