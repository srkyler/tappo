"use client";

import { motion } from "framer-motion";
import { ChartColumn, MousePointerClick, ShieldCheck } from "lucide-react";
import { Contador } from "@/components/motion/contador";

const ease = [0.16, 1, 0.3, 1] as const;

const PILARES = [
  {
    Icone: ChartColumn,
    titulo: "Pipeline é a fonte da verdade",
    texto: "Cada número na tela sai dos seus dados reais — nunca de uma planilha paralela.",
  },
  {
    Icone: MousePointerClick,
    titulo: "Operação em um clique",
    texto: "Iniciar cadência, mover estágio e registrar atividade sem formulários longos.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Segurança por usuário",
    texto: "Cada pessoa enxerga apenas o que é dela, garantido por RLS no banco de dados.",
  },
];

const PLACAS = [
  { v: 1247, r: "leads organizados" },
  { v: 12, r: "cadências rodando" },
  { v: 86, r: "reuniões marcadas" },
];

export function About() {
  return (
    <section id="sobre" className="scroll-mt-20 py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
        {/* Coluna esquerda — cartão de resultados */}
        <div className="relative order-2 lg:order-1">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rotate-6 rounded-[2.5rem] bg-gradient-to-tr from-white/10 to-transparent blur-2xl"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-12% 0px" }}
            transition={{ duration: 0.8, ease }}
            className="relative rounded-3xl border border-gray-800 bg-[#0A0A0A] p-7 sm:p-8"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
              Resultados reais
            </p>

            <ul className="mt-6 space-y-3">
              {PILARES.map(({ Icone, titulo, texto }) => (
                <li key={titulo} className="group flex items-start gap-4 rounded-xl bg-[#141414] p-4 transition-colors duration-300 hover:border hover:border-gray-700">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-700/70 bg-black/40 text-gray-400 transition-all duration-300 group-hover:scale-110 group-hover:border-white group-hover:text-white">
                    <Icone size={18} strokeWidth={1.6} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-white">{titulo}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-400">{texto}</span>
                  </span>
                </li>
              ))}
            </ul>

            <ul className="mt-7 grid grid-cols-3 divide-x divide-gray-800 border-y border-gray-800">
              {PLACAS.map((p) => (
                <li key={p.r} className="px-3 py-4 first:pl-0 sm:px-5">
                  <div className="text-[22px] font-semibold tracking-[-0.02em] text-white tabular">
                    <Contador valor={p.v} atraso={0.2} />
                  </div>
                  <div className="mt-1 text-[11.5px] leading-snug text-gray-500">{p.r}</div>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-600">
              Dados de demonstração · números ilustrativos
            </p>
          </motion.div>
        </div>

        {/* Coluna direita — texto */}
        <div className="order-1 lg:order-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-12% 0px" }}
            transition={{ duration: 0.7, ease }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Sobre nós</p>
            <h2 className="mt-5 text-4xl font-bold text-white lg:text-5xl">
              Sua operação comercial inteira em um só lugar
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-400">
              O Tappo nasceu da rotina de quem prospecta em volume: leads espalhados em planilhas,
              cadências em ferramentas separadas e pipeline que ninguém atualiza. Aqui, o ciclo
              inteiro — do primeiro contato ao contrato assinado — conversa entre si.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-400">
              E um agente de IA lê a sua base, aponta quem chamar hoje e escreve a mensagem,
              enquanto o time cuida das conversas que realmente fecham negócios.
            </p>
            <a
              href="#servicos"
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-gray-700 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:border-white"
            >
              Ver recursos
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
