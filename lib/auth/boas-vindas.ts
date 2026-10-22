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
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  // Garante o perfil: o trigger handle_new_user nem sempre está instalado no banco.
  // Sem isso, o usuário entra no app sem linha em `profiles` (papel, e-mail, empresa).
  const { data: existente } = await admin
    .from("profiles")
    .select("id, boas_vindas_enviada_em")
    .eq("id", user.id)
    .maybeSingle();

  if (!existente) {
    const nome =
      (typeof meta.nome_completo === "string" && meta.nome_completo) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      null;
    const empresa = typeof meta.empresa === "string" && meta.empresa ? meta.empresa : null;
    const provedor = meta.provider === "google" ? "google" : "email";

    await admin.from("profiles").insert({
      id: user.id,
      nome_completo: nome,
      empresa,
      email: user.email ?? null,
      provedor,
      ultimo_login_em: agora,
    });
  } else {
    await admin.from("profiles").update({ ultimo_login_em: agora }).eq("id", user.id);
  }

  // Marca atomicamente: só a primeira chamada recebe a linha de volta
  const { data } = await admin
    .from("profiles")
    .update({ boas_vindas_enviada_em: agora, ultimo_login_em: agora })
    .eq("id", user.id)
    .is("boas_vindas_enviada_em", null)
    .select("nome_completo")
    .maybeSingle();

  if (!data) return;

  const nome = (data.nome_completo ?? "").split(" ")[0] || undefined;
  if (user.email) await enviarEmail("boas_vindas", user.email, { nome, userId: user.id });
}
