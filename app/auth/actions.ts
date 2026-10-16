"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";

export type EstadoAuth = { erro?: string; ok?: string } | undefined;

async function origem() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
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
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };

  // generateLink cria o usuário sem o Supabase disparar e-mail; quem envia é o Resend
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: senha,
    options: { data: { nome_completo: nome, empresa } },
  });
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message);
    return { erro: jaExiste ? "Já existe uma conta com este e-mail. Tente entrar." : "Não foi possível criar a conta." };
  }

  const url = `${await origem()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup&next=/app`;
  const envio = await enviarEmail("confirmacao", email, { nome: nome.split(" ")[0], url, userId: data.user.id });
  if (!envio.ok) return { erro: "Conta criada, mas o e-mail de confirmação falhou. Tente reenviar em instantes." };

  return { ok: email };
}

export async function recuperarSenha(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  // Resposta idêntica com ou sem conta: não revela quais e-mails existem
  if (!error && data.properties?.hashed_token) {
    const url = `${await origem()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/redefinir-senha`;
    await enviarEmail("recuperar_senha", email, { url, userId: data.user.id });
  }
  return { ok: "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha." };
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
