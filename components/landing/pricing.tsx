"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const PLANOS = [
  {
    nome: "Essencial",
    preco: "R$ 79",
    periodo: "/mês",
    resumo: "Para quem está estruturando a prospecção do zero.",
    itens: [
      "1 usuário",
      "Até 1.000 leads",
      "3 cadências ativas",
      "Pipeline kanban",
      "Analytics dos últimos 7 dias",
    ],
    destaque: false,
    cta: { texto: "Começar grátis", href: "/signup" },
  },
  {
    nome: "Profissional",
    preco: "R$ 149",
    periodo: "/mês",
    resumo: "Para times que prospectam em volume, todos os dias.",
    itens: [
      "Até 5 usuários",
      "Leads ilimitados",
      "Cadências ilimitadas",
      "Agente de IA no seu tom",
      "Analytics de 7, 30 e 90 dias",
      "Importação CSV em lote",
    ],
    destaque: true,
    cta: { texto: "Começar grátis", href: "/signup" },
  },
  {
    nome: "Corporativo",
    preco: "Sob consulta",
    periodo: "",
    resumo: "Para operações maiores, com necessidades específicas.",
    itens: [
      "Usuários ilimitados",
      "Onboarding assistido",
      "Integrações sob demanda",
      "Suporte dedicado",
      "Acordo de nível de serviço",
    ],
    destaque: false,
    cta: { texto: "Falar com vendas", href: "#contato" },
  },
];

export function Pricing() {
  return (
    <section id="precos" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-texto">Preços</p>
          <h2 className="mt-5 text-4xl font-bold text-texto lg:text-5xl">Planos simples, sem surpresa</h2>
          <p className="mt-5 text-lg leading-relaxed text-mudo">
            Comece grátis, cresça quando o volume pedir. Sem fidelidade e sem taxa de setup.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          {PLANOS.map((p, i) => (
            <div key={p.nome} className={p.destaque ? "lg:-translate-y-4" : undefined}>
              <motion.article
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease }}
                className={
                  p.destaque
                    ? "relative flex h-full flex-col rounded-3xl border-2 border-acento bg-superficie-2 p-8 shadow-2xl shadow-acento/10"
                    : "relative flex h-full flex-col rounded-3xl border border-borda bg-superficie p-8 transition-all duration-300 hover:border-borda-2"
                }
              >
                {p.destaque && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-acento px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-acento-texto">
                    Mais popular
                  </span>
                )}

                <h4 className="text-xl font-bold text-texto">{p.nome}</h4>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className={p.destaque ? "text-5xl font-bold tracking-tight text-texto" : "text-4xl font-bold tracking-tight text-texto"}>
                    {p.preco}
                  </span>
                  {p.periodo && <span className="text-sm font-medium text-mudo">{p.periodo}</span>}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-mudo">{p.resumo}</p>

                <ul className="mt-7 flex-1 space-y-3 border-t border-borda pt-7">
                  {p.itens.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-suave">
                      <Check size={16} className="mt-0.5 shrink-0 text-texto" strokeWidth={2} />
                      {item}
                    </li>
                  ))}
                </ul>

                <a
                  href={p.cta.href}
                  className={
                    p.destaque
                      ? "mt-8 inline-flex w-full items-center justify-center rounded-md bg-acento px-6 py-3 text-sm font-semibold text-acento-texto transition-all duration-300 hover:scale-105 hover:bg-acento-hover"
                      : "mt-8 inline-flex w-full items-center justify-center rounded-md border border-borda-2 px-6 py-3 text-sm font-semibold text-texto transition-all duration-300 hover:scale-105 hover:border-acento"
                  }
                >
                  {p.cta.texto}
                </a>
              </motion.article>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.14em] text-apagado">
          Valores ilustrativos de demonstração · plano comercial em definição
        </p>
      </div>
    </section>
  );
}
