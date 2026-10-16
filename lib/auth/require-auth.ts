import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * requireAuth — guard de autenticação para Server Components e Server Actions.
 *
 * Retorna o usuário autenticado ou redireciona para /login.
 *
 * Uso em Server Component:
 *   const user = await requireAuth()
 *   // a partir daqui, user está garantidamente autenticado
 *
 * Uso em Server Action:
 *   export async function minhaAction() {
 *     const user = await requireAuth()
 *     // ... lógica segura
 *   }
 */
export async function requireAuth() {
  const supabase = await createClient();

  // getUser() valida com o servidor — não confie em getSession()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

/**
 * getOptionalUser — retorna o usuário se autenticado, null caso contrário.
 *
 * Use em páginas que têm comportamento diferente para logados/não-logados
 * mas não bloqueiam acesso (ex: landing page).
 */
export async function getOptionalUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}
