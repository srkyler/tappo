"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { empresaAtual } from "@/lib/data/empresa";
import type { ActionResult, Tarefa } from "@/lib/data/types";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

export async function listarTarefas() {
  const { supabase } = await cliente();
  const empresa = await empresaAtual();
  if (!empresa) return { tarefas: [] as Tarefa[], empresa: null as { id: string; nome: string } | null };
    const { data } = await supabase
    .from("tarefas")
    .select("*")
    .eq("org_id", empresa.id)
    .order("vence_em", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return { tarefas: (data ?? []) as Tarefa[], empresa };
}

export async function criarTarefa(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." };
    const titulo = String(f.get("titulo") ?? "").trim();
    if (!titulo) return { ok: false, erro: "Informe o título." };
    const tipo = String(f.get("tipo") ?? "outro");
    const prioridade = String(f.get("prioridade") ?? "media");
    const vence_em = String(f.get("vence_em") ?? "") || null;
    const responsavel_id = String(f.get("responsavel_id") ?? "") || null;
    const lead_id = String(f.get("lead_id") ?? "") || null;
    const deal_id = String(f.get("deal_id") ?? "") || null;
    const conversa_id = String(f.get("conversa_id") ?? "") || null;
    const descricao = String(f.get("descricao") ?? "").trim() || null;
    const { error } = await supabase.from("tarefas").insert({
      org_id: empresa.id, user_id: user.id, responsavel_id: responsavel_id || user.id,
      lead_id, deal_id, conversa_id, titulo, descricao, tipo, prioridade,
      vence_em: vence_em ? new Date(vence_em).toISOString() : null,
    });
    if (error) throw error;
    revalidatePath("/app/tarefas");
    revalidatePath("/app/gestor");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function concluirTarefa(id: string, concluida: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("tarefas").update({ concluida_em: concluida ? new Date().toISOString() : null }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/tarefas");
    revalidatePath("/app/gestor");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirTarefa(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/tarefas");
    return { ok: true };
  } catch (e) { return falha(e); }
}
