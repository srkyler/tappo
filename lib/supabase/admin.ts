import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase ADMIN — usa a SERVICE ROLE KEY.
 *
 * ⚠️  BYPASSA o RLS completamente.
 * ⚠️  Use APENAS em código server-side confiável (Route Handlers, Server Actions).
 * ⚠️  NUNCA importe este arquivo em componentes "use client".
 * ⚠️  NUNCA exponha a service role key ao browser.
 *
 * Casos de uso válidos:
 * - Criar perfil do usuário após signup (o usuário ainda não existe na sessão)
 * - Operações administrativas internas
 * - Webhooks de terceiros que precisam escrever sem sessão
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[tappo] SUPABASE_SERVICE_ROLE_KEY não definida. " +
      "Configure no .env.local (nunca commite o valor real)."
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // Desabilita persistência de sessão no admin client
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
