"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postarWebhook } from "@/lib/webhooks/saida";
import type { ActionResult } from "@/lib/data/types";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

/* Webhooks de saída — o Tappo envia POSTs assinados (HMAC-SHA256) para URLs da empresa.
   Só gestor cria/edita/reenvia; o segredo é exibido só para gestor na tela. */

async function gestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const empresa = await empresaAtual();
  if (!empresa || !ehGestor(empresa.papel)) throw new Error("Só o dono ou um gestor pode gerenciar webhooks.");
  return { supabase, user };
}

const EVENTOS_VALIDOS = ["lead.criado", "lead.atualizado", "lead.etapa_mudou", "conversa.nova", "mensagem.nova"];

function falha(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : "Erro ao salvar o webhook.";
  return { ok: false, erro: msg.includes("Só o dono") ? msg : "Não foi possível salvar. Tente novamente." };
}

export async function salvarWebhookSaida(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await gestor();
    const url = String(f.get("url") ?? "").trim();
    let u: URL | null = null;
    try { u = new URL(url); } catch { u = null; }
    if (!u || !/^https?:$/.test(u.protocol)) return { ok: false, erro: "Informe uma URL válida começando com https:// (ou http://)." };

    const eventos = f.getAll("eventos").map(String).filter((e) => EVENTOS_VALIDOS.includes(e));
    if (eventos.length === 0) return { ok: false, erro: "Marque pelo menos um evento." };

    const { error } = await supabase.from("webhook_saida").insert({
      url: u.toString(),
      eventos,
      ativo: true,
      criado_por: user.id,
    });
    if (error) throw error;
    revalidatePath("/app/webhooks");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function alternarWebhookSaida(id: string, ativo: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { error } = await supabase.from("webhook_saida").update({ ativo }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/webhooks");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirWebhookSaida(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { error } = await supabase.from("webhook_saida").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/webhooks");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function regenerarSegredoWebhook(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { error } = await supabase.from("webhook_saida")
      .update({ secret: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "") })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/app/webhooks");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function reenviarWebhookLog(logId: string): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { data: log } = await supabase.from("webhook_saida_log")
      .select("webhook_id, evento, payload").eq("id", logId).maybeSingle();
    if (!log) return { ok: false, erro: "Envio não encontrado." };
    const { data: wh } = await supabase.from("webhook_saida")
      .select("url, secret").eq("id", log.webhook_id).maybeSingle();
    if (!wh) return { ok: false, erro: "Este webhook foi excluído." };

    const payload = (log.payload ?? {}) as { dados?: Record<string, unknown> };
    const r = await postarWebhook(wh, log.evento, payload.dados ?? {});
    await supabase.from("webhook_saida_log").insert({
      webhook_id: log.webhook_id,
      evento: log.evento,
      payload: log.payload,
      status: r.status,
      erro: r.erro,
    });
    revalidatePath("/app/webhooks");
    return r.status && r.status < 400
      ? { ok: true }
      : { ok: false, erro: r.erro ?? `O destino respondeu HTTP ${r.status ?? "?"}.` };
  } catch (e) { return falha(e); }
}
