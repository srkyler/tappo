import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarEntrada } from "@/lib/whatsapp/entrada";
import { assinaturaMetaValida, chatDoWaId } from "@/lib/whatsapp/cloud";
import type { Conexao } from "@/lib/whatsapp/waha";

/*
 * Webhook do WhatsApp oficial (Cloud API da Meta) — uma URL por conexão:
 *   GET  → verificação do painel da Meta (hub.verify_token da conexão → hub.challenge)
 *   POST → mensagens e status; assinatura X-Hub-Signature-256 obrigatória (app secret).
 * Sem sessão de usuário: service role, sempre pela conexão do token (org_id dela).
 */

export const maxDuration = 60;

type MidiaMeta = { id?: string; mime_type?: string; caption?: string; filename?: string };
type MsgMeta = {
  from?: string; id?: string; timestamp?: string; type?: string;
  text?: { body?: string };
  image?: MidiaMeta; audio?: MidiaMeta; video?: MidiaMeta; document?: MidiaMeta; sticker?: MidiaMeta;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string; description?: string } };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
};
type StatusMeta = { id?: string; status?: string; recipient_id?: string; errors?: { code?: number; title?: string }[] };
type Valor = {
  metadata?: { phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: MsgMeta[];
  statuses?: StatusMeta[];
};
type Evento = { object?: string; entry?: { changes?: { field?: string; value?: Valor }[] }[] };

const ok = () => Response.json({ ok: true });
const ACK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: -1 };
const STATUS: Record<number, string> = { [-1]: "erro", 1: "enviada", 2: "entregue", 3: "lida" };

async function conexaoDo(token: string): Promise<Conexao | null> {
  if (!/^[a-f0-9]{32,80}$/.test(token)) return null;
  const db = createAdminClient();
  const { data } = await db.from("wa_conexoes").select("*").eq("token", token).eq("provedor", "cloud").maybeSingle();
  return (data as Conexao | null) ?? null;
}

function iguais(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const u = new URL(req.url);
  const c = await conexaoDo(token);
  const verificar = u.searchParams.get("hub.verify_token") ?? "";
  const desafio = u.searchParams.get("hub.challenge") ?? "";
  if (!c?.cloud_verify_token || u.searchParams.get("hub.mode") !== "subscribe" || !iguais(verificar, c.cloud_verify_token) || !/^[A-Za-z0-9_-]{1,200}$/.test(desafio)) {
    return new Response("forbidden", { status: 403 });
  }
  return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Mensagem da Meta → tipo/corpo/mídia do inbox. Tipos sem suporte viram texto descritivo. */
function converter(m: MsgMeta): { tipo: "texto" | "imagem" | "audio" | "video" | "arquivo"; corpo: string | null; midia: MidiaMeta | null } {
  switch (m.type) {
    case "text": return { tipo: "texto", corpo: m.text?.body?.trim() || null, midia: null };
    case "image": return { tipo: "imagem", corpo: m.image?.caption?.trim() || null, midia: m.image ?? null };
    case "sticker": return { tipo: "imagem", corpo: null, midia: m.sticker ?? null };
    case "audio": return { tipo: "audio", corpo: null, midia: m.audio ?? null };
    case "video": return { tipo: "video", corpo: m.video?.caption?.trim() || null, midia: m.video ?? null };
    case "document": return { tipo: "arquivo", corpo: m.document?.caption?.trim() || m.document?.filename || null, midia: m.document ?? null };
    case "button": return { tipo: "texto", corpo: m.button?.text?.trim() || null, midia: null };
    case "interactive": return { tipo: "texto", corpo: (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "").trim() || null, midia: null };
    case "location": {
      const l = m.location;
      return { tipo: "texto", corpo: l ? `📍 ${[l.name, l.address].filter(Boolean).join(" — ") || "Localização"} (${l.latitude}, ${l.longitude})` : null, midia: null };
    }
    case "contacts": {
      const k = m.contacts?.[0];
      return { tipo: "texto", corpo: k ? `👤 ${k.name?.formatted_name ?? "Contato"} ${k.phones?.map((p) => p.phone).filter(Boolean).join(", ") ?? ""}`.trim() : null, midia: null };
    }
    default: return { tipo: "texto", corpo: `[mensagem do tipo ${String(m.type ?? "desconhecido").slice(0, 30)}]`, midia: null };
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const bruto = await req.text();
  if (bruto.length > 500_000) return Response.json({ ok: false }, { status: 413 });
  const c = await conexaoDo(token);
  if (!c) return Response.json({ ok: false }, { status: 404 });
  if (!assinaturaMetaValida(c, req.headers.get("x-hub-signature-256"), bruto)) return Response.json({ ok: false }, { status: 401 });

  let ev: Evento;
  try { ev = JSON.parse(bruto); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (ev.object !== "whatsapp_business_account") return ok();

  const db = createAdminClient();
  let falhou = false;
  for (const entrada of ev.entry ?? []) {
    for (const mud of entrada.changes ?? []) {
      if (mud.field !== "messages" || !mud.value) continue;
      const v = mud.value;
      // Outro número da mesma conta (WABA) não é desta conexão
      if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== c.cloud_phone_number_id) continue;

      for (const s of v.statuses ?? []) {
        const ack = s.status ? ACK[s.status] : undefined;
        if (!s.id || ack === undefined) continue;
        let q = db.from("wa_mensagens").update({ ack, status: STATUS[ack] }).eq("org_id", c.org_id).eq("waha_id", s.id);
        if (ack > 0) q = q.or(`ack.is.null,ack.lt.${ack}`); // monotônico; erro sempre vale
        await q;
      }

      const nomes = new Map((v.contacts ?? []).map((k) => [k.wa_id ?? "", k.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        if (!m.id || !m.from || !/^\d{8,15}$/.test(m.from)) continue;
        const { tipo, corpo, midia } = converter(m);
        const r = await registrarEntrada(db, c, {
          id: m.id, chatId: chatDoWaId(m.from), fromMe: false, nome: nomes.get(m.from) ?? null,
          tipo, corpo, midiaUrl: midia?.id ? `cloud:${midia.id}` : null, midiaMime: midia?.mime_type ?? null,
          telefone: m.from, origem: "cloud",
        });
        if (r === "erro") falhou = true;
      }
    }
  }
  // 500 faz a Meta retentar o lote; o upsert por id evita duplicar o que já entrou
  return falhou ? Response.json({ ok: false }, { status: 500 }) : ok();
}
