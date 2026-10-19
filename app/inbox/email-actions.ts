"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarEmailERegistrar, type EmailConexao } from "@/lib/email/atendimento";
import type { ActionResult } from "@/lib/data/types";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

/* Canal de e-mail do inbox — ações separadas das de WhatsApp (app/app/inbox/actions.ts)
 * só pra não editar aquele arquivo. Mesmo RLS (dono da empresa). */

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function salvarEmailConexao(f: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa || !ehGestor(empresa.papel)) return { ok: false, erro: "Só o dono ou um gestor pode configurar o e-mail." };
    const enderecoRecebe = String(f.get("endereco_recebe") ?? "").trim().toLowerCase();
    const enderecoEnvia = String(f.get("endereco_envia") ?? "").trim();
    if (enderecoRecebe && !EMAIL_RE.test(enderecoRecebe)) return { ok: false, erro: "Endereço de recebimento inválido." };
    if (enderecoEnvia && !EMAIL_RE.test(enderecoEnvia.replace(/^.*<(.+)>$/, "$1"))) return { ok: false, erro: "Endereço de envio inválido." };
    const { error } = await supabase.from("email_conexoes").upsert({
      org_id: empresa.id,
      endereco_recebe: enderecoRecebe || null,
      endereco_envia: enderecoEnvia || null,
      ia_ativa: f.get("ia_ativa") === "on",
      ia_instrucoes: String(f.get("ia_instrucoes") ?? "").slice(0, 6000),
    }, { onConflict: "org_id" });
    if (error) throw error;
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Resposta manual de um atendente a um e-mail recebido. */
export async function responderEmail(conversaId: string, texto: string): Promise<ActionResult> {
  try {
    const t = texto.trim();
    if (!t) return { ok: false, erro: "Mensagem vazia." };
    const { supabase, user } = await cliente();
    const { data: conversa } = await supabase.from("wa_conversas").select("id, org_id, chat_id, status, aguardando_desde, atribuido_a").eq("id", conversaId).eq("canal", "email").single();
    if (!conversa) return { ok: false, erro: "Conversa não encontrada." };
    const { data: econexao } = await supabase.from("email_conexoes").select("*").eq("org_id", conversa.org_id).maybeSingle();
    if (!econexao) return { ok: false, erro: "Configure o e-mail primeiro." };
    // Assunto da resposta: usa o da última mensagem recebida, se tiver guardado — aqui não
    // guardamos assunto por mensagem, então cai no genérico "Sua mensagem" (ver enviarEmailERegistrar).
    await enviarEmailERegistrar(supabase, econexao as EmailConexao, conversa, null, t, "humano", user.id);
    const mudanca = { ...(conversa.status === "resolvida" ? { status: "aberta" } : {}), ...(!conversa.atribuido_a ? { atribuido_a: user.id } : {}) };
    if (Object.keys(mudanca).length) await supabase.from("wa_conversas").update(mudanca).eq("id", conversaId);
    return { ok: true };
  } catch (e) { return falha(e); }
}
