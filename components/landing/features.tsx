"use client";

import { motion } from "framer-motion";
import { Send, SquareKanban, ChartColumn, Users } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const ITENS = [
  {
    Icone: Users,
    titulo: "Base de leads",
    texto: "Importe planilhas CSV, cadastre em segundos e encontre qualquer contato com busca instantânea.",
  },
  {
    Icone: Send,
    titulo: "Cadências multicanal",
    texto: "E-mail, LinkedIn, telefone e WhatsApp com o próximo passo já calculado para cada lead.",
  },
  {
    Icone: SquareKanban,
    titulo: "Pipeline kanban",
    texto: "Arraste deals entre etapas e veja o valor aberto e ponderado mudar em tempo real.",
  },
  {
    Icone: ChartColumn,
    titulo: "Analytics real",
    texto: "Funil, origem e campanhas top direto do seu banco — nada de planilha paralela.",
  },
];

export function Features() {
  return (
    <section className="relative z-10 -mt-6 lg:-mt-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-3xl border border-gray-800 bg-[#141414] p-7 sm:p-8 md:p-10">
          <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {ITENS.map(({ Icone, titulo, texto }, i) => (
              <motion.li
                key={titulo}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.6, delay: i * 0.08, ease }}
                className="group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700/70 bg-black/40 text-gray-400 transition-all duration-300 group-hover:scale-110 group-hover:border-white group-hover:text-white">
                  <Icone size={20} strokeWidth={1.6} />
                </div>
                <h4 className="mt-5 text-xl font-bold text-gray-300 transition-colors duration-300 group-hover:text-white">
                  {titulo}
                </h4>
                <p className="mt-2.5 text-sm leading-relaxed text-gray-400">{texto}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
