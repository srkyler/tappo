"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/components/ui/base";
import { Marca } from "./marca";

const SECOES = [
  { id: "inicio", label: "Início" },
  { id: "sobre", label: "Sobre" },
  { id: "servicos", label: "Serviços" },
  { id: "precos", label: "Preços" },
  { id: "contato", label: "Contato" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativa, setAtiva] = useState("inicio");
  useMotionValueEvent(scrollY, "change", (y) => setRolou(y > 24));

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => e.isIntersecting && setAtiva(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECOES.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        backgroundColor: rolou || aberto ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0)",
        borderBottom: `1px solid ${rolou ? "#1F1F1F" : "transparent"}`,
        backdropFilter: rolou ? "blur(14px) saturate(1.2)" : "none",
      }}
    >
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" aria-label="Tappo — início" className="transition-opacity hover:opacity-80">
          <Marca compacta />
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 lg:flex">
          {SECOES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={ativa === s.id ? "true" : undefined}
              className={cn(
                "relative text-sm font-medium transition-colors duration-300",
                ativa === s.id ? "text-white" : "text-gray-400 hover:text-white",
              )}
            >
              {s.label}
              {ativa === s.id && (
                <span aria-hidden="true" className="absolute -bottom-2 left-0 h-0.5 w-full bg-white" />
              )}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-5 md:flex">
          <Link href="/login" className="text-sm font-medium text-gray-400 transition-colors hover:text-white">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-gray-200"
          >
            Começar grátis
          </Link>
        </div>

        <button
          onClick={() => setAberto(!aberto)}
          className="-mr-2 p-2 text-white md:hidden"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
        >
          {aberto ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
        </button>
      </nav>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-gray-800 md:hidden"
          >
            <div className="flex flex-col px-6 pb-6">
              {SECOES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setAberto(false)}
                  className="border-b border-gray-900 py-4 text-[15px] font-medium text-gray-200 transition-colors hover:text-white"
                >
                  {s.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setAberto(false)}
                className="border-b border-gray-900 py-4 text-[15px] font-medium text-gray-200 transition-colors hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/signup"
                onClick={() => setAberto(false)}
                className="mt-6 w-full rounded-md bg-white px-6 py-3 text-center text-sm font-semibold text-black transition-all duration-300 hover:bg-gray-200"
              >
                Começar grátis
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
