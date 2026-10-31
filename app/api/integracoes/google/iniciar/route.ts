import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";
import { googleConfigurado, inicioOAuth } from "@/lib/google/agenda";

/* Gestor clica "Conectar Google Agenda" → vai para a tela de consentimento do Google. */
export async function GET(req: Request) {
  const volta = (q: string) => NextResponse.redirect(new URL(`/app/assistente?agenda=${q}`, req.url));
  if (!googleConfigurado()) return volta("indisponivel");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const empresa = await empresaAtual();
  if (!empresa || !ehGestor(empresa.papel)) return volta("sem_permissao");

  const { url, nonce } = inicioOAuth(empresa.id, user.id);
  const res = NextResponse.redirect(url);
  res.cookies.set("tappo_google_oauth", nonce, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integracoes/google", maxAge: 600,
  });
  return res;
}
