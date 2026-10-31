"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Building2, Brain, ChevronDown, CornerDownLeft, Inbox, KanbanSquare, LayoutGrid, MoreHorizontal, Plus, Radar, Search, Send,
  Settings, Sparkles, Users, UserRound, Webhook, Zap, Activity, Clock, CreditCard, Timer, Briefcase, Copy, Workflow, Calendar, RefreshCw, MapPin, Megaphone, Bot, Plug, Network, BrainCircuit, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/base";

type Item = { href: string; label: string; Icone: LucideIcon };

/** Item exclusivo de administradores (área com chave de API — membros nem veem). */
const ITEM_ADMIN: Item = { href: "/app/agentes", label: "Agentes (admin)", Icone: Brain };

/** Grupos da navegação; `admin` acrescenta o item da área de administração. */
export function gruposNav(admin: boolean): { titulo?: string; itens: Item[] }[] {
  if (!admin) return GRUPOS;
  return GRUPOS.map((g, i) => (i === 0 ? { ...g, itens: [...g.itens, ITEM_ADMIN] } : g));
}

// Grupos pequenos e coerentes em vez de uma lista única — cada um recolhe
// independente (preferência salva no navegador, ver NavLateral).
export const GRUPOS: { titulo?: string; itens: Item[] }[] = [
  {
    itens: [
      { href: "/app", label: "Início", Icone: LayoutGrid },
      { href: "/app/agente", label: "Agente IA", Icone: Sparkles },
      { href: "/app/jarvis", label: "Jarvis", Icone: Bot },
      { href: "/app/inbox", label: "Inbox", Icone: Inbox },
      { href: "/app/conexoes", label: "Conexões", Icone: Plug },
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
      { href: "/app/propostas", label: "Propostas", Icone: Send },
      { href: "/app/tags", label: "Tags", Icone: Activity },
      { href: "/app/duplicados", label: "Duplicados", Icone: Copy },
    ],
  },
  {
    titulo: "Atendimento",
    itens: [
      { href: "/app/assistente", label: "Assistente IA", Icone: BrainCircuit },
      { href: "/app/respostas", label: "Respostas rápidas", Icone: Zap },
      { href: "/app/automacoes", label: "Automações", Icone: Workflow },
      { href: "/app/chatbot-qualificacao", label: "Chatbot Qualificação", Icone: Sparkles },
      { href: "/app/sla", label: "SLA atendimento", Icone: Timer },
      { href: "/app/atendimento-atendente", label: "Atendimento por Atendente", Icone: UserRound },
      { href: "/app/captacao", label: "Captação", Icone: Webhook },
      { href: "/app/webhooks", label: "Webhooks", Icone: Network },
    ],
  },
  {
    titulo: "Marketing",
    itens: [
      { href: "/app/marketing", label: "Calendário de Marketing", Icone: Megaphone },
      { href: "/app/analytics", label: "Analytics", Icone: BarChart3 },
    ],
  },
  {
    titulo: "Tarefas e agenda",
    itens: [
      { href: "/app/tarefas", label: "Tarefas", Icone: Clock },
      { href: "/app/calendario", label: "Calendário", Icone: Calendar },
      { href: "/app/tarefas-recorrentes", label: "Tarefas Recorrentes", Icone: RefreshCw },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/app/gestor", label: "Painel do gestor", Icone: BarChart3 },
      { href: "/app/executivo", label: "Dashboard Executivo", Icone: LayoutGrid },
      { href: "/app/comissoes", label: "Comissões", Icone: CreditCard },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/app/contas", label: "Contas", Icone: Building2 },
      { href: "/app/pessoas", label: "Pessoas", Icone: Users },
      { href: "/app/campos-personalizados", label: "Campos personalizados", Icone: LayoutGrid },
    ],
  },
  {
    titulo: "Empresa",
    itens: [
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

const CHAVE_RECOLHIDOS = "tappo:nav:recolhidos";

function lerRecolhidos(): Set<string> {
  try {
    const salvo = localStorage.getItem(CHAVE_RECOLHIDOS);
    return salvo ? new Set(JSON.parse(salvo)) : new Set();
  } catch { return new Set(); }
}

/** Navegação lateral (desktop). Cada categoria com título recolhe/expande. */
export function NavLateral({ admin = false }: { admin?: boolean }) {
  const path = usePathname();
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : lerRecolhidos()));

  const grupos = gruposNav(admin);

  // A categoria da página atual nunca fica escondida, mesmo se o usuário a
  // recolheu antes — calculado no render (não em efeito: é derivado, não é
  // sincronização com sistema externo).
  const grupoAtivo = grupos.find((g) => g.itens.some((i) => ativo(path, i.href)))?.titulo;
  const recolhidosEfetivos = grupoAtivo && recolhidos.has(grupoAtivo)
    ? new Set([...recolhidos].filter((t) => t !== grupoAtivo))
    : recolhidos;

  function alternar(titulo: string) {
    setRecolhidos((atual) => {
      const n = new Set(atual);
      if (n.has(titulo)) n.delete(titulo); else n.add(titulo);
      try { localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify([...n])); } catch { /* storage indisponível */ }
      return n;
    });
  }

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
      <BotaoBusca />
      {grupos.map((g, i) => {
        const fechado = !!g.titulo && recolhidosEfetivos.has(g.titulo);
        return (
          <div key={i}>
            {g.titulo && (
              <button
                onClick={() => alternar(g.titulo!)}
                className="mb-1 flex w-full items-center justify-between rounded px-3 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-gray-600 transition-colors hover:text-gray-400"
                aria-expanded={!fechado}
              >
                {g.titulo}
                <ChevronDown size={12} className={cn("transition-transform", fechado && "-rotate-90")} />
              </button>
            )}
            <AnimatePresence initial={false}>
              {!fechado && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-0.5">
                    {g.itens.map(({ href, label, Icone }) => {
                      const on = ativo(path, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={on ? "page" : undefined}
                          className={`group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-200 ${on ? "text-[var(--acento-fg,#000)]" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
                        >
                          {on && <motion.span layoutId="nav-ativa" transition={mola} className="absolute inset-0 rounded-lg bg-[var(--acento,#fff)]" />}
                          <Icone size={16} strokeWidth={1.8} className="relative" />
                          <span className="relative font-medium">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
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
            {on && <motion.span layoutId="nav-ativa-m" transition={mola} className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--acento,#fff)]" />}
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
export function PaletaComandos({ admin = false }: { admin?: boolean }) {
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
      ...gruposNav(admin).flatMap((g) => g.itens).map((i) => ({ id: i.href, label: i.label, dica: "Ir para", Icone: i.Icone, acao: ir(i.href) })),
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
