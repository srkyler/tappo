import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * proxy.ts — Middleware de borda do Tappo (Next.js 16)
 *
 * Responsabilidades:
 * 1. Mantém o cookie de sessão do Supabase atualizado (refresh automático)
 * 2. Redireciona usuários não autenticados para /login
 * 3. Redireciona usuários autenticados para fora de /login e /
 *
 * Rotas protegidas: tudo dentro de /app/*
 * Rotas públicas: /, /login, /signup, /auth/callback
 */
export default async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Propaga os cookies na request e na response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: sempre getUser() — valida com o servidor Supabase
  // Nunca getSession() aqui — lê só o cookie local, sem validação
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas que não precisam de autenticação
  const publicPaths = ["/", "/login", "/signup", "/recuperar-senha"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith("/auth/")
  ) || pathname.startsWith("/api/v1/webhooks/") // captação pública (autenticada pelo token da fonte)
    || pathname.startsWith("/api/v1/waha/"); // webhook do WhatsApp (autenticado pelo token da conexão)

  // Usuário não logado tentando acessar rota protegida → redireciona para login
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname); // guarda destino para redirecionar após login
    return NextResponse.redirect(loginUrl);
  }

  // Usuário logado tentando acessar login/signup → redireciona para o app
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    return NextResponse.redirect(appUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Roda em todas as rotas exceto arquivos estáticos e internos do Next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|txt|xml)$).*)",
  ],
};
