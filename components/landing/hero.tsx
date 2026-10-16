"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import { useReduzir } from "@/components/motion/use-reduzir";

const ease = [0.16, 1, 0.3, 1] as const;

const surge = (atraso: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: atraso, duration: 0.7, ease },
});

export function Hero() {
  const reduzir = useReduzir();

  return (
    <section id="inicio" className="relative scroll-mt-20 overflow-hidden bg-black pt-32 pb-20 lg:pt-48 lg:pb-32">
      {/* Glow de fundo — branco puro (marca monocromática) */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[540px] w-[840px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[120px]" />
      <div aria-hidden="true" className="grade" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-10">
        {/* Coluna esquerda — conteúdo */}
        <div>
          <motion.p {...surge(0.05)} className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
            Prospecção B2B · com agente de IA
          </motion.p>

          <motion.h1
            {...surge(0.15)}
            className="mt-6 max-w-[13ch] text-5xl font-bold leading-[1.1] tracking-tight text-white lg:text-6xl xl:text-7xl"
          >
            Prospecção B2B no{" "}
            <span className="relative inline-block">
              piloto
              <motion.span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-[0.06em] w-full origin-left bg-white"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.7, ease }}
              />
            </span>{" "}
            automático.
          </motion.h1>

          <motion.p {...surge(0.3)} className="mt-7 max-w-xl text-lg leading-relaxed text-gray-400">
            Leads, cadências, pipeline e analytics num só lugar — e um agente de IA que lê a sua
            base, diz quem chamar hoje e escreve a mensagem por você.
          </motion.p>

          <motion.div {...surge(0.45)} className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-white px-7 py-3.5 text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-gray-200"
            >
              Começar grátis <ArrowRight size={16} />
            </Link>
            <a
              href="#sobre"
              className="group inline-flex items-center gap-2 rounded-md border border-gray-700 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:border-white"
            >
              Ver como funciona
              <ArrowDown size={15} className="transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </motion.div>
        </div>

        {/* Coluna direita — vídeo com blend sobre o preto puro */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 1, ease }}
          className="relative mx-auto aspect-square w-full max-w-[440px] mix-blend-screen [mask-image:radial-gradient(ellipse_at_center,black_52%,transparent_82%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_52%,transparent_82%)] lg:aspect-[4/3]"
        >
          {reduzir ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/video/maquina.jpg"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain grayscale contrast-[1.15]"
            />
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster="/video/maquina.jpg"
              src="/video/maquina.mp4"
              aria-hidden="true"
              className="h-full w-full object-contain grayscale contrast-[1.15]"
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}
