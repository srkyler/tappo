import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";

/**
 * Registra o login e envia o e-mail de boas-vindas uma única vez
 * (após confirmar e-mail ou no primeiro login com Google).
 */
export async function aposLogin(user: User) {
  const admin = createAdminClient();
  const agora = new Date().toISOString();

  // Marca atomicamente: só a primeira chamada recebe a linha de volta
  const { data } = await admin
    .from("profiles")
    .update({ boas_vindas_enviada_em: agora, ultimo_login_em: agora })
    .eq("id", user.id)
    .is("boas_vindas_enviada_em", null)
    .select("nome_completo")
    .maybeSingle();

  if (!data) {
    await admin.from("profiles").update({ ultimo_login_em: agora }).eq("id", user.id);
    return;
  }

  const nome = (data.nome_completo ?? "").split(" ")[0] || undefined;
  if (user.email) await enviarEmail("boas_vindas", user.email, { nome, userId: user.id });
}
