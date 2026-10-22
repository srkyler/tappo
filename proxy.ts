/**
 * proxy.ts — Middleware de borda do Tappo (Next.js 16)
 *
 * A implementação compartilhada vive em `lib/auth/middleware.ts`.
 * Este arquivo mantém o ponto de entrada esperado pelo Next 16
 * (no Next 15 o entrypoint é `middleware.ts`).
 */
import { middleware } from "@/lib/auth/middleware";

export default middleware;

export const config = {
  matcher: [
    // Roda em todas as rotas exceto arquivos estáticos e internos do Next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|txt|xml)$).*)",
  ],
};
