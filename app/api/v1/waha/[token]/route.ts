import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversaDo, responderComIA } from "@/lib/whatsapp/atendimento";
import type { Conexao } from "@/lib/whatsapp/waha";

/*
 * POST /api/v1/waha/<token> — webhook do WAHA (eventos message.any e session.status).
 * O token identifica a conexão (e o dono). Sem sessão; escreve pela service role.
 */

export const maxDuration = 60;

type MsgWaha = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  body?: string | null;
  hasMedia?: boolean;
  media?: { url?: string | null; mimetype?: string | null } | null;
  _data?: { notifyName?: string; pushName?: string } | null;
};
type EventoWaha = { event?: string; session?: string; payload?: unknown; me?: { id?: string } | null };

const ok = () => Response.json({ ok: true });

function tipoDa(m: MsgWaha) {
  if (!m.hasMedia) return "texto";
  const mt = m.media?.mimetype ?? "";
  return mt.startsWith("image/") ? "imagem" : mt.startsWith("audio/") ? "audio" : mt.startsWith("video/") ? "video" : "arquivo";
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return Response.json({ ok: false }, { status: 404 });

  const db = createAdminClient();
  const { data: conexao } = await db.from("wa_conexoes").select("*").eq("token", token).maybeSingle();
  if (!conexao) return Response.json({ ok: false }, { status: 404 });
  const c = conexao as Conexao;

  const bruto = await req.text();
  if (bruto.length > 200_000) return Response.json({ ok: false }, { status: 413 });
  let ev: EventoWaha;
  try { ev = JSON.parse(bruto); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (ev.session && ev.session !== c.sessao) return ok();

  if (ev.event === "session.status") {
    const p = (ev.payload ?? {}) as { status?: string };
    const numero = ev.me?.id?.split("@")[0] ?? null;
    await db.from("wa_conexoes").update({ status: p.status ?? "DESCONHECIDO", ...(numero ? { numero } : {}) }).eq("id", c.id);
    return ok();
  }

  if (ev.event !== "message" && ev.event !== "message.any") return ok();
  const m = (ev.payload ?? {}) as MsgWaha;
  const chatId = m.fromMe ? m.to : m.from;
  // Ignora grupos, status e canais
  if (!m.id || !chatId || !/@(c\.us|s\.whatsapp\.net|lid)$/.test(chatId)) return ok();

  const nome = m.fromMe ? null : (m._data?.notifyName || m._data?.pushName || null);
  const conversa = await conversaDo(db, c, chatId, nome);
  const tipo = tipoDa(m);
  const corpo = m.body?.trim() || null;

  const { data: msg, error } = await db.from("wa_mensagens").upsert({
    org_id: c.org_id,
    user_id: c.user_id,
    conversa_id: conversa.id,
    waha_id: m.id,
    direcao: m.fromMe ? "saida" : "entrada",
    autor: m.fromMe ? "celular" : "contato",
    tipo,
    corpo,
    midia_url: m.media?.url ?? null,
  }, { onConflict: "org_id,waha_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) {
    console.error("[waha]", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  if (!msg) return ok(); // duplicado (ex.: mensagem que o próprio Tappo enviou)

  const previa = corpo ?? `[${tipo}]`;
  await db.from("wa_conversas").update({
    ultima_mensagem: previa.replace(/\s+/g, " ").slice(0, 140),
    ultima_em: new Date().toISOString(),
    // Fila: cliente falou e ninguém respondeu ainda → começa a contar o tempo de espera
    ...(m.fromMe
      ? { aguardando_desde: null }
      : {
          nao_lidas: conversa.nao_lidas + 1,
          aguardando_desde: conversa.aguardando_desde ?? new Date().toISOString(),
          ...(conversa.status === "resolvida" ? { status: "aberta" } : {}),
        }),
  }).eq("id", conversa.id);

  if (!m.fromMe && c.ia_ativa && conversa.ia_ativa && tipo === "texto" && corpo) {
    after(() => responderComIA(db, c, conversa.id, msg.id).catch((e) => console.error("[waha:ia]", e instanceof Error ? e.message : e)));
  }
  return ok();
}
