"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/types";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function salvarProposta(f: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const id = String(f.get("id") ?? "").trim();
    const titulo = String(f.get("titulo") ?? "").trim();
    const valor = Number(f.get("valor") ?? 0) || 0;
    const lead_id = String(f.get("lead_id") ?? "") || null;
    const deal_id = String(f.get("deal_id") ?? "") || null;
    const status = String(f.get("status") ?? "rascunho");
    if (!titulo) return { ok: false, erro: "Informe o título da proposta." };
    const payload: Record<string, unknown> = { titulo, valor, lead_id, deal_id, status };
    if (!id) {
      const { error } = await supabase.from("propostas").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("propostas").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    revalidatePath("/app/propostas");
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirProposta(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("propostas").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/propostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function enviarProposta(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("propostas").update({ status: "enviado", enviado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/propostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}
