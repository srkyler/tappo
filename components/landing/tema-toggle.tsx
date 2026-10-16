"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

const CHAVE = "tappo-tema";
const EVENTO = "tappo-troca-tema";
const MASCARA =
  "linear-gradient(90deg, transparent 0%, black 14%, black 86%, transparent 100%)";

const vazio = () => () => {};

function lerClaro() {
  return document.documentElement.getAttribute("data-tema") === "claro";
}

function inscrever(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Botão claro/escuro da landing.
 * Ao alternar, uma fumaça (feTurbulence + feDisplacementMap) varre a
 * tela; no pico da cobertura o tema troca e a fumaça sai revelando o
 * novo tema já aplicado.
 */
export function TemaToggle({ className }: { className?: string }) {
  const claro = useSyncExternalStore(inscrever, lerClaro, () => false);
  const montado = useSyncExternalStore(vazio, () => true, () => false);
  const [fumaca, setFumaca] = useState<{ cor: string; dir: 1 | -1 } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  function alternar() {
    if (fumaca) return;

    const proximoClaro = !claro;
    setFumaca({ cor: proximoClaro ? "#FFFFFF" : "#000000", dir: proximoClaro ? 1 : -1 });

    const raiz = document.documentElement;
    raiz.classList.add("tema-transicao");

    timers.current.push(
      window.setTimeout(() => {
        raiz.setAttribute("data-tema", proximoClaro ? "claro" : "escuro");
        try {
          localStorage.setItem(CHAVE, proximoClaro ? "claro" : "escuro");
        } catch {
          /* modo privado — tema só vale para a sessão */
        }
        window.dispatchEvent(new Event(EVENTO));
      }, 580),
      window.setTimeout(() => {
        raiz.classList.remove("tema-transicao");
        setFumaca(null);
      }, 1450),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-label={claro ? "Ativar modo escuro" : "Ativar modo claro"}
        aria-pressed={claro}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-borda text-suave transition-all duration-300 hover:scale-105 hover:border-acento hover:text-texto ${className ?? ""}`}
      >
        {montado ? (
          <AnimatePresence mode="wait" initial={false}>
            {claro ? (
              <motion.span
                key="sol"
                initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute"
              >
                <Sun size={16} strokeWidth={1.7} />
              </motion.span>
            ) : (
              <motion.span
                key="lua"
                initial={{ opacity: 0, rotate: 60, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -60, scale: 0.6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute"
              >
                <Moon size={16} strokeWidth={1.7} />
              </motion.span>
            )}
          </AnimatePresence>
        ) : (
          <Moon size={16} strokeWidth={1.7} />
        )}
      </button>

      {montado &&
        createPortal(
          <AnimatePresence>
            {fumaca && (
              <motion.div
                key="fumaca"
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
                initial={{ x: fumaca.dir === 1 ? "-115vw" : "115vw" }}
                animate={{ x: fumaca.dir === 1 ? "115vw" : "-115vw" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.25, ease: [0.65, 0, 0.35, 1] }}
              >
                {/* Filtro de fumaça: ruído fractal deslocando as bordas */}
                <svg aria-hidden="true" className="absolute h-0 w-0">
                  <filter id="fumaca-filtro" x="-25%" y="-25%" width="150%" height="150%">
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.011 0.026"
                      numOctaves={4}
                      seed={11}
                      result="ruido"
                    />
                    <feDisplacementMap
                      in="SourceGraphic"
                      in2="ruido"
                      scale={210}
                      xChannelSelector="R"
                      yChannelSelector="G"
                    />
                  </filter>
                </svg>

                <div
                  className="absolute -left-[15vw] top-0 h-full w-[130vw]"
                  style={{ filter: "url(#fumaca-filtro) blur(6px)" }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: fumaca.cor,
                      maskImage: MASCARA,
                      WebkitMaskImage: MASCARA,
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskSize: "100% 100%",
                      WebkitMaskSize: "100% 100%",
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
