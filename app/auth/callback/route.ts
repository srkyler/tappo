import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aposLogin } from "@/lib/auth/boas-vindas";

/**
 * /auth/callback — retorno do OAuth (Google) com `code` (PKCE).
 * Redirect URL a cadastrar no Supabase: <APP_URL>/auth/callback
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await aposLogin(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=callback`);
}
