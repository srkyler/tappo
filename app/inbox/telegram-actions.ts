"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "@/lib/ai/cofre";
import { definirWebhook, getMe, removerWebhook, urlWebhookTelegram, ErroTelegram, tokenDa, type ConexaoTelegram } from "@/lib/telegram/bot";
import { enviarERegistrarTelegram } from "@/lib/telegram/atendimento";
import type { ActionResult } from "@/lib/data/types";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

/* Configuração do canal Telegram — mesmo padrão do inbox do WhatsApp (app/app/inbox/actions.ts). */

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroTelegram) return { ok: false, erro: e.message };
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: /fetch failed|ECONNREFUSED|timeout/i.test(msg) ? "Não foi possível falar com o Telegram agora. Tente de novo." : msg };
}

/** Salva (ou troca) o bot: valida o token com getMe, registra o webhook, cifra e guarda. */
export async function salvarTelegram(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa || !ehGestor(empresa.papel)) return { ok: false, erro: "Só o dono ou um gestor pode configurar o Telegram." };

    const tokenNovo = String(f.get("bot_token") ?? "").trim();
    const ia_ativa = f.get("ia_ativa") === "on";
    const ia_instrucoes = String(f.get("ia_instrucoes") ?? "").slice(0, 6000);
    const distribuicao = f.get("distribuicao") === "rodizio" ? "rodizio" : "manual";

    const { data: atual } = await supabase.from("telegram_conexoes").select("webhook_secret, bot_token_cifrada").maybeSingle();

    const dados: Record<string, unknown> = { org_id: empresa.id, user_id: user.id, distribuicao, ia_ativa, ia_instrucoes };
    let tokenPlano = tokenNovo;
    if (tokenNovo) {
      const me = await getMe(tokenNovo); // valida antes de salvar — token errado nunca "fica salvo"
      dados.bot_token_cifrada = cifrar(tokenNovo);
      dados.bot_username = me.username;
      dados.status = "WORKING";
    } else if (atual?.bot_token_cifrada) {
      tokenPlano = tokenDa({ bot_token_cifrada: atual.bot_token_cifrada });
    } else {
      return { ok: false, erro: "Cole o token do bot (fale com @BotFather no Telegram e use /newbot)." };
    }

    const { data: salvo, error } = await supabase.from("telegram_conexoes").upsert(dados, { onConflict: "org_id" }).select("webhook_secret").single();
    if (error) throw error;

    await definirWebhook(tokenPlano, urlWebhookTelegram(salvo.webhook_secret));
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Igual a enviarMensagem() do WhatsApp (app/app/inbox/actions.ts), mas pro canal Telegram. */
export async function enviarMensagemTelegram(conversaId: string, texto: string): Promise<ActionResult> {
  try {
    const t = texto.trim();
    if (!t) return { ok: false, erro: "Mensagem vazia." };
    if (t.length > 4000) return { ok: false, erro: "Mensagem longa demais (máx. 4000 caracteres)." };
    const { supabase, user } = await cliente();
    const { data: conversa } = await supabase.from("wa_conversas").select("id, chat_id, status, aguardando_desde, atribuido_a").eq("id", conversaId).single();
    if (!conversa) return { ok: false, erro: "Conversa não encontrada." };
    const { data: c } = await supabase.from("telegram_conexoes").select("*").maybeSingle();
    if (!c) return { ok: false, erro: "Configure o Telegram primeiro." };
    await enviarERegistrarTelegram(supabase, c as ConexaoTelegram, conversa, t, "humano", user.id);
    const mudanca = { ...(conversa.status === "resolvida" ? { status: "aberta" } : {}), ...(!conversa.atribuido_a ? { atribuido_a: user.id } : {}) };
    if (Object.keys(mudanca).length) await supabase.from("wa_conversas").update(mudanca).eq("id", conversaId);
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function desconectarTelegram(): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { data } = await supabase.from("telegram_conexoes").select("id, bot_token_cifrada").maybeSingle();
    if (!data) return { ok: false, erro: "Nenhuma conexão com o Telegram pra desconectar." };
    if (data.bot_token_cifrada) await removerWebhook(tokenDa({ bot_token_cifrada: data.bot_token_cifrada })).catch(() => null);
    const { error } = await supabase.from("telegram_conexoes").update({ status: "STOPPED" }).eq("id", data.id);
    if (error) throw error;
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}
