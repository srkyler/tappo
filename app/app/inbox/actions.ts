"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "@/lib/ai/cofre";
import { enviarERegistrar } from "@/lib/whatsapp/atendimento";
import { chatDoTelefone, desconectar, iniciarSessao, lerQr, lerSessao, marcarLida, type Conexao } from "@/lib/whatsapp/waha";
import type { ActionResult } from "@/lib/data/types";

/* Inbox do WhatsApp — tudo pelo cliente do usuário (RLS = dono). */

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: /fetch failed|ECONNREFUSED|timeout/i.test(msg) ? "Não foi possível falar com o servidor WAHA. Confira a URL." : msg };
}

async function minhaConexao(): Promise<Conexao> {
  const { supabase } = await cliente();
  const { data } = await supabase.from("wa_conexoes").select("*").maybeSingle();
  if (!data) throw new Error("Configure a conexão com o WAHA primeiro.");
  return data as Conexao;
}

/* ---------------- Conexão ---------------- */

export async function salvarConexao(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const base_url = String(f.get("base_url") ?? "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/\S+$/.test(base_url)) return { ok: false, erro: "Informe a URL do WAHA (ex.: https://waha.suaempresa.com)." };
    const sessao = String(f.get("sessao") ?? "default").trim() || "default";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessao)) return { ok: false, erro: "Nome da sessão: só letras, números, _ e -." };
    const chave = String(f.get("api_key") ?? "").trim();
    const { error } = await supabase.from("wa_conexoes").upsert({
      user_id: user.id,
      base_url,
      sessao,
      ia_ativa: f.get("ia_ativa") === "on",
      ia_instrucoes: String(f.get("ia_instrucoes") ?? "").slice(0, 6000),
      ...(chave ? { api_key_cifrada: cifrar(chave) } : {}),
      ...(f.get("remover_chave") === "on" ? { api_key_cifrada: null } : {}),
    }, { onConflict: "user_id" });
    if (error) throw error;
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export type EstadoWhats = { ok: true; status: string; numero: string | null; qr: string | null } | { ok: false; erro: string };

export async function estadoWhatsApp(): Promise<EstadoWhats> {
  try {
    const c = await minhaConexao();
    const s = await lerSessao(c);
    const numero = s.me?.id?.split("@")[0] ?? null;
    const qr = s.status === "SCAN_QR_CODE" ? await lerQr(c).catch(() => null) : null;
    if (s.status !== c.status || numero !== c.numero) {
      const { supabase } = await cliente();
      await supabase.from("wa_conexoes").update({ status: s.status, numero }).eq("id", c.id);
    }
    return { ok: true, status: s.status, numero, qr };
  } catch (e) {
    const r = falha(e);
    return r.erro.includes("Sessão não encontrada") ? { ok: true, status: "STOPPED", numero: null, qr: null } : r;
  }
}

export async function conectarWhatsApp(): Promise<ActionResult> {
  try {
    await iniciarSessao(await minhaConexao());
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function desconectarWhatsApp(): Promise<ActionResult> {
  try {
    const c = await minhaConexao();
    await desconectar(c);
    const { supabase } = await cliente();
    await supabase.from("wa_conexoes").update({ status: "STOPPED", numero: null }).eq("id", c.id);
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Conversas ---------------- */

export async function enviarMensagem(conversaId: string, texto: string): Promise<ActionResult> {
  try {
    const t = texto.trim();
    if (!t) return { ok: false, erro: "Mensagem vazia." };
    if (t.length > 4000) return { ok: false, erro: "Mensagem longa demais (máx. 4000 caracteres)." };
    const { supabase } = await cliente();
    const { data: conversa } = await supabase.from("wa_conversas").select("id, chat_id, status").eq("id", conversaId).single();
    if (!conversa) return { ok: false, erro: "Conversa não encontrada." };
    await enviarERegistrar(supabase, await minhaConexao(), conversa, t, "humano");
    if (conversa.status === "resolvida") await supabase.from("wa_conversas").update({ status: "aberta" }).eq("id", conversaId);
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function marcarComoLida(conversaId: string): Promise<void> {
  try {
    const { supabase } = await cliente();
    const { data } = await supabase.from("wa_conversas").update({ nao_lidas: 0 }).eq("id", conversaId).select("chat_id").single();
    if (data) await marcarLida(await minhaConexao(), data.chat_id);
  } catch { /* melhor esforço */ }
}

export async function atualizarConversa(conversaId: string, mudanca: { status?: "aberta" | "pendente" | "resolvida"; ia_ativa?: boolean }): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const campos: Record<string, unknown> = {};
    if (mudanca.status && ["aberta", "pendente", "resolvida"].includes(mudanca.status)) campos.status = mudanca.status;
    if (typeof mudanca.ia_ativa === "boolean") campos.ia_ativa = mudanca.ia_ativa;
    const { error } = await supabase.from("wa_conversas").update(campos).eq("id", conversaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function criarLeadDaConversa(conversaId: string, empresa: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const { data: c } = await supabase.from("wa_conversas").select("id, nome, telefone, chat_id, lead_id").eq("id", conversaId).single();
    if (!c) return { ok: false, erro: "Conversa não encontrada." };
    if (c.lead_id) return { ok: true };
    const { data: lead, error } = await supabase.from("leads").insert({
      user_id: user.id,
      nome: c.nome || c.telefone || "Contato WhatsApp",
      empresa: empresa.trim() || "Não informada",
      telefone: c.telefone,
      origem: "Outro",
      status: "Contatado",
      notas: "Criado a partir do inbox do WhatsApp.",
    }).select("id").single();
    if (error) throw error;
    await supabase.from("wa_conversas").update({ lead_id: lead.id }).eq("id", conversaId);
    await supabase.from("activities").insert({ user_id: user.id, lead_id: lead.id, tipo: "whatsapp", descricao: "Conversa iniciada no WhatsApp" });
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function novaConversa(telefone: string, texto: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  try {
    const chatId = chatDoTelefone(telefone);
    if (!chatId) return { ok: false, erro: "Telefone inválido. Use DDD + número." };
    const { supabase, user } = await cliente();
    const { data: conversa, error } = await supabase.from("wa_conversas")
      .upsert({ user_id: user.id, chat_id: chatId, telefone: chatId.split("@")[0], ia_ativa: false }, { onConflict: "user_id,chat_id", ignoreDuplicates: false })
      .select("id, chat_id").single();
    if (error) throw error;
    if (texto.trim()) await enviarERegistrar(supabase, await minhaConexao(), conversa, texto.trim(), "humano");
    return { ok: true, id: conversa.id };
  } catch (e) { return falha(e); }
}
