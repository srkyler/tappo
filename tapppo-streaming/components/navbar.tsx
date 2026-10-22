"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Search } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/", label: "Início" },
  { href: "/filmes", label: "Filmes" },
  { href: "/series", label: "Séries" },
  { href: "/canais", label: "Canais" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-neon-2 shadow-lg shadow-neon/30">
            <Clapperboard className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Tappo <span className="text-neon-soft">Streaming</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const ativo =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  ativo
                    ? "bg-white/10 font-semibold text-white"
                    : "text-muted hover:bg-white/5 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/busca"
            aria-label="Buscar"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-muted transition hover:border-neon/50 hover:text-white"
          >
            <Search className="h-4 w-4" />
          </Link>
          <div className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-neon to-neon-2 ring-2 ring-white/10">
            <span className="grid h-full w-full place-items-center text-xs font-bold">
              TS
            </span>
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
        {links.map((link) => {
          const ativo =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs",
                ativo ? "bg-white/10 font-semibold" : "text-muted"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
