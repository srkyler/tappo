"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";
import { limitar, MSG_RATE } from "@/lib/auth/rate-limit";

export type EstadoAuth = { erro?: string; ok?: string; aviso?: string } | undefined;

/** IP real do chamado (proxy/Vercel) — usado só para rate limit, nunca logado. */
async function ipAtual(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

async function origem() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const temResend = () => !!process.env.RESEND_API_KEY;

// Fallback: o próprio Supabase envia o e-mail (funciona sem configurar Resend)
async function enviarConfirmacaoSupabase(email: string, origemUrl: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origemUrl}/auth/callback?next=/app` },
  });
  return { ok: !error, mensagem: error?.message ?? "" };
}

function mapearErroResend(msg: string, email: string): { ok?: string; erro?: string } {
  if (/confirmed|registered/i.test(msg)) return { erro: "Este e-mail já foi confirmado. Faça login normalmente." };
  if (/rate|security purposes|too many/i.test(msg)) return { ok: `Se a conta ainda não foi confirmada, um novo link foi enviado para ${email}.` };
  if (/not.*found|does not exist|no user/i.test(msg)) return { erro: "Não encontramos uma conta com este e-mail." };
  return { erro: "Não foi possível enviar agora. Tente novamente em instantes." };
}

// Só aceita caminhos internos (evita open redirect via ?next=)
function destinoSeguro(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/app";
}

const MSG: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
};

export async function entrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (limitar({ acao: "auth:entrar", ip: await ipAtual(), id: email }, 8, 60)) return { erro: MSG_RATE };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: String(form.get("senha") ?? ""),
  });
  if (error) return { erro: MSG[error.message] ?? "Não foi possível entrar. Tente novamente." };

  await supabase.from("profiles").update({ ultimo_login_em: new Date().toISOString() }).eq("id", data.user.id);
  redirect(destinoSeguro(form.get("next")));
}

export async function entrarComGoogle(form: FormData) {
  const supabase = await createClient();
  const next = destinoSeguro(form.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origem()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}

export async function cadastrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const nome = String(form.get("nome") ?? "").trim();
  const empresa = String(form.get("empresa") ?? "").trim();
  const segmento = String(form.get("segmento") ?? "geral");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };
  if (limitar({ acao: "auth:cadastro", ip: await ipAtual(), id: email }, 3, 300)) return { erro: MSG_RATE };

  const origemUrl = await origem();

  if (!temResend()) {
    // Sem Resend configurado: signUp faz o próprio Supabase enviar o e-mail de confirmação
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome_completo: nome, empresa, segmento },
        emailRedirectTo: `${origemUrl}/auth/callback?next=/app`,
      },
    });
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      const rateLimit = /rate|security purposes|too many/i.test(error.message);
      if (jaExiste) return { erro: "Já existe uma conta com este e-mail. Tente entrar." };
      if (rateLimit) return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
      return { erro: "Não foi possível criar a conta." };
    }
    return { ok: email };
  }

  // generateLink cria o usuário sem o Supabase disparar e-mail; quem envia é o Resend
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: senha,
    options: { data: { nome_completo: nome, empresa, segmento } },
  });
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message);
    return { erro: jaExiste ? "Já existe uma conta com este e-mail. Tente entrar." : "Não foi possível criar a conta." };
  }

  const url = `${origemUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup&next=/app`;
  const envio = await enviarEmail("confirmacao", email, { nome: nome.split(" ")[0], url, userId: data.user.id });
  if (!envio.ok) {
    // Resend fora do ar ou mal configurado: tenta o e-mail nativo do Supabase antes de avisar
    const fallback = await enviarConfirmacaoSupabase(email, origemUrl);
    if (fallback.ok) return { ok: email };
    return { ok: email, aviso: "Conta criada, mas o e-mail não saiu. Clique em reenviar ou confira o spam." };
  }

  return { ok: email };
}

export async function recuperarSenha(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (limitar({ acao: "auth:recuperar", ip: await ipAtual(), id: email }, 3, 300)) return { erro: MSG_RATE };
  const origemUrl = await origem();

  if (!temResend()) {
    // Sem Resend: o próprio Supabase envia o e-mail de recuperação
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origemUrl}/auth/callback?next=/redefinir-senha`,
    });
    return { ok: "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  // Resposta idêntica com ou sem conta: não revela quais e-mails existem
  if (!error && data.properties?.hashed_token) {
    const url = `${origemUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/redefinir-senha`;
    const envio = await enviarEmail("recuperar_senha", email, { url, userId: data.user.id });
    if (!envio.ok) {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origemUrl}/auth/callback?next=/redefinir-senha`,
      });
    }
  }
  return { ok: "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha." };
}

// Botão "Reenviar e-mail de confirmação" (tela de sucesso do cadastro e tela de login)
export async function reenviarConfirmacao(emailBruto: string): Promise<{ ok?: string; erro?: string }> {
  const email = String(emailBruto ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "Informe um e-mail válido." };
  if (limitar({ acao: "auth:reenviar", ip: await ipAtual(), id: email }, 3, 300)) return { erro: MSG_RATE };
  const origemUrl = await origem();

  if (temResend()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);
    if (!error && data.properties?.hashed_token) {
      const url = `${origemUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup&next=/app`;
      const envio = await enviarEmail("confirmacao", email, { userId: data.user?.id, url });
      if (envio.ok) return { ok: `Link novo enviado para ${email}. Confira o spam.` };
    }
    // Resend falhou (ou conta inexistente) → tenta o e-mail nativo do Supabase
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origemUrl}/auth/callback?next=/app` },
  });
  if (error) return mapearErroResend(error.message, email);
  return { ok: `Link novo enviado para ${email}. Confira o spam.` };
}

export async function redefinirSenha(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== form.get("confirmar")) return { erro: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Link expirado. Peça um novo e-mail de recuperação." };
  redirect("/app");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
