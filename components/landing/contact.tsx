"use client";

import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { Clock, Mail, MapPin, ArrowRight } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const INFO = [
  { Icone: Mail, rotulo: "E-mail", valor: "contato@tappo.com.br", href: "mailto:contato@tappo.com.br" },
  { Icone: Clock, rotulo: "Atendimento", valor: "Segunda a sexta · 9h às 18h (Brasília)" },
  { Icone: MapPin, rotulo: "Onde estamos", valor: "100% remoto · Brasil" },
];

const CLASSE_CAMPO =
  "w-full rounded-xl border border-gray-800 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-gray-500 transition-all duration-300 outline-none focus:border-white focus:ring-1 focus:ring-white";

export function Contact() {
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const mensagem = String(fd.get("mensagem") ?? "").trim();
    const assunto = encodeURIComponent(`Contato pelo site — ${nome || "potencial cliente"}`);
    const corpo = encodeURIComponent(`${mensagem}\n\n— ${nome}\n${email}`);
    window.location.href = `mailto:contato@tappo.com.br?subject=${assunto}&body=${corpo}`;
  }

  return (
    <section id="contato" className="scroll-mt-20 border-t border-gray-900 bg-[#050505] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Contato</p>
          <h2 className="mt-5 max-w-2xl text-4xl font-bold text-white lg:text-5xl">
            Vamos conversar sobre a sua operação
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Coluna esquerda — canais de atendimento */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8% 0px" }}
            transition={{ duration: 0.7, ease }}
            className="rounded-3xl border border-gray-800 bg-[#0A0A0A] p-7 sm:p-8"
          >
            <p className="text-lg leading-relaxed text-gray-400">
              Conte o seu cenário e a gente mostra o Tappo funcionando em cima da sua rotina de
              prospecção.
            </p>

            <ul className="mt-8 space-y-4">
              {INFO.map(({ Icone, rotulo, valor, href }) => {
                const conteudo = (
                  <>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#141414] text-gray-400 transition-colors duration-300 group-hover:text-white">
                      <Icone size={18} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium uppercase tracking-[0.1em] text-gray-500">
                        {rotulo}
                      </span>
                      <span className="mt-0.5 block text-[15px] text-white">{valor}</span>
                    </span>
                  </>
                );

                return (
                  <li key={rotulo} className="group">
                    {href ? (
                      <a href={href} className="flex items-center gap-4 rounded-xl p-2 -m-2 transition-colors duration-300 hover:bg-[#141414]">
                        {conteudo}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 rounded-xl p-2">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>

          {/* Coluna direita — formulário */}
          <motion.form
            onSubmit={enviar}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8% 0px" }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="rounded-3xl border border-gray-800 bg-[#0A0A0A] p-7 sm:p-8"
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="nome" className="mb-1.5 block text-[13px] font-medium text-gray-300">
                  Nome
                </label>
                <input id="nome" name="nome" type="text" required autoComplete="name" placeholder="Seu nome" className={CLASSE_CAMPO} />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-gray-300">
                  E-mail
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com.br" className={CLASSE_CAMPO} />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="mensagem" className="mb-1.5 block text-[13px] font-medium text-gray-300">
                Mensagem
              </label>
              <textarea
                id="mensagem"
                name="mensagem"
                required
                rows={5}
                placeholder="Conte como é a rotina de prospecção do seu time…"
                className={`${CLASSE_CAMPO} resize-y`}
              />
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-gray-200 sm:w-auto"
            >
              Enviar mensagem <ArrowRight size={16} />
            </button>
            <p className="mt-3 text-xs text-gray-500">
              Abre o seu aplicativo de e-mail com a mensagem já preenchida.
            </p>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
