import "server-only";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin = e-mail listado em ADMIN_EMAILS (separados por vírgula) OU profiles.papel = 'admin'.
 * "papel" só muda via SQL Editor/service role (trigger proteger_papel).
 */
function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export async function ehAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
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
