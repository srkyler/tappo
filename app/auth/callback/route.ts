import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aposLogin } from "@/lib/auth/boas-vindas";

/**
 * /auth/callback → retorno do OAuth (Google) com `code` (PKCE).
 * Redirect URL a cadastrar no Supabase: <APP_URL>/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Origem canônica do app: nunca propagar host estranho vindo do provedor
  const base = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/+$/, "");
  const code = searchParams.get("code");
  const erroProvider = searchParams.get("error_description") ?? searchParams.get("error");
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (erroProvider) {
    const motivo = encodeURIComponent(
      /access_denied/i.test(erroProvider)
        ? "Você cancelou o login com o Google."
        : "O Google recusou o login. Verifique a configuração do provedor."
    );
    return NextResponse.redirect(`${base}/login?erro=google&motivo=${motivo}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await aposLogin(data.user);
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/login?erro=callback`);
}
