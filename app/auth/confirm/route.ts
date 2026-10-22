import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { aposLogin } from "@/lib/auth/boas-vindas";

/**
 * /auth/confirm → links enviados pelo Resend (confirmação e recuperação).
 * Valida o token_hash e já deixa o usuário com sessão.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (token_hash && type) {
    const supabase = await createClient();
    // Alguns e-mails chegam como "email" (magic link) em vez de "signup"
    const tipos: EmailOtpType[] = type === "signup" ? ["signup", "email"] : [type];
    let erroFinal: string | null = null;

    for (const t of tipos) {
      const { data, error } = await supabase.auth.verifyOtp({ type: t, token_hash });
      if (error) {
        erroFinal = error.message;
        continue;
      }
      if (data.user) {
        if (t === "signup" || t === "email") await aposLogin(data.user);
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    const motivo = encodeURIComponent(
      /expired|invalid/i.test(erroFinal ?? "")
        ? "Link inválido ou expirado. Peça um novo e-mail de confirmação."
        : "Não foi possível confirmar o link. Tente novamente."
    );
    return NextResponse.redirect(`${origin}/login?erro=link&motivo=${motivo}`);
  }

  return NextResponse.redirect(`${origin}/login?erro=link`);
}
