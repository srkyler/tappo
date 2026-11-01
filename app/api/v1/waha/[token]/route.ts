import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_DO_ACK, registrarEntrada } from "@/lib/whatsapp/entrada";
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

function tipoDa(m: MsgWaha): "texto" | "imagem" | "audio" | "video" | "arquivo" {
  if (!m.hasMedia) return "texto";
  const mt = m.media?.mimetype ?? "";
  return mt.startsWith("image/") ? "imagem" : mt.startsWith("audio/") ? "audio" : mt.startsWith("video/") ? "video" : "arquivo";
}


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
  if (c.provedor === "cloud") return Response.json({ ok: false }, { status: 404 }); // número oficial usa /api/v1/whatsapp-cloud

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
  const r = await registrarEntrada(db, c, {
    id: m.id, chatId, fromMe: !!m.fromMe, nome, tipo: tipoDa(m), corpo: m.body?.trim() || null,
    midiaUrl: m.media?.url ?? null, midiaMime: m.media?.mimetype ?? null, telefone, ack: m.ack ?? null, origem: "waha",
  });
  if (r === "erro") return Response.json({ ok: false }, { status: 500 }); // o WAHA retenta (retries na config da sessão)
  return ok();
}
