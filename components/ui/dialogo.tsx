"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/** Painel lateral (desktop) / folha inferior (mobile). Fecha com Esc e clique fora. */
export function Dialogo({ aberto, aoFechar, titulo, descricao, children, largura = 520 }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  largura?: number;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [aberto, aoFechar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={aoFechar}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 top-auto flex max-h-[92svh] flex-col rounded-t-2xl border border-gray-800 bg-[#0C0C0C] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0"
            style={{ width: "100%", maxWidth: largura }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold text-white">{titulo}</h2>
                {descricao && <p className="mt-1 text-[13px] text-gray-500">{descricao}</p>}
              </div>
              <button onClick={aoFechar} aria-label="Fechar" className="-mr-1.5 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
