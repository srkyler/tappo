"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Check, CircleAlert } from "lucide-react";
import { entrarComGoogle } from "@/app/auth/actions";
import { FundoVideo } from "@/components/motion/fundo-video";
import { Logo } from "@/components/ui/base";

/* Peças visuais compartilhadas das telas de autenticação (monocromático) */

const ease = [0.16, 1, 0.3, 1] as const;

export function AuthShell({ rotulo, selo, children, rodape }: {
  rotulo: string;
  selo?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-[100svh] bg-black lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative h-40 overflow-hidden border-b border-gray-900 lg:sticky lg:top-0 lg:h-[100svh] lg:border-b-0 lg:border-r">
        <FundoVideo src="/video/maquina-vertical.mp4" poster="/video/maquina-vertical.jpg" posicao="50% 60%" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.6)_0%,rgba(10,10,10,0.3)_45%,rgba(10,10,10,0.95)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 lg:block">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease }}
            className="max-w-[18ch] text-[clamp(1.8rem,2.6vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-white"
          >
            Quem chamar hoje já está separado.
          </motion.p>
          <p className="mt-4 max-w-[30rem] text-[15px] leading-[1.6] text-gray-400">
            Leads, cadências, pipeline e um agente de IA trabalhando junto com você.
          </p>
        </div>
        <Link href="/" className="absolute left-5 top-5 sm:left-8 sm:top-7 lg:left-12 lg:top-10"><Logo /></Link>
      </aside>

      <div className="relative flex items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="grade" />
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="painel relative z-10 w-full max-w-[420px] p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] sm:p-8"
        >
          <div className="mb-7 flex items-center justify-between">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{rotulo}</h1>
            {selo && <span className="rounded-full border border-gray-700 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-gray-400">{selo}</span>}
          </div>
          {children}
          {rodape && <div className="mt-7 flex flex-col items-center gap-2 border-t border-gray-800 pt-6 text-center">{rodape}</div>}
        </motion.section>
      </div>
    </main>
  );
}

export function Campo({ label, extra, ...input }: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={input.name} className="text-[12.5px] font-medium text-gray-300">{label}</label>
        {extra}
      </div>
      <input id={input.name} required {...input} className="campo !h-11" />
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${tipo === "erro" ? "border-gray-600 border-dashed text-white" : "border-gray-700 bg-gray-900 text-white"}`}
    >
      {tipo === "erro" ? <CircleAlert size={15} className="mt-px shrink-0" /> : <Check size={15} className="mt-px shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function BotaoEnviar({ texto, carregando }: { texto: string; carregando: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primario btn-lg mt-1 w-full">
      {pending ? carregando : texto}
    </button>
  );
}

function BotaoGoogleInterno() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-secundario btn-lg w-full">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {pending ? "Abrindo Google…" : "Continuar com Google"}
    </button>
  );
}

export function BotaoGoogle({ next }: { next?: string }) {
  return (
    <form action={entrarComGoogle}>
      <input type="hidden" name="next" value={next ?? "/app"} />
      <BotaoGoogleInterno />
    </form>
  );
}

export function Divisor() {
  return (
    <div className="my-6 flex items-center gap-3 text-[12px] text-gray-600">
      <span className="h-px flex-1 bg-gray-800" /> ou com e-mail <span className="h-px flex-1 bg-gray-800" />
    </div>
  );
}

export function LinkRodape({ pergunta, href, texto }: { pergunta: string; href: string; texto: string }) {
  return (
    <p className="text-[13.5px] text-gray-500">
      {pergunta}{" "}
      <Link href={href} className="font-medium text-white underline-offset-4 hover:underline">{texto}</Link>
    </p>
  );
}
