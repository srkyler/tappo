import "server-only";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin = e-mail listado em ADMIN_EMAILS (separados por vírgula) OU profiles.papel = 'admin'.
 * "papel" só muda via SQL Editor/service role (trigger proteger_papel) — ou pela action
 * definirAdmin(), que usa o client admin (service role) e só o super admin pode chamar.
 *
 * Super admin = o único e-mail em SUPER_ADMIN_EMAIL. É quem decide quem mais vira admin;
 * ninguém se promove pela tela, nem outro admin promove alguém — só essa conta.
 */
function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function emailSuperAdmin(): string {
  return (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function ehSuperAdmin(user: User | null): boolean {
  const alvo = emailSuperAdmin();
  return !!(alvo && user?.email && user.email.toLowerCase() === alvo);
}

export async function ehAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (ehSuperAdmin(user)) return true;
  if (user.email && emailsAdmin().includes(user.email.toLowerCase())) return true;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("papel").eq("id", user.id).maybeSingle();
  return data?.papel === "admin";
}

/** Para páginas e actions do /admin. Membro comum recebe 404 (a área nem "existe" pra ele). */
export async function exigirAdmin(): Promise<User> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await ehAdmin(user))) notFound();
  return user;
}

/** Para a gestão de quem é admin — só o super admin (SUPER_ADMIN_EMAIL) passa. */
export async function exigirSuperAdmin(): Promise<User> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!ehSuperAdmin(user)) notFound();
  return user;
}
