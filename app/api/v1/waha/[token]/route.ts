import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversaDo, responderComIA } from "@/lib/whatsapp/atendimento";
import { dispararWebhooks } from "@/lib/webhooks/saida";
import { idsEquivalentes, segredoHmac, telefoneDoChat, telefoneDoLid, type Conexao } from "@/lib/whatsapp/waha";

/*
 * POST /api/v1/waha/<token> — webhook do WAHA (message.any, message.ack,
 * message.revoked, session.status). O token identifica a conexão (e a empresa).
 * Sem sessão de usuário: escreve pela service role, sempre filtrando org_id.
 *
 * Assinatura (padrão DeskcommCRM, fail-closed): a sessão é criada com
 * `hmac.key = WAHA_HMAC_SECRET` (lib/whatsapp/waha.ts), então o WAHA assina cada
 * entrega com HMAC-SHA512 do corpo bruto (header x-webhook-hmac).
 *  1. Assinatura presente que não confere (ou sem segredo para conferir) → 401.
 *  2. WAHA_WEBHOOK_REQUIRE_SIGNATURE=true → sem assinatura válida, 401.
 *  3. Sem assinatura e sem exigência → aceita (instalação ainda sem segredo).
 */

export const maxDuration = 60;

type MsgWaha = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  body?: string | null;
  hasMedia?: boolean;
  ack?: number | null;
  media?: { url?: string | null; mimetype?: string | null } | null;
  _data?: {
    notifyName?: string;
    pushName?: string;
    key?: { remoteJidAlt?: string | null } | null;
  } | null;
};
type EventoWaha = { event?: string; session?: string; payload?: unknown; me?: { id?: string } | null };

const ok = () => Response.json({ ok: true });

function tipoDa(m: MsgWaha) {
  if (!m.hasMedia) return "texto";
  const mt = m.media?.mimetype ?? "";
  return mt.startsWith("image/") ? "imagem" : mt.startsWith("audio/") ? "audio" : mt.startsWith("video/") ? "video" : "arquivo";
}

/** ack do WhatsApp → status no Inbox. 4 (áudio reproduzido) conta como lida. */
const STATUS_DO_ACK: Record<number, string> = { [-1]: "erro", 0: "pendente", 1: "enviada", 2: "entregue", 3: "lida", 4: "lida" };

function assinaturaValida(req: Request, corpo: string): boolean {
  const exigir = process.env.WAHA_WEBHOOK_REQUIRE_SIGNATURE === "true";
  const cab = req.headers.get("x-webhook-hmac");
  if (!cab) return !exigir;
  const segredo = segredoHmac();
  if (!segredo) return false; // assinou, mas não temos como conferir: não confia
  const esperado = createHmac("sha512", segredo).update(corpo, "utf8").digest("hex");
  const recebido = cab.replace(/^sha512=/i, "").trim().toLowerCase();
  if (recebido.length !== esperado.length) return false;
  try { return timingSafeEqual(Buffer.from(recebido, "hex"), Buffer.from(esperado, "hex")); } catch { return false; }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return Response.json({ ok: false }, { status: 404 });

  const bruto = await req.text();
  if (bruto.length > 200_000) return Response.json({ ok: false }, { status: 413 });
  if (!assinaturaValida(req, bruto)) return Response.json({ ok: false }, { status: 401 });

  const db = createAdminClient();
  const { data: conexao } = await db.from("wa_conexoes").select("*").eq("token", token).maybeSingle();
  if (!conexao) return Response.json({ ok: false }, { status: 404 });
  const c = conexao as Conexao;

  let ev: EventoWaha;
  try { ev = JSON.parse(bruto); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (ev.session && ev.session !== c.sessao) return ok();

  if (ev.event === "session.status") {
    const p = (ev.payload ?? {}) as { status?: string };
    const numero = ev.me?.id?.split("@")[0] ?? null;
    await db.from("wa_conexoes").update({
      status: p.status ?? "DESCONHECIDO",
      status_em: new Date().toISOString(),
      ...(numero ? { numero } : {}),
      ...(p.status === "WORKING" ? { religadas: 0 } : {}),
    }).eq("id", c.id);
    return ok();
  }

  if (ev.event === "message.ack") {
    const p = (ev.payload ?? {}) as MsgWaha;
    const ack = typeof p.ack === "number" ? p.ack : null;
    if (!p.id || ack === null || !(ack in STATUS_DO_ACK) || ack === 0) return ok();
    // Monotônico: ack atrasado (entregue depois de lida) não rebaixa o status. Erro sempre vale.
    let q = db.from("wa_mensagens").update({ ack, status: STATUS_DO_ACK[ack] })
      .eq("org_id", c.org_id).in("waha_id", idsEquivalentes(p.id));
    if (ack > 0) q = q.or(`ack.is.null,ack.lt.${ack}`);
    await q;
    return ok();
  }

  if (ev.event === "message.revoked") {
    const p = (ev.payload ?? {}) as { revokedMessageId?: string; before?: MsgWaha | null };
    const id = p.revokedMessageId ?? p.before?.id;
    if (id) {
      await db.from("wa_mensagens").update({ apagada: true })
        .eq("org_id", c.org_id).in("waha_id", [...idsEquivalentes(id), ...(p.before?.id ? idsEquivalentes(p.before.id) : [])]);
    }
    return ok();
  }

  if (ev.event !== "message" && ev.event !== "message.any") return ok();
  const m = (ev.payload ?? {}) as MsgWaha;
  const chatId = m.fromMe ? m.to : m.from;
  // Ignora grupos, status e canais (o `ignore` da sessão já corta na fonte; isto é a 2ª barreira)
  if (!m.id || !chatId || !/@(c\.us|s\.whatsapp\.net|lid)$/.test(chatId)) return ok();

  // Eco de mensagem que o próprio Tappo enviou: o envio pode ter gravado o id cru e o webhook traz o completo
  if (m.fromMe) {
    const { data: ja } = await db.from("wa_mensagens").select("id").eq("org_id", c.org_id).in("waha_id", idsEquivalentes(m.id)).limit(1);
    if (ja?.length) return ok();
  }

  // Contato @lid (número protegido): o NOWEB traz o telefone real em _data.key.remoteJidAlt;
  // sem ele, pergunta ao WAHA uma vez (até a conversa ter telefone)
  let telefone: string | null = null;
  if (chatId.endsWith("@lid")) {
    telefone = m._data?.key?.remoteJidAlt ? telefoneDoChat(m._data.key.remoteJidAlt) : null;
    if (!telefone) {
      const { data: conv } = await db.from("wa_conversas").select("telefone").eq("org_id", c.org_id).eq("chat_id", chatId).maybeSingle();
      if (!conv?.telefone) telefone = await telefoneDoLid(c, chatId);
    }
  }

  const nome = m.fromMe ? null : (m._data?.notifyName || m._data?.pushName || null);
  const conversa = await conversaDo(db, c, chatId, nome, "whatsapp", telefone);
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
    midia_mime: m.media?.mimetype ?? null,
    ...(m.fromMe && typeof m.ack === "number" && m.ack in STATUS_DO_ACK ? { ack: m.ack, status: STATUS_DO_ACK[m.ack] } : {}),
  }, { onConflict: "org_id,waha_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) {
    console.error("[waha]", error.message);
    return Response.json({ ok: false }, { status: 500 }); // o WAHA retenta (retries na config da sessão)
  }
  if (!msg) return ok(); // duplicado (retentativa do WAHA)

  if (!m.fromMe) {
    after(() => dispararWebhooks(db, c.org_id, "mensagem.nova", {
      conversa_id: conversa.id, mensagem_id: msg.id, canal: "whatsapp",
      chat_id: chatId, nome: conversa.nome, tipo, corpo,
    }).catch((e) => console.error("[waha:webhook]", e instanceof Error ? e.message : e)));
  }

  const previa = corpo ?? `[${tipo}]`;
  await db.from("wa_conversas").update({
    ultima_mensagem: previa.replace(/\s+/g, " ").slice(0, 140),
    ultima_em: new Date().toISOString(),
    conexao_id: c.id, // a resposta humana sai pelo número que recebeu
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
