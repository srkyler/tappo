"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
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
    const descricao = String(f.get("descricao") ?? "").trim().slice(0, 8000) || null;
    if (!titulo) return { ok: false, erro: "Informe o título da proposta." };
    const payload: Record<string, unknown> = { titulo, valor, lead_id, deal_id, status };
    if (f.has("descricao")) payload.descricao = descricao;
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

/**
 * Gera (ou reaproveita) o link público da proposta e marca como enviada.
 * O cliente abre /p/<token>, vê a proposta e aceita ou recusa — sem login.
 */
export async function enviarProposta(id: string, validadeDias = 30): Promise<ActionResult & { link?: string }> {
  try {
    const supabase = await createClient();
    const { data: p, error: e1 } = await supabase.from("propostas").select("token_publico, status").eq("id", id).maybeSingle();
    if (e1) throw e1;
    if (!p) return { ok: false, erro: "Proposta não encontrada." };
    const token = p.token_publico ?? randomBytes(24).toString("base64url");
    const agora = new Date();
    const { error } = await supabase.from("propostas").update({
      token_publico: token,
      link_expira_em: new Date(agora.getTime() + Math.min(180, Math.max(1, validadeDias)) * 86_400_000).toISOString(),
      ...(p.status === "rascunho" || p.status === "expirado" ? { status: "enviado", enviado_em: agora.toISOString() } : {}),
      atualizado_em: agora.toISOString(),
    }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/propostas");
    const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    return { ok: true, link: `${app}/p/${token}` };
  } catch (e) { return falha(e); }
}

/** Corta o link público (o cliente não consegue mais abrir). */
export async function revogarLinkProposta(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("propostas").update({ token_publico: null, link_expira_em: null }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/propostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}
