"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Brain, Check, Loader2, RotateCcw, Sparkles, Square, Trash2, Undo2, Wrench, X } from "lucide-react";
import { cn } from "@/components/ui/base";
import { Markdown } from "./markdown";
import { apagarMemoria, aprovarLote, cancelarLote, desfazerLote, minhaMemoria, statusDosLotes } from "@/app/app/agente/actions";

/*
 * Chat do agente do CRM (/app/agente) — trabalha como o Claude Code: consulta,
 * monta um plano, o usuário aprova, executa, e dá para desfazer. Atalhos com "/".
 */

type Lote = { id: string; descricao: string; itens: string[]; total: number };
type Msg = { role: "user" | "assistant"; content: string; ferramentas?: string[]; erro?: boolean; lote?: Lote };
type Evento =
  | { t: "texto"; d: string }
  | { t: "ferramenta"; nome: string; rotulo: string }
  | { t: "erro"; d: string }
  | ({ t: "lote" } & Lote)
  | { t: "fim" };

const ATALHOS = [
  { cmd: "/hoje", desc: "O que fazer hoje", prompt: "O que eu preciso fazer hoje? Junte minhas tarefas de hoje e atrasadas, os contatos do dia e as conversas esperando resposta. Priorize." },
  { cmd: "/followup", desc: "Tarefas para leads parados", prompt: "Encontre os leads parados há 7 dias ou mais e proponha um lote com uma tarefa de follow-up (ligação ou WhatsApp) para amanhã para cada um." },
  { cmd: "/relatorio", desc: "Resumo da semana", prompt: "Faça um relatório curto dos últimos 7 dias: leads novos, reuniões, negócios ganhos/perdidos, pipeline em risco e as 3 ações mais importantes para a próxima semana." },
  { cmd: "/pipeline", desc: "Negócios em risco", prompt: "Analise meu pipeline: quais negócios estão parados há mais tempo e o que eu deveria fazer com cada um? Se fizer sentido, proponha tarefas em lote." },
  { cmd: "/inbox", desc: "Quem está esperando", prompt: "Quais conversas do Inbox estão esperando resposta ou sem dono? Resuma e diga por onde começar." },
  { cmd: "/limpar-duplicados", desc: "Achar leads repetidos", prompt: "Procure leads que parecem duplicados (mesmo nome/empresa ou e-mail parecido) e me mostre a lista com o que fazer. Não apague nada." },
  { cmd: "/memoria", desc: "O que você sabe de mim", prompt: "O que você lembra sobre mim e meu jeito de trabalhar?" },
];

const CHAVE = "tappo:agente-crm:conversa";

export function ChatCRM({ agente }: { agente: { nome: string; descricao: string | null } | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [rodando, setRodando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [memAberta, setMemAberta] = useState(false);
  const [selAtalho, setSelAtalho] = useState(0);
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) setMsgs(JSON.parse(salvo));
    } catch { /* storage indisponível */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const enviar = useCallback(async (conteudo: string) => {
    const q = conteudo.trim();
    if (!q || rodando) return;
    const historico: Msg[] = [...msgs.filter((m) => !m.erro), { role: "user", content: q }];
    setMsgs([...historico, { role: "assistant", content: "", ferramentas: [] }]);
    setTexto("");
    setRodando(true);
    setStatus("Pensando…");
    const ac = new AbortController();
    abortar.current = ac;
    const atualizar = (fn: (m: Msg) => Msg) => setMsgs((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    try {
      const res = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O lote vai no histórico como texto, para o agente saber o que já propôs
        body: JSON.stringify({ mensagens: historico.map(({ role, content, lote }) => ({ role, content: lote ? `${content}\n\n[Plano proposto: ${lote.descricao} — ${lote.total} alterações]` : content })) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.erro ?? "Falha ao falar com o agente.");
      }
      const leitor = res.body.getReader();
      const dec = new TextDecoder();
      let resto = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const linhas = resto.split("\n");
        resto = linhas.pop() ?? "";
        for (const l of linhas) {
          if (!l.trim()) continue;
          const e = JSON.parse(l) as Evento;
          if (e.t === "texto") { setStatus(null); atualizar((m) => ({ ...m, content: m.content + e.d })); }
          else if (e.t === "ferramenta") { setStatus(`${e.rotulo}…`); atualizar((m) => ({ ...m, ferramentas: [...(m.ferramentas ?? []), e.rotulo] })); }
          else if (e.t === "lote") atualizar((m) => ({ ...m, lote: { id: e.id, descricao: e.descricao, itens: e.itens, total: e.total } }));
          else if (e.t === "erro") atualizar((m) => ({ ...m, content: `${m.content}${m.content ? "\n\n" : ""}⚠ ${e.d}`, erro: !m.content && !m.lote }));
        }
      }
      router.refresh();
    } catch (e) {
      if (!ac.signal.aborted) atualizar((m) => ({ ...m, content: `⚠ ${e instanceof Error ? e.message : "Erro inesperado."}`, erro: true }));
    } finally {
      setRodando(false);
      setStatus(null);
      abortar.current = null;
      campo.current?.focus();
    }
  }, [msgs, rodando, router]);

  useEffect(() => {
    const q = params.get("q");
    if (q && !iniciou.current) {
      iniciou.current = true;
      router.replace("/app/agente");
      enviar(q);
    }
  }, [params, enviar, router]);

  // Menu de atalhos: aparece quando o texto começa com "/"
  const atalhos = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return t.startsWith("/") && !t.includes(" ") ? ATALHOS.filter((a) => a.cmd.startsWith(t)) : [];
  }, [texto]);
  const usarAtalho = (i: number) => { const a = atalhos[i]; if (a) enviar(a.prompt); };
  const expandir = (t: string) => ATALHOS.find((a) => a.cmd === t.trim().toLowerCase())?.prompt ?? t;

  if (!agente) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[14px] text-gray-400">
        O agente de IA está indisponível no momento. A administração da plataforma precisa ativar um modelo.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-white" />
          <span className="text-[13px] font-medium text-white">{agente.nome}</span>
          <span className="hidden text-[12px] text-gray-500 sm:inline">· agente do CRM</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMemAberta((v) => !v)} className={cn("btn btn-fantasma btn-sm", memAberta && "!bg-gray-900")}><Brain size={14} /> Memória</button>
          {msgs.length > 0 && <button onClick={() => setMsgs([])} disabled={rodando} className="btn btn-fantasma btn-sm" aria-label="Nova conversa"><RotateCcw size={14} /></button>}
        </div>
      </div>
      {memAberta && <PainelMemoria />}

      <div className="flex-1 overflow-y-auto p-4 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-3xl">
          {msgs.length === 0 ? (
            <div className="pt-6 sm:pt-14">
              <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">O que vamos fazer no CRM?</h1>
              <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-gray-400">
                {agente.descricao ?? "Peça em linguagem natural."} Eu consulto seus leads, tarefas, pipeline e Inbox de verdade. Quando for mexer em vários registros,
                mostro o plano para você aprovar — e dá para desfazer. Digite <span className="font-mono text-white">/</span> para ver os atalhos.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {ATALHOS.slice(0, 6).map((a) => (
                  <button key={a.cmd} onClick={() => enviar(a.prompt)} className="rounded-xl border border-gray-800 p-4 text-left transition-colors hover:border-gray-600">
                    <p className="font-mono text-[12.5px] text-white">{a.cmd}</p>
                    <p className="mt-1 text-[12px] text-gray-500">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-6">
              {msgs.map((m, i) => (
                <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[14px] leading-relaxed text-black">{m.content}</div>
                  ) : (
                    <div className="flex w-full gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 text-white"><Sparkles size={13} /></span>
                      <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-gray-200">
                        {!!m.ferramentas?.length && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {[...new Set(m.ferramentas)].map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-0.5 text-[11px] text-gray-500"><Wrench size={10} /> {f}</span>
                            ))}
                          </div>
                        )}
                        {m.content ? <Markdown texto={m.content} /> : rodando && i === msgs.length - 1 && !m.lote && (
                          <span className="inline-flex items-center gap-2 text-[13px] text-gray-500"><Loader2 size={14} className="animate-spin" /> {status}</span>
                        )}
                        {m.lote && <CartaoLote lote={m.lote} />}
                      </div>
                    </div>
                  )}
                </li>
              ))}
              <div ref={fim} />
            </ul>
          )}
        </div>
      </div>

      <div className="relative border-t border-gray-800 px-4 py-3 lg:px-8 lg:py-4">
        {atalhos.length > 0 && (
          <ul className="absolute bottom-full left-4 right-4 mx-auto mb-2 max-w-3xl overflow-hidden rounded-xl border border-gray-800 bg-[#0c0c0c] shadow-2xl" role="listbox">
            {atalhos.map((a, i) => (
              <li key={a.cmd} role="option" aria-selected={i === selAtalho}>
                <button onMouseEnter={() => setSelAtalho(i)} onClick={() => usarAtalho(i)} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === selAtalho ? "bg-white text-black" : "text-gray-300")}>
                  <span className="font-mono text-[13px]">{a.cmd}</span>
                  <span className={cn("text-[12px]", i === selAtalho ? "text-gray-600" : "text-gray-500")}>{a.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); enviar(expandir(texto)); }} className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <textarea
            ref={campo}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setSelAtalho(0); }}
            onKeyDown={(e) => {
              if (atalhos.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); setSelAtalho((s) => Math.min(s + 1, atalhos.length - 1)); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setSelAtalho((s) => Math.max(s - 1, 0)); return; }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); usarAtalho(selAtalho); return; }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(expandir(texto)); }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Peça algo ao agente… (digite / para atalhos)"
            aria-label="Mensagem"
            className="campo max-h-40 min-h-[44px] flex-1 !rounded-2xl !py-[11px] leading-snug"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          {rodando ? (
            <button type="button" onClick={() => abortar.current?.abort()} aria-label="Parar" className="btn btn-secundario mb-0.5 !h-10 !w-10 !p-0"><Square size={14} /></button>
          ) : (
            <button disabled={!texto.trim()} aria-label="Enviar" className="btn btn-primario mb-0.5 !h-10 !w-10 !p-0"><ArrowUp size={17} /></button>
          )}
        </form>
      </div>
    </div>
  );
}

/** Plano proposto pelo agente: nada muda até "Aprovar"; depois, "Desfazer". */
function CartaoLote({ lote }: { lote: Lote }) {
  const [estado, setEstado] = useState<{ status: string; resultado: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(lote.itens.length <= 8);
  const router = useRouter();

  // O status real vem do banco (o chat é recarregado do localStorage)
  useEffect(() => {
    let vivo = true;
    statusDosLotes([lote.id]).then((r) => { if (vivo) setEstado(r[lote.id] ?? { status: "pendente", resultado: null }); }).catch(() => {});
    return () => { vivo = false; };
  }, [lote.id]);

  const rodar = (f: () => Promise<{ ok: boolean; erro?: string; resultado?: string }>, novo: string) => iniciar(async () => {
    setErro(null);
    const r = await f();
    if (r.ok) { setEstado({ status: novo, resultado: r.resultado ?? null }); router.refresh(); } else setErro(r.erro ?? "Não foi possível.");
  });

  const st = estado?.status ?? "pendente";
  const ROTULO: Record<string, string> = { pendente: "Aguardando sua aprovação", executado: "Executado", cancelado: "Cancelado", desfeito: "Desfeito", falhou: "Falhou" };
  return (
    <div className={cn("mt-3 rounded-xl border p-4", st === "pendente" ? "border-white/60" : "border-gray-800")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Plano · {lote.total} alteraç{lote.total === 1 ? "ão" : "ões"} · {ROTULO[st] ?? st}</p>
          <p className="mt-1 text-[14px] font-medium text-white">{lote.descricao}</p>
        </div>
      </div>
      <button onClick={() => setAberto((v) => !v)} className="mt-2 text-[12px] text-gray-400 hover:text-white">{aberto ? "Esconder detalhes" : "Ver o que vai mudar"}</button>
      {aberto && (
        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-[12.5px] text-gray-300">
          {lote.itens.map((t, i) => <li key={i}>• {t}</li>)}
          {lote.total > lote.itens.length && <li className="text-gray-500">… e mais {lote.total - lote.itens.length}</li>}
        </ul>
      )}
      {estado?.resultado && <p className="mt-2 text-[12.5px] text-gray-400">{estado.resultado}</p>}
      {erro && <p role="alert" className="mt-2 text-[12.5px] text-red-400">{erro}</p>}
      <div className="mt-3 flex gap-2">
        {st === "pendente" && (
          <>
            <button disabled={pendente || !estado} onClick={() => rodar(() => aprovarLote(lote.id), "executado")} className="btn btn-primario btn-sm">
              {pendente ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar e executar
            </button>
            <button disabled={pendente || !estado} onClick={() => rodar(() => cancelarLote(lote.id), "cancelado")} className="btn btn-fantasma btn-sm"><X size={13} /> Cancelar</button>
          </>
        )}
        {st === "executado" && (
          <button disabled={pendente} onClick={() => rodar(() => desfazerLote(lote.id), "desfeito")} className="btn btn-secundario btn-sm">
            {pendente ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Desfazer
          </button>
        )}
      </div>
    </div>
  );
}

function PainelMemoria() {
  const [itens, setItens] = useState<{ id: string; fato: string }[] | null>(null);
  const [pendente, iniciar] = useTransition();
  useEffect(() => { minhaMemoria().then(setItens).catch(() => setItens([])); }, []);
  return (
    <div className="border-b border-gray-800 bg-[#080808] px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <p className="text-[12px] text-gray-400">O agente lembra disto entre conversas. Para ensinar algo novo, é só dizer (&quot;lembre que minha meta é…&quot;).</p>
        {itens === null ? <Loader2 size={14} className="mt-2 animate-spin text-gray-500" /> : itens.length ? (
          <ul className="mt-2 space-y-1">
            {itens.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-[13px] text-gray-200">
                <span>• {m.fato}</span>
                <button disabled={pendente} onClick={() => iniciar(async () => { const r = await apagarMemoria(m.id); if (r.ok) setItens((xs) => (xs ?? []).filter((x) => x.id !== m.id)); })} className="rounded p-1 text-gray-500 hover:text-white" aria-label="Apagar"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[13px] text-gray-500">Nada guardado ainda.</p>}
      </div>
    </div>
  );
}
