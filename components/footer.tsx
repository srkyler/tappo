"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { Globe, Mail, MessageCircle } from "lucide-react";
import { Marca } from "@/components/landing/marca";

const NAVEGACAO = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre", href: "#sobre" },
  { label: "Serviços", href: "#servicos" },
  { label: "Preços", href: "#precos" },
  { label: "Contato", href: "#contato" },
];

const CONTA = [
  { label: "Começar grátis", href: "/signup" },
  { label: "Entrar", href: "/login" },
  { label: "Esqueci a senha", href: "/recuperar-senha" },
  { label: "Falar com vendas", href: "#contato" },
];

const SOCIAIS = [
  { Icone: Globe, label: "Site", href: "#inicio" },
  { Icone: MessageCircle, label: "Conversar", href: "#contato" },
  { Icone: Mail, label: "E-mail", href: "mailto:contato@tappo.com.br" },
];

export function Footer() {
  function assinar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("newsletter") ?? "").trim();
    if (!email) return;
    const assunto = encodeURIComponent("Quero receber as novidades do Tappo");
    const corpo = encodeURIComponent(`Quero assinar a newsletter.\n\nE-mail: ${email}`);
    window.location.href = `mailto:contato@tappo.com.br?subject=${assunto}&body=${corpo}`;
  }

  return (
    <footer className="border-t border-gray-900 bg-black">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marca e missão */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Marca />
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-gray-400">
              Prospecção B2B num só lugar: base de leads, cadências, pipeline e analytics — com
              um agente de IA trabalhando a sua base.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAIS.map(({ Icone, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-800 text-gray-400 transition-all duration-300 hover:scale-105 hover:border-white hover:text-white"
                >
                  <Icone size={16} strokeWidth={1.6} />
                </a>
              ))}
            </div>
          </div>

          {/* Navegação */}
          <nav aria-label="Navegação do site">
            <h4 className="text-sm font-bold text-white">Navegação</h4>
            <ul className="mt-4 space-y-3">
              {NAVEGACAO.map((i) => (
                <li key={i.href}>
                  <a href={i.href} className="text-sm text-gray-400 transition-colors duration-300 hover:text-white">
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Conta */}
          <nav aria-label="Conta">
            <h4 className="text-sm font-bold text-white">Conta</h4>
            <ul className="mt-4 space-y-3">
              {CONTA.map((i) => (
                <li key={i.label}>
                  <Link href={i.href} className="text-sm text-gray-400 transition-colors duration-300 hover:text-white">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Newsletter */}
          <div>
            <h4 className="text-sm font-bold text-white">Novidades</h4>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Produtos novos e playbooks de prospecção, sem spam.
            </p>
            <form onSubmit={assinar} className="mt-4 flex gap-2">
              <input
                type="email"
                name="newsletter"
                required
                aria-label="Seu e-mail"
                placeholder="seu@email.com.br"
                className="min-w-0 flex-1 rounded-md border border-gray-800 bg-[#141414] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 transition-all duration-300 outline-none focus:border-white focus:ring-1 focus:ring-white"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-gray-200"
              >
                Assinar
              </button>
            </form>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-gray-900 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-gray-500">
            © 2026 Tappo · Prospecção B2B com IA · Vídeos: Mixkit
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-600">
            Feito no Brasil · PT-BR
          </p>
        </div>
      </div>
    </footer>
  );
}
