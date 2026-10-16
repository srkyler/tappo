"use client";

import { motion } from "framer-motion";
import { ArrowRight, Database, Send, SquareKanban, ChartColumn, Sparkles, ShieldCheck } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const SERVICOS = [
  {
    Icone: Database,
    titulo: "Captura de leads",
    texto: "Importação CSV em lote, cadastro rápido e código único por contato — gerado pelo próprio banco.",
  },
  {
    Icone: Send,
    titulo: "Cadências multicanal",
    texto: "Sequências de e-mail, LinkedIn, telefone e WhatsApp com status por lead e avanço de etapa.",
  },
  {
    Icone: SquareKanban,
    titulo: "Pipeline visual",
    texto: "Kanban com arrastar e soltar, valor aberto e ponderado e histórico de cada negócio.",
  },
  {
    Icone: ChartColumn,
    titulo: "Analytics semanal",
    texto: "Leads, respostas, reuniões e funil em 7, 30 e 90 dias — tudo calculado no seu próprio banco.",
  },
  {
    Icone: Sparkles,
    titulo: "Agente de IA",
    texto: "Conversa com a sua base, diz quem chamar hoje e escreve a mensagem no tom da sua marca.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Segurança de verdade",
    texto: "Autenticação Supabase, RLS por usuário e chaves de serviço trancadas só no servidor.",
  },
];

export function Services() {
  return (
    <section id="servicos" className="scroll-mt-20 border-t border-gray-900 bg-[#050505] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Serviços</p>
          <h2 className="mt-5 text-4xl font-bold text-white lg:text-5xl">
            Tudo que a prospecção pede, num só produto
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-400">
            Quatro módulos que conversam entre si e um agente de IA em cima da sua própria base.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map(({ Icone, titulo, texto }, i) => (
            <motion.article
              key={titulo}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease }}
              className="group relative overflow-hidden rounded-3xl border border-gray-800 bg-[#0A0A0A] p-8 transition-all duration-300 hover:border-white/50"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700/70 bg-black/40 text-gray-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-110 group-hover:border-white group-hover:text-white">
                <Icone size={20} strokeWidth={1.6} />
              </span>
              <h4 className="relative mt-5 text-xl font-bold text-white">{titulo}</h4>
              <p className="relative mt-2.5 text-sm leading-relaxed text-gray-400">{texto}</p>
              <a
                href="#contato"
                className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 transition-colors duration-300 group-hover:text-white"
              >
                Saiba mais
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-2" />
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
