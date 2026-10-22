import Link from "next/link";
import { Suspense, cache } from "react";
import { LogOut, Settings, ShieldCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { ehAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/auth/actions";
import { NavInferior, NavLateral, PaletaComandos } from "@/components/dashboard/app-nav";
import { Logo } from "@/components/ui/base";
import { AvatarUsuario } from "@/components/perfil/avatar-usuario";
import { corTextoContraste } from "@/lib/data/cor";

/* Tappo — layout do app autenticado */

const perfilBasico = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("profiles").select("nome_completo, avatar_url, avatar_icone, cor_destaque").eq("id", user.id).maybeSingle()
    : { data: null };
  return { user, perfil };
});

async function Usuario() {
  const { user, perfil } = await perfilBasico();
  const nome = perfil?.nome_completo || user?.email?.split("@")[0] || "Usuário";

  return (
    <Link href="/app/perfil" className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-900">
      <AvatarUsuario nome={nome} avatarUrl={perfil?.avatar_url ?? null} avatarIcone={perfil?.avatar_icone ?? null} tamanho={32} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-white">{nome}</div>
        <div className="truncate text-[11px] text-gray-500">{user?.email}</div>
      </div>
    </Link>
  );
}

/** Variáveis CSS da cor de destaque do usuário — padrão branco se não escolheu nenhuma. */
async function CorDestaque() {
  const { perfil } = await perfilBasico();
  const cor = perfil?.cor_destaque;
  if (!cor || !/^#[0-9A-Fa-f]{6}$/.test(cor)) return null;
  return <style>{`:root { --acento: ${cor}; --acento-fg: ${corTextoContraste(cor)}; }`}</style>;
}

/** Só aparece para administradores. */
async function LinkAdmin({ compacto = false }: { compacto?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await ehAdmin(user))) return null;
  return compacto ? (
    <Link href="/admin" aria-label="Admin" className="rounded-full p-2 text-gray-300 hover:bg-gray-900"><ShieldCheck size={18} /></Link>
  ) : (
    <Link href="/admin" className="mx-3 mb-3 flex h-9 items-center gap-3 rounded-lg border border-gray-800 px-3 text-[13px] text-gray-300 transition-colors hover:border-gray-600 hover:text-white">
      <ShieldCheck size={15} /> Admin · Agentes IA
    </Link>
  );
}

function UsuarioCarregando() {
  return (
    <div className="flex items-center gap-3 p-2">
      <span className="esqueleto h-8 w-8 rounded-full" />
      <span className="esqueleto h-3 w-24" />
    </div>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireAuth();

  return (
    <div className="flex h-[100svh] overflow-hidden bg-black">
      <Suspense fallback={null}><CorDestaque /></Suspense>
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-gray-800 bg-[#070707] lg:flex">
        <div className="px-6 pb-2 pt-6">
          <Link href="/app"><Logo /></Link>
        </div>

        {/* usePathname é dado de runtime: fora de Suspense o prerender quebra (Next 16) */}
        <Suspense fallback={<div className="flex-1" />}><NavLateral /></Suspense>
        <Suspense fallback={null}><LinkAdmin /></Suspense>

        <div className="border-t border-gray-800 p-3">
          <Suspense fallback={<UsuarioCarregando />}>
            <Usuario />
          </Suspense>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Link href="/app/perfil" className="flex h-8 items-center justify-center gap-2 rounded-lg text-[12px] text-gray-400 transition-colors hover:bg-gray-900 hover:text-white">
              <Settings size={14} /> Conta
            </Link>
            <form action={sair}>
              <button type="submit" className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-[12px] text-gray-400 transition-colors hover:bg-gray-900 hover:text-white">
                <LogOut size={14} /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-800 bg-black/80 px-4 py-3 backdrop-blur-xl lg:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
          <Link href="/app"><Logo /></Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={null}><LinkAdmin compacto /></Suspense>
            <Link href="/app/perfil" aria-label="Conta" className="rounded-full p-2 text-gray-300 hover:bg-gray-900"><Settings size={18} /></Link>
            <form action={sair}><button type="submit" aria-label="Sair" className="rounded-full p-2 text-gray-300 hover:bg-gray-900"><LogOut size={18} /></button></form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">{children}</main>
      </div>

      <Suspense fallback={null}><NavInferior /></Suspense>
      <PaletaComandos />
    </div>
  );
}
