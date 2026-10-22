import { middleware } from "@/lib/auth/middleware";

/**
 * Next 15 usa `middleware.ts` (o `proxy.ts` é convenção do Next 16 e é ignorado aqui).
 * A lógica compartilhada vive em `lib/auth/middleware.ts`.
 */
export default middleware;

export const config = {
  matcher: [
    // Roda em todas as rotas exceto arquivos estáticos e internos do Next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|txt|xml)$).*)",
  ],
};
