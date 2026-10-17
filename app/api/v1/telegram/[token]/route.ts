import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { responderComIATelegram, conversaTelegramDo } from "@/lib/telegram/atendimento";
import type { ConexaoTelegram } from "@/lib/telegram/bot";

/*
 * POST /api/v1/telegram/<token> — webhook da Bot API do Telegram.
 * O token na URL é o webhook_secret da conexão (definido ao registrar o webhook em
 * setWebhook). Sem sessão; escreve pela service role. Responde 200 sempre e rápido —
 * o Telegram reenvia o update se não receber 200 em poucos segundos.
 */

export const maxDuration = 60;

type UpdateTelegram = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; username?: string; is_bot?: boolean };
  };
};

const ok = () => Response.json({ ok: true });

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return Response.json({ ok: false }, { status: 404 });

  const db = createAdminClient();
  const { data: conexao } = await db.from("telegram_conexoes").select("*").eq("webhook_secret", token).maybeSingle();
  if (!conexao) return Response.json({ ok: false }, { status: 404 });
  const c = conexao as ConexaoTelegram;

  const bruto = await req.text();
  if (bruto.length > 200_000) return Response.json({ ok: false }, { status: 413 });
  let up: UpdateTelegram;
  try { up = JSON.parse(bruto); } catch { return Response.json({ ok: false }, { status: 400 }); }

  const m = up.message;
  // Ignora updates sem mensagem de texto (edições, stickers, bots, etc. — fora do escopo por ora)
  if (!m || m.from?.is_bot || typeof m.text !== "string") return ok();

  const chatId = String(m.chat.id);
  const nome = m.from?.first_name || m.from?.username || null;
  const conversa = await conversaTelegramDo(db, c, chatId, nome);
  const corpo = m.text.trim() || null;

  const { data: msg, error } = await db.from("wa_mensagens").insert({
    org_id: c.org_id, user_id: c.user_id, conversa_id: conversa.id, canal: "telegram",
    direcao: "entrada", autor: "contato", tipo: "texto", corpo,
  }).select("id").single();
  if (error) {
    console.error("[telegram]", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  const previa = (corpo ?? "[sem texto]").replace(/\s+/g, " ").slice(0, 140);
  await db.from("wa_conversas").update({
    ultima_mensagem: previa,
    ultima_em: new Date().toISOString(),
    nao_lidas: conversa.nao_lidas + 1,
    aguardando_desde: conversa.aguardando_desde ?? new Date().toISOString(),
    ...(conversa.status === "resolvida" ? { status: "aberta" } : {}),
  }).eq("id", conversa.id);

  if (c.ia_ativa && conversa.ia_ativa && corpo) {
    after(() => responderComIATelegram(db, c, conversa.id, msg.id).catch((e) => console.error("[telegram:ia]", e instanceof Error ? e.message : e)));
  }
  return ok();
}
