"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACOES_AUTOMACAO, GATILHOS_AUTOMACAO, type ActionResult } from "@/lib/data/types";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function salvarAutomacao(f: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const id = String(f.get("id") ?? "").trim();
    const nome = String(f.get("nome") ?? "").trim();
    const gatilho = String(f.get("gatilho") ?? "");
    const acao = String(f.get("acao") ?? "");
    if (!nome) return { ok: false, erro: "Informe o nome da automação." };
    if (!(GATILHOS_AUTOMACAO as readonly string[]).includes(gatilho)) return { ok: false, erro: "Gatilho inválido." };
    if (!(ACOES_AUTOMACAO as readonly string[]).includes(acao)) return { ok: false, erro: "Ação inválida." };
    const payload = {
      nome,
      gatilho,
      acao,
      gatilho_valor: String(f.get("gatilho_valor") ?? "").trim() || null,
      acao_valor: String(f.get("acao_valor") ?? "").trim() || null,
    };
    const { error } = id
      ? await supabase.from("automacoes").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id)
      : await supabase.from("automacoes").insert(payload);
    if (error) throw error;
    revalidatePath("/app/automacoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function alternarAutomacao(id: string, ativo: boolean): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("automacoes").update({ ativo }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/automacoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirAutomacao(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("automacoes").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/automacoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}
