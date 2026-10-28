"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirSuperAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { cifrar, finalDaChave } from "@/lib/ai/cofre";
import { presetPorId } from "@/lib/ai/provedores";
import { rodarAgente } from "@/lib/ai/motor";
import type { Agente } from "@/lib/ai/agentes";
import type { ActionResult } from "@/lib/data/types";

const Entrada = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao agente.").max(80),
  descricao: z.string().trim().max(300).nullable(),
  preset: z.string().min(1),
  base_url: z.string().trim().max(300).nullable(),
  modelo: z.string().trim().min(1, "Informe o modelo.").max(150),
  api_key: z.string().trim().max(500).nullable(), // vazio = mantém a atual
  remover_chave: z.boolean(),
  esforco: z.enum(["low", "medium", "high"]),
  max_tokens: z.number().int().min(256).max(16000),
  temperatura: z.number().min(0).max(2).nullable(),
  max_historico: z.number().int().min(2).max(40),
  teto_tokens_mes: z.number().int().positive().nullable(),
  teto_tokens_usuario_dia: z.number().int().positive().nullable(),
  instrucoes: z.string().max(8000),
  pode_editar_dados: z.boolean(),
});
export type EntradaAgente = z.input<typeof Entrada>;

const erro = (e: unknown): ActionResult => ({
  ok: false,
  erro: e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.",
});

export async function salvarAgente(id: string | null, entrada: EntradaAgente): Promise<ActionResult> {
  const user = await exigirAdmin();
  const p = Entrada.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const d = p.data;
  const preset = presetPorId(d.preset);
  const baseUrl = preset.tipo === "openai" ? (d.base_url || preset.baseUrl || "").replace(/\/+$/, "") : null;
  if (preset.tipo === "openai" && !/^https?:\/\/[^\s]+$/.test(baseUrl ?? "")) return { ok: false, erro: "Informe a URL base da API (https://…)." };

  try {
    const registro: Record<string, unknown> = {
      nome: d.nome, descricao: d.descricao || null, provedor: preset.tipo, preset: preset.id, base_url: baseUrl,
      modelo: d.modelo, esforco: d.esforco, max_tokens: d.max_tokens, temperatura: d.temperatura,
      max_historico: d.max_historico, teto_tokens_mes: d.teto_tokens_mes, teto_tokens_usuario_dia: d.teto_tokens_usuario_dia, instrucoes: d.instrucoes, pode_editar_dados: d.pode_editar_dados,
    };
    if (d.api_key) {
      registro.api_key_cifrada = cifrar(d.api_key);
      registro.api_key_final = finalDaChave(d.api_key);
    } else if (d.remover_chave) {
      registro.api_key_cifrada = null;
      registro.api_key_final = null;
    }
    const db = createAdminClient();
    const { error } = id
      ? await db.from("ai_agents").update(registro).eq("id", id)
      : await db.from("ai_agents").insert({ ...registro, created_by: user.id });
    if (error) return erro(error);
    revalidatePath("/admin");
  revalidatePath("/app/agentes");
    return { ok: true };
  } catch (e) { return erro(e); }
}

export async function ativarAgente(id: string): Promise<ActionResult> {
  await exigirAdmin();
  const { error } = await createAdminClient().rpc("ativar_agente", { agente: id });
  if (error) return erro(error);
  revalidatePath("/admin");
  revalidatePath("/app/agentes");
  revalidatePath("/app/agente");
  return { ok: true };
}

export async function desativarAgentes(): Promise<ActionResult> {
  await exigirAdmin();
  const { error } = await createAdminClient().from("ai_agents").update({ ativo: false }).eq("ativo", true);
  if (error) return erro(error);
  revalidatePath("/admin");
  revalidatePath("/app/agentes");
  return { ok: true };
}

export async function excluirAgente(id: string): Promise<ActionResult> {
  await exigirAdmin();
  const { error } = await createAdminClient().from("ai_agents").delete().eq("id", id);
  if (error) return erro(error);
  revalidatePath("/admin");
  revalidatePath("/app/agentes");
  return { ok: true };
}

export async function duplicarAgente(id: string): Promise<ActionResult> {
  const user = await exigirAdmin();
  const db = createAdminClient();
  const { data, error } = await db.from("ai_agents").select("*").eq("id", id).single();
  if (error) return erro(error);
  const { id: _id, created_at: _c, updated_at: _u, ativo: _a, ...resto } = data as Agente;
  const { error: e2 } = await db.from("ai_agents").insert({ ...resto, nome: `${resto.nome} (cópia)`, ativo: false, created_by: user.id });
  if (e2) return erro(e2);
  revalidatePath("/admin");
  revalidatePath("/app/agentes");
  return { ok: true };
}

/** Só o super admin (SUPER_ADMIN_EMAIL) pode tornar — ou deixar de ser — outra pessoa admin. */
export async function definirAdmin(userId: string, tornarAdmin: boolean): Promise<ActionResult> {
  const user = await exigirSuperAdmin();
  if (userId === user.id) return { ok: false, erro: "Você já é o super admin — não precisa (e não pode) mudar isso em si mesmo." };
  const { error } = await createAdminClient().from("profiles").update({ papel: tornarAdmin ? "admin" : "membro" }).eq("id", userId);
  if (error) return erro(error);
  revalidatePath("/admin");
  revalidatePath("/app/agentes");
  return { ok: true };
}

/** Teste rápido de conexão: uma pergunta curta, sem ferramentas. */
export async function testarAgente(id: string): Promise<ActionResult & { resposta?: string; ms?: number; tokens?: number }> {
  await exigirAdmin();
  const { data, error } = await createAdminClient().from("ai_agents").select("*").eq("id", id).single();
  if (error) return erro(error);
  const inicio = Date.now();
  let resposta = "";
  let falha = "";
  try {
    const uso = await rodarAgente({
      agente: { ...(data as Agente), max_tokens: Math.min((data as Agente).max_tokens, 1024), max_historico: 2 },
      sb: null,
      mensagens: [{ role: "user", content: "Teste de conexão: responda apenas 'OK, funcionando.'" }],
      emitir: (e) => { if (e.t === "texto") resposta += e.d; if (e.t === "erro") falha = e.d; },
      sinal: AbortSignal.timeout(45_000),
    });
    if (!resposta && falha) return { ok: false, erro: falha };
    return { ok: true, resposta: resposta.trim().slice(0, 200) || "(sem texto)", ms: Date.now() - inicio, tokens: uso.entrada + uso.cache + uso.saida };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: /401|403|auth|api.key|x-api-key/i.test(msg) ? `Chave recusada pelo provedor. (${msg.slice(0, 160)})` : msg.slice(0, 300) };
  }
}
