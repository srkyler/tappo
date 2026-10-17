"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Building2, CornerDownLeft, Inbox, KanbanSquare, LayoutGrid, MoreHorizontal, Plus, Radar, Search, Send,
  Settings, Sparkles, Users, Webhook, Zap, Activity, Clock, CreditCard, Timer, Briefcase, Copy, Workflow, Calendar, RefreshCw, MapPin, Megaphone, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/base";

type Item = { href: string; label: string; Icone: LucideIcon };

export const GRUPOS: { titulo?: string; itens: Item[] }[] = [
  {
    itens: [
      { href: "/app", label: "Início", Icone: LayoutGrid },
      { href: "/app/agente", label: "Agente IA", Icone: Sparkles },
      { href: "/app/inbox", label: "Inbox", Icone: Inbox },
      { href: "/app/radar", label: "Radar", Icone: Radar },
    ],
  },
  {
    titulo: "Vendas",
    itens: [
      { href: "/app/leads", label: "Leads", Icone: Users },
      { href: "/app/prospeccao", label: "Prospecção", Icone: MapPin },
      { href: "/app/pipeline", label: "Pipeline", Icone: KanbanSquare },
      { href: "/app/campanhas", label: "Campanhas", Icone: Send },
      { href: "/app/analytics", label: "Analytics", Icone: BarChart3 },
      { href: "/app/marketing", label: "Calendário de Marketing", Icone: Megaphone },
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      { href: "/app/respostas", label: "Respostas rápidas", Icone: Zap },
      { href: "/app/captacao", label: "Captação", Icone: Webhook },
      { href: "/app/tags", label: "Tags", Icone: Activity },
      { href: "/app/automacoes", label: "Automações", Icone: Workflow },
      { href: "/app/propostas", label: "Propostas", Icone: Send },
      { href: "/app/tarefas", label: "Tarefas", Icone: Clock },
      { href: "/app/calendario", label: "Calendário", Icone: Calendar },
      { href: "/app/tarefas-recorrentes", label: "Tarefas Recorrentes", Icone: RefreshCw },
      { href: "/app/gestor", label: "Painel do gestor", Icone: BarChart3 },
      { href: "/app/executivo", label: "Dashboard Executivo", Icone: LayoutGrid },
      { href: "/app/contas", label: "Contas", Icone: Building2 },
      { href: "/app/pessoas", label: "Pessoas", Icone: Users },
      { href: "/app/duplicados", label: "Duplicados", Icone: Copy },
      { href: "/app/campos-personalizados", label: "Campos personalizados", Icone: LayoutGrid },
      { href: "/app/comissoes", label: "Comissões", Icone: CreditCard },
      { href: "/app/sla", label: "SLA atendimento", Icone: Timer },
      { href: "/app/empresa", label: "Empresa e equipe", Icone: Briefcase },
    ],
  },
];
const TODOS = GRUPOS.flatMap((g) => g.itens);
const MOBILE = ["/app", "/app/agente", "/app/leads", "/app/pipeline"];

function ativo(path: string, href: string) {
  return href === "/app" ? path === "/app" : path.startsWith(href);
}

const mola = { type: "spring", stiffness: 500, damping: 38 } as const;

/** Navegação lateral (desktop). */
export function NavLateral() {
  const path = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
      <BotaoBusca />
      {GRUPOS.map((g, i) => (
        <div key={i}>
          {g.titulo && <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-gray-600">{g.titulo}</p>}
          <div className="flex flex-col gap-0.5">
            {g.itens.map(({ href, label, Icone }) => {
              const on = ativo(path, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-200 ${on ? "text-black" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
                >
                  {on && <motion.span layoutId="nav-ativa" transition={mola} className="absolute inset-0 rounded-lg bg-white" />}
                  <Icone size={16} strokeWidth={1.8} className="relative" />
                  <span className="relative font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function BotaoBusca() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("tappo:comandos"))}
      className="flex h-9 items-center gap-2.5 rounded-lg border border-gray-800 px-3 text-[13px] text-gray-500 transition-colors hover:border-gray-600 hover:text-white"
    >
      <Search size={14} /> Buscar ou ir para…
      <kbd className="ml-auto rounded border border-gray-800 px-1.5 font-mono text-[10.5px] text-gray-600">Ctrl K</kbd>
    </button>
  );
}

/** Barra inferior (mobile). */
export function NavInferior() {
  const path = usePathname();
  const itens = TODOS.filter((i) => MOBILE.includes(i.href));
  const maisAtivo = !itens.some((i) => ativo(path, i.href));
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-800 bg-black/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {itens.map(({ href, label, Icone }) => {
        const on = ativo(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium ${on ? "text-white" : "text-gray-500"}`}>
            {on && <motion.span layoutId="nav-ativa-m" transition={mola} className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-white" />}
            <Icone size={19} strokeWidth={1.8} />
            {label.replace(" IA", "")}
          </Link>
        );
      })}
      <button onClick={() => window.dispatchEvent(new Event("tappo:comandos"))} className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium ${maisAtivo ? "text-white" : "text-gray-500"}`}>
        {maisAtivo && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-white" />}
        <MoreHorizontal size={19} strokeWidth={1.8} />
        Mais
      </button>
    </nav>
  );
}

type Comando = { id: string; label: string; dica?: string; Icone: LucideIcon; acao: () => void };

/** Paleta de comandos (Ctrl/⌘ + K): navegar, criar e perguntar ao agente. */
export function PaletaComandos() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const abrir = () => { setQ(""); setSel(0); setAberto(true); setTimeout(() => input.current?.focus(), 30); };
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrir(); }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("tappo:comandos", abrir);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener("tappo:comandos", abrir); };
  }, []);


  const ir = (href: string) => () => { setAberto(false); router.push(href); };
  const comandos = useMemo<Comando[]>(() => {
    const base: Comando[] = [
      { id: "novo-lead", label: "Novo lead", Icone: Plus, acao: ir("/app/leads?novo=1") },
      ...TODOS.map((i) => ({ id: i.href, label: i.label, dica: "Ir para", Icone: i.Icone, acao: ir(i.href) })),
      { id: "conta", label: "Conta e senha", dica: "Ir para", Icone: Settings, acao: ir("/app/perfil") },
    ];
    const t = q.trim().toLowerCase();
    const filtrados = t ? base.filter((c) => c.label.toLowerCase().includes(t)) : base;
    if (t) filtrados.push({ id: "ia", label: `Perguntar ao agente: “${q.trim()}”`, Icone: Sparkles, acao: ir(`/app/agente?q=${encodeURIComponent(q.trim())}`) });
    return filtrados;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <motion.div
            role="dialog"
            aria-label="Paleta de comandos"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-800 bg-[#0C0C0C] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-gray-800 px-4">
              <Search size={16} className="text-gray-500" />
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, comandos.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                  if (e.key === "Enter") { e.preventDefault(); comandos[sel]?.acao(); }
                }}
                placeholder="Digite um comando ou pergunte ao agente…"
                className="h-12 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-gray-600"
                aria-label="Comando"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {comandos.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === sel}>
                  <button
                    onMouseEnter={() => setSel(i)}
                    onClick={c.acao}
                    className={cn("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px]", i === sel ? "bg-white text-black" : "text-gray-300")}
                  >
                    <c.Icone size={15} />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.dica && <span className={cn("text-[11.5px]", i === sel ? "text-gray-600" : "text-gray-600")}>{c.dica}</span>}
                    {i === sel && <CornerDownLeft size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
