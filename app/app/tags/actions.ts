"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispararAutomacoes } from "@/lib/automacoes";
import type { ActionResult } from "@/lib/data/types";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function salvarTag(f: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const nome = String(f.get("nome") ?? "").trim();
    const cor = String(f.get("cor") ?? "#6B7280");
    if (!nome) return { ok: false, erro: "Informe o nome da tag." };
    const { error } = await supabase.from("lead_tags").insert({ nome, cor });
    if (error) throw error;
    revalidatePath("/app/tags");
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirTag(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("lead_tags").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/tags");
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function toggleTagLead(leadId: string, tagId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: existente } = await supabase
      .from("lead_tag_rel")
      .select("lead_id")
      .eq("lead_id", leadId)
      .eq("tag_id", tagId)
      .maybeSingle();
    if (existente) {
      const { error } = await supabase.from("lead_tag_rel").delete().eq("lead_id", leadId).eq("tag_id", tagId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("lead_tag_rel").insert({ lead_id: leadId, tag_id: tagId });
      if (error) throw error;
      await dispararAutomacoes(supabase, "tag_adicionada", tagId, { leadId });
    }
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}
