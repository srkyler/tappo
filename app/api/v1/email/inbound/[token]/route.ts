import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { conversaEmailDe, responderComIAEmail, type EmailConexao } from "@/lib/email/atendimento";

/*
 * POST /api/v1/email/inbound/<token> — recebe e-mail entrante via Resend Inbound.
 * O token no path é o webhook_secret de email_conexoes. Sem sessão; service role.
 *
 * ATENÇÃO: o formato exato do payload que o Resend Inbound envia precisa ser
 * confirmado contra a documentação oficial (resend.com/docs, seção Inbound) antes
 * de ir pra produção — não há como testar isso sem uma conta Resend real com
 * domínio de recebimento configurado. O parsing abaixo é defensivo (tenta várias
 * chaves plausíveis) exatamente por isso: para não quebrar se o formato real
 * divergir em detalhes (ex.: payload plano vs. envelope {type, data: {...}}).
 */

const ok = () => Response.json({ ok: true });

function primeiraChaveDefinida<T = unknown>(obj: Record<string, unknown>, chaves: string[]): T | null {
  for (const k of chaves) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return null;
}

function extrairEmail(campo: unknown): { email: string; nome: string | null } | null {
  if (!campo) return null;
  // Formatos possíveis: "Nome <email@x.com>", "email@x.com", ou array (Resend costuma
  // mandar "to" como array; "from" costuma ser string única).
  const bruto = Array.isArray(campo) ? campo[0] : campo;
  const s = String(bruto ?? "").trim();
  const m = s.match(/^(.*)<([^<>]+)>$/) ?? s.match(/^([^<>]*?)(,|$)/);
  const emailMatch = s.match(/[^\s<>]+@[^\s<>]+/);
  if (!emailMatch) return null;
  const nome = m?.[1]?.trim().replace(/^"|"$/g, "") || null;
  return { email: emailMatch[0].toLowerCase(), nome: nome || null };
}

function htmlParaTexto(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return Response.json({ ok: false }, { status: 404 });

  const db = createAdminClient();
  const { data: econexao } = await db.from("email_conexoes").select("*").eq("webhook_secret", token).maybeSingle();
  if (!econexao) return Response.json({ ok: false }, { status: 404 });
  const c = econexao as EmailConexao;

  const bruto = await req.text();
  if (bruto.length > 500_000) return Response.json({ ok: false }, { status: 413 });
  let corpoBruto: Record<string, unknown>;
  try { corpoBruto = JSON.parse(bruto); } catch { return Response.json({ ok: false }, { status: 400 }); }

  // Resend (e Svix, que eles usam por baixo) costuma mandar {type, created_at, data: {...}}.
  // Se vier assim, usa o "data"; senão assume que o corpo já é o e-mail direto.
  const envelope = corpoBruto.data && typeof corpoBruto.data === "object" ? (corpoBruto.data as Record<string, unknown>) : corpoBruto;

  const de = extrairEmail(primeiraChaveDefinida(envelope, ["from", "from_email", "sender"]));
  if (!de) return Response.json({ ok: false, erro: "Remetente ausente/ilegível." }, { status: 400 });

  const assunto = primeiraChaveDefinida<string>(envelope, ["subject"]);
  const textoPuro = primeiraChaveDefinida<string>(envelope, ["text", "text_body", "plain"]);
  const html = primeiraChaveDefinida<string>(envelope, ["html", "html_body"]);
  const corpo = (textoPuro || (html ? htmlParaTexto(html) : "")).trim().slice(0, 20_000) || null;
  if (!corpo) return ok(); // e-mail sem corpo legível (ex.: só anexo) — ignora por ora

  const conversa = await conversaEmailDe(db, c, de.email, de.nome);

  const { data: msg, error } = await db.from("wa_mensagens").insert({
    org_id: c.org_id, conversa_id: conversa.id, canal: "email",
    direcao: "entrada", autor: "contato", tipo: "texto", corpo,
  }).select("id").single();
  if (error) {
    console.error("[email:inbound]", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  await db.from("wa_conversas").update({
    ultima_mensagem: corpo.replace(/\s+/g, " ").slice(0, 140),
    ultima_em: new Date().toISOString(),
    nao_lidas: conversa.nao_lidas + 1,
    aguardando_desde: conversa.aguardando_desde ?? new Date().toISOString(),
    ...(conversa.status === "resolvida" ? { status: "aberta" } : {}),
  }).eq("id", conversa.id);

  if (c.ia_ativa && conversa.ia_ativa) {
    after(() => responderComIAEmail(db, c, conversa.id, msg.id, assunto).catch((e) => console.error("[email:ia]", e instanceof Error ? e.message : e)));
  }
  return ok();
}
