import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envio de e-mails transacionais do Tappo via Resend.
 * Todo envio é registrado em public.email_log (service role).
 */

type TipoEmail = "confirmacao" | "boas_vindas" | "recuperar_senha" | "convite";

const FROM = process.env.RESEND_FROM ?? "Tappo <onboarding@resend.dev>";

const esc = (s = "") =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(titulo: string, corpo: string, cta?: { texto: string; url: string }) {
  const botao = cta
    ? `<a href="${cta.url}" style="display:inline-block;background:#C1934E;color:#1B130D;padding:14px 24px;text-decoration:none;font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-size:13px">${cta.texto}</a>
       <p style="font-size:12px;color:#8a7a66;margin-top:16px">Se o botão não funcionar, copie este link:<br><span style="word-break:break-all">${cta.url}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F2E8D5;font-family:'Courier New',monospace;color:#241A12">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="100%" style="max-width:520px;background:#fffaf0;border:1px solid #C1934E"><tr><td style="padding:32px">
      <div style="font-size:20px;font-weight:bold;letter-spacing:6px">TA<span style="color:#C1934E">PP</span>O</div>
      <h1 style="font-size:22px;margin:24px 0 12px">${titulo}</h1>
      <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;margin-bottom:24px">${corpo}</div>
      ${botao}
    </td></tr></table>
  </td></tr></table></body></html>`;
}

const templates: Record<TipoEmail, (p: { nome?: string; url?: string }) => { subject: string; html: string }> = {
  confirmacao: ({ nome, url }) => ({
    subject: "Confirme seu e-mail no Tappo",
    html: layout(
      `Olá${nome ? `, ${esc(nome)}` : ""}!`,
      "Falta só um passo para abrir seu fichário. Confirme seu e-mail no botão abaixo. O link expira em 24 horas.",
      { texto: "Confirmar e-mail", url: url! }
    ),
  }),
  boas_vindas: ({ nome }) => ({
    subject: "Seu fichário no Tappo está aberto",
    html: layout(
      `Bem-vindo${nome ? `, ${esc(nome)}` : ""}!`,
      "Sua conta está ativa. Comece importando seus primeiros leads e montando uma cadência.",
      { texto: "Abrir o Tappo", url: `${process.env.NEXT_PUBLIC_APP_URL}/app` }
    ),
  }),
  convite: ({ nome, url }) => ({
    subject: `Convite para a equipe${nome ? ` ${nome}` : ""} no Tappo`,
    html: layout(
      "Você foi convidado",
      `Você foi convidado para entrar na equipe${nome ? ` <b>${esc(nome)}</b>` : ""} no Tappo. Crie sua conta (ou entre) com este e-mail. O convite expira em 7 dias.`,
      { texto: "Aceitar convite", url: url! }
    ),
  }),
  recuperar_senha: ({ url }) => ({
    subject: "Redefinir sua senha no Tappo",
    html: layout(
      "Redefinição de senha",
      "Recebemos um pedido para redefinir sua senha. Se não foi você, ignore este e-mail. O link expira em 1 hora.",
      { texto: "Criar nova senha", url: url! }
    ),
  }),
};

export async function enviarEmail(
  tipo: TipoEmail,
  para: string,
  dados: { nome?: string; url?: string; userId?: string } = {}
) {
  const { subject, html } = templates[tipo](dados);
  const admin = createAdminClient();

  // Log é best-effort: nunca pode derrubar o envio do e-mail
  const registrar = async (registro: Record<string, unknown>) => {
    try {
      await admin.from("email_log").insert(registro);
    } catch {
      /* tabela indisponível — envio segue mesmo assim */
    }
  };

  if (!process.env.RESEND_API_KEY) {
    await registrar({ user_id: dados.userId, destinatario: para, tipo, status: "falhou", erro: "RESEND_API_KEY ausente" });
    return { ok: false as const, erro: "Envio de e-mail não configurado." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({ from: FROM, to: para, subject, html });

  await registrar({
    user_id: dados.userId,
    destinatario: para,
    tipo,
    status: error ? "falhou" : "enviado",
    resend_id: data?.id,
    erro: error?.message,
  });

  return error ? { ok: false as const, erro: error.message } : { ok: true as const };
}
