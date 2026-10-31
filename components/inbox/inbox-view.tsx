"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Bot, Check, CheckCheck, Inbox, Loader2, Mail, MessageCirclePlus, Search, Send, Settings, Smartphone, UserPlus, UserRound, Users, Clock, AlertTriangle, Target } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { Vazio, cn } from "@/components/ui/base";
import { atualizarConversa, atribuirConversa, criarLeadDaConversa, enviarMensagem, marcarComoLida, novaConversa } from "@/app/app/inbox/actions";
import { enviarMensagemTelegram } from "@/app/app/inbox/telegram-actions";
import { responderEmail } from "@/app/app/inbox/email-actions";
import { ConexaoTelegram } from "./conexao-telegram";
import { ConexaoEmail, type EmailConexaoTela } from "./conexao-email";

export type ConexaoTela = {
  id: string;
  sessao: string; status: string; numero: string | null;
  ia_ativa: boolean; ia_instrucoes: string;
  distribuicao?: string | null;
  apelido?: string | null;
};
export type ConexaoTelegramTela = {
  status: string; username: string | null; ia_ativa: boolean; ia_instrucoes: string;
  tem_token: boolean; distribuicao?: string | null;
};
export type CanalInbox = "whatsapp" | "telegram" | "instagram" | "email";
export type ConversaTela = {
  id: string; chat_id: string; nome: string | null; telefone: string | null; lead_id: string | null;
  status: "aberta" | "pendente" | "resolvida"; ia_ativa: boolean; nao_lidas: number;
  ultima_mensagem: string | null; ultima_em: string; atribuido_a: string | null; canal?: CanalInbox;
  prioridade?: string;
  resumo_ia?: string | null;
  leads?: { nome: string; empresa: string; cod: string } | null;
};
type Msg = { id: string; direcao: "entrada" | "saida"; autor: "contato" | "humano" | "ia" | "celular"; tipo: string; corpo: string | null; midia_url: string | null; created_at: string;
  status?: string | null; apagada?: boolean; transcricao?: string | null };

/** Foto, áudio e vídeo aparecem na própria bolha; o resto vira link. */
function Midia({ m, url }: { m: Msg; url: string }) {
  if (m.tipo === "imagem") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Imagem recebida" loading="lazy" className="max-h-64 rounded-lg object-contain" />
      </a>
    );
  }
  if (m.tipo === "audio") return <audio controls preload="none" src={url} className="mt-1 h-9 max-w-full" />;
  if (m.tipo === "video") return <video controls preload="none" src={url} className="mt-1 max-h-64 rounded-lg" />;
  return <a href={url} target="_blank" rel="noreferrer" className="text-[12px] underline">abrir {m.tipo}</a>;
}

/** ✓ enviada · ✓✓ entregue · ✓✓ azul lida (ack do WhatsApp). */
function Entrega({ status }: { status?: string | null }) {
  if (status === "erro") return <span title="Não entregue" className="text-red-500"><AlertTriangle size={11} /></span>;
  if (status === "lida") return <span title="Lida" className="text-sky-500"><CheckCheck size={11} /></span>;
  if (status === "entregue") return <span title="Entregue"><CheckCheck size={11} /></span>;
  return <span title="Enviada"><Check size={11} /></span>;
}

const FILTROS = [
  { id: "ativas", rotulo: "Ativas" },
  { id: "sem_dono", rotulo: "Sem responsável" },
  { id: "minhas", rotulo: "Minhas conversas" },
  { id: "pendente", rotulo: "Precisam de você" },
  { id: "resolvida", rotulo: "Resolvidas" },
] as const;

const hora = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const titulo = (c: ConversaTela) => c.leads?.nome || c.nome || (c.telefone ? `+${c.telefone}` : "Contato");
const AUTOR: Record<Msg["autor"], string> = { contato: "", humano: "Você", ia: "IA", celular: "Celular" };

export function InboxView({ userId, conexoes, conexaoTelegram, emailConexao, conversasIniciais, membros, slaConfig }: { userId: string; conexoes: ConexaoTela[]; conexaoTelegram: ConexaoTelegramTela | null; emailConexao: EmailConexaoTela | null; conversasIniciais: ConversaTela[]; membros: { user_id: string; nome: string; email: string | null; avatar_url: string | null; papel: string; ativo: boolean }[]; slaConfig: { tempo_resposta_min: number; ativo: boolean } | null }) {
  const sb = useMemo(() => createBrowserClient(), []);
  const router = useRouter();
  const [conversas, setConversas] = useState(conversasIniciais);
  // ?c=<id> abre a conversa direto (links do sino de notificações)
  const pedida = useSearchParams().get("c");
  const [selId, setSelId] = useState<string | null>(() => (pedida && conversasIniciais.some((c) => c.id === pedida) ? pedida : null));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("ativas");
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [configTelegram, setConfigTelegram] = useState(false);
  const [configEmail, setConfigEmail] = useState(false);
  const [nova, setNova] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [templates, setTemplates] = useState<{ id: string; titulo: string; corpo: string }[]>([]);
  const [slaConfigLocal, setSlaConfigLocal] = useState<{ tempo_resposta_min: number; ativo: boolean } | null>(null);
  const [conexaoAtiva] = useState<ConexaoTela | null>(conexoes.length ? conexoes[0] : null);
  const fim = useRef<HTMLDivElement>(null);

  // "Agora" pro cálculo de SLA — nunca Date.now() direto no corpo do componente
  // (não é puro). Atualiza a cada minuto, o suficiente pro alerta de SLA.
  const [agora, setAgora] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const sel = conversas.find((c) => c.id === selId) ?? null;
  const abrir = (id: string) => { if (id === selId) return; setMsgs([]); setCarregando(true); setSelId(id); };

  // Lista ao vivo
  useEffect(() => {
    const canal = sb.channel(`wa-conversas-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversas" }, (p) => {
        if (p.eventType === "DELETE") { setConversas((l) => l.filter((c) => c.id !== (p.old as { id: string }).id)); return; }
        const n = p.new as ConversaTela;
        setConversas((l) => {
          const antigo = l.find((c) => c.id === n.id);
          const resto = l.filter((c) => c.id !== n.id);
          return [{ ...n, leads: antigo?.leads ?? null }, ...resto].sort((a, b) => b.ultima_em.localeCompare(a.ultima_em));
        });
      })
      .subscribe();
    return () => { sb.removeChannel(canal); };
  }, [sb, userId]);

  // Respostas rápidas (templates da empresa)
  useEffect(() => {
    let vivo = true;
    sb.from("templates").select("id, titulo, corpo").order("titulo").then(({ data }) => {
      if (vivo) setTemplates((data ?? []) as { id: string; titulo: string; corpo: string }[]);
    });
    return () => { vivo = false; };
  }, [sb]);

  const inserirRapida = (corpo: string) => {
    setTexto((t) => (t ? `${t}\n${corpo}` : corpo));
  };

  // Mensagens da conversa aberta
  useEffect(() => {
    if (!selId) return;
    let vivo = true;
    sb.from("wa_mensagens").select("id, direcao, autor, tipo, corpo, midia_url, created_at, status, apagada, transcricao").eq("conversa_id", selId).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { if (vivo) { setMsgs(((data ?? []) as Msg[]).reverse()); setCarregando(false); } });
    marcarComoLida(selId);
    const canal = sb.channel(`wa-msgs-${selId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_mensagens", filter: `conversa_id=eq.${selId}` }, (p) => {
        const n = p.new as Msg;
        if (!n?.id) return;
        setMsgs((l) => (l.some((m) => m.id === n.id) ? l.map((m) => (m.id === n.id ? n : m)) : [...l, n]));
        if (n.direcao === "entrada") marcarComoLida(selId);
      })
      .subscribe();
    return () => { vivo = false; sb.removeChannel(canal); };
  }, [sb, selId]);

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs.length, selId]);

  // Sem useMemo de propósito: depende de Date.now(), que não é uma dependência
  // estável — memoizar isso deixaria "acima do SLA" congelado entre re-renders.
  const t = busca.trim().toLowerCase();
  const slaMin = slaConfig?.ativo ? slaConfig.tempo_resposta_min : null;
  const limiteSla = slaMin ? new Date(agora - slaMin * 60000) : null;
  const visiveis = conversas.filter((c) => {
    let passa = true;
    if (filtro === "ativas") passa = c.status !== "resolvida";
    else if (filtro === "sem_dono") passa = c.status !== "resolvida" && !c.atribuido_a;
    else if (filtro === "minhas") passa = c.atribuido_a === userId;
    else passa = c.status === filtro;
    if (!passa) return false;
    return !t || `${titulo(c)} ${c.telefone ?? ""} ${c.ultima_mensagem ?? ""}`.toLowerCase().includes(t);
  }).map((c) => ({
    ...c,
    acimaSla: !!limiteSla && c.status !== "resolvida" && new Date(c.ultima_em) < limiteSla,
  }));
  const contagem = (id: string) => conversas.filter((c) => {
    if (id === "ativas") return c.status !== "resolvida";
    if (id === "sem_dono") return c.status !== "resolvida" && !c.atribuido_a;
    if (id === "minhas") return c.atribuido_a === userId;
    return c.status === id;
  }).length;
  const contagemAcimaSla = visiveis.filter((c) => c.acimaSla).length;

  function mudar(m: { status?: ConversaTela["status"]; ia_ativa?: boolean }) {
    if (!sel) return;
    setConversas((l) => l.map((c) => (c.id === sel.id ? { ...c, ...m } : c)));
    iniciar(async () => { const r = await atualizarConversa(sel.id, m); if (!r.ok) setErro(r.erro); });
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!sel || !texto.trim()) return;
    const t = texto;
    setTexto(""); setErro(null);
    iniciar(async () => {
      // Cada canal tem sua própria action de envio — a conversa já sabe de onde veio.
      const r = sel.canal === "telegram" ? await enviarMensagemTelegram(sel.id, t)
        : sel.canal === "email" ? await responderEmail(sel.id, t)
        : await enviarMensagem(sel.id, t);
      if (!r.ok) { setErro(r.erro); setTexto(t); }
    });
  }

  const iaNoCanal = (canal?: CanalInbox) =>
    canal === "telegram" ? !!conexaoTelegram?.ia_ativa && conexaoTelegram.status === "WORKING"
    : canal === "email" ? !!emailConexao?.ia_ativa && !!emailConexao.endereco_recebe
    : conexoes.some((c) => c.ia_ativa && c.status === "WORKING");
  const conectado = sel?.canal === "telegram" ? conexaoTelegram?.status === "WORKING"
    : sel?.canal === "email" ? !!emailConexao?.endereco_envia
    : conexoes.some((c) => c.status === "WORKING");

  return (
    <>
      {!conectado && (
        <button onClick={() => router.push("/app/conexoes")} className="mb-3 flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-[13px] text-amber-300">
          <Smartphone size={15} />
          {conexaoAtiva ? `WhatsApp não conectado (${conexaoAtiva.status}).` : "Nenhuma conexão de WhatsApp."} Gerenciar e ler o QR na página Conexões.
        </button>
      )}
      <div className="painel grid h-[calc(100svh-230px)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
        {/* Lista */}
        <aside className={cn("flex min-h-0 flex-col border-gray-800 md:border-r", sel && "hidden md:flex")}>
          <div className="space-y-2 border-b border-gray-800 p-3">
            <div className="flex gap-2">
              <label className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa" className="campo pl-8" aria-label="Buscar conversa" />
              </label>
              <button onClick={() => setNova(true)} aria-label="Nova conversa" className="btn btn-secundario btn-sm h-10 px-2.5"><MessageCirclePlus size={16} /></button>
              <button onClick={() => router.push("/app/conexoes")} aria-label="Gerenciar conexões" title="Conexões (WhatsApp etc.)" className="btn btn-secundario btn-sm h-10 px-2.5"><Settings size={16} /></button>
              <button onClick={() => setConfigTelegram(true)} aria-label="Configurar Telegram" title="Telegram" className={cn("btn btn-secundario btn-sm h-10 px-2.5", conexaoTelegram?.status === "WORKING" && "border-sky-500/40 text-sky-400")}><Send size={15} /></button>
              <button onClick={() => setConfigEmail(true)} aria-label="Configurar e-mail" title="E-mail" className={cn("btn btn-secundario btn-sm h-10 px-2.5", emailConexao?.endereco_recebe && "border-amber-500/40 text-amber-400")}><Mail size={15} /></button>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {FILTROS.map((f) => {
                const extra = f.id === "ativas" && contagemAcimaSla > 0 ? ` +${contagemAcimaSla} SLA` : "";
                return (
                  <button key={f.id} onClick={() => setFiltro(f.id)} className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px]", filtro === f.id ? "bg-white text-black" : "text-gray-400 hover:bg-gray-900")}>
                    {f.rotulo}{extra} <span className="opacity-60">{contagem(f.id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visiveis.length === 0 && <li className="p-6 text-center text-[13px] text-gray-500">Nenhuma conversa aqui.</li>}
            {visiveis.map((c) => (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className={cn("flex w-full gap-3 border-b border-gray-900 px-3 py-3 text-left transition-colors hover:bg-gray-900/60", c.id === selId && "bg-gray-900")}>
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[13px] font-semibold text-white">
                    {titulo(c)[0]?.toUpperCase()}
                    {c.canal === "telegram" && <Send size={9} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-sky-500 p-0.5 text-white" aria-label="Telegram" />}
                    {c.canal === "email" && <Mail size={9} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-500 p-0.5 text-white" aria-label="E-mail" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-medium text-white">{titulo(c)}</span>
                      <span className="shrink-0 text-[11px] text-gray-500">{hora(c.ultima_em)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] text-gray-500">{c.ultima_mensagem ?? "—"}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {c.ia_ativa && iaNoCanal(c.canal) && <Bot size={12} className="text-gray-500" aria-label="IA ativa" />}
                        {c.status === "pendente" && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Precisa de você" />}
                        {c.atribuido_a && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Users size={10} /> {membros.find((m) => m.user_id === c.atribuido_a)?.nome?.split(" ")[0] ?? "—"}
                          </span>
                        )}
                        {c.nao_lidas > 0 && <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-black">{c.nao_lidas}</span>}
                        {c.acimaSla && <span className="flex items-center gap-1 text-[11px] text-red-400" title="Acima do SLA de resposta"><Clock size={10} /> SLA</span>}
                        {c.prioridade === "urgente" && <span className="flex items-center gap-1 text-[11px] text-red-500" title="Prioridade urgente"><AlertTriangle size={10} /> Urgente</span>}
                        {c.prioridade === "alta" && <span className="flex items-center gap-1 text-[11px] text-amber-400" title="Prioridade alta"><Target size={10} /> Alta</span>}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversa */}
        <section className={cn("flex min-h-0 flex-col", !sel && "hidden md:flex")}>
          {!sel ? (
            <div className="m-auto"><Vazio icone={<Inbox size={18} />} titulo="Selecione uma conversa" texto={conversas.length ? "As mensagens chegam aqui em tempo real." : "Conecte o WhatsApp na página Conexões e as conversas dos clientes aparecem aqui."} /></div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-3 py-2.5">
                <button onClick={() => setSelId(null)} aria-label="Voltar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 md:hidden"><ArrowLeft size={16} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-white">{titulo(sel)}</p>
                  <p className="truncate text-[12px] text-gray-500">
                    {sel.telefone ? `+${sel.telefone}` : sel.chat_id}
                    {sel.leads && <> · <Link href={`/app/leads?q=${encodeURIComponent(sel.leads.cod)}`} className="underline underline-offset-2 hover:text-white">{sel.leads.cod} · {sel.leads.empresa}</Link></>}
                  </p>
                </div>
                {iaNoCanal(sel.canal) && (
                  <button onClick={() => mudar({ ia_ativa: !sel.ia_ativa })} className={cn("btn btn-sm", sel.ia_ativa ? "btn-secundario" : "btn-fantasma")} title={sel.ia_ativa ? "A IA está respondendo. Clique para assumir." : "Você está atendendo. Clique para devolver à IA."}>
                    {sel.ia_ativa ? <><Bot size={14} /> IA atendendo</> : <><UserRound size={14} /> Você atendendo</>}
                  </button>
                )}
                {!sel.lead_id && (
                  <button disabled={pendente} onClick={() => { const emp = prompt("Empresa do contato (opcional):") ?? ""; iniciar(async () => { const r = await criarLeadDaConversa(sel.id, emp); if (!r.ok) setErro(r.erro); else location.reload(); }); }} className="btn btn-fantasma btn-sm"><UserPlus size={14} /> Criar lead</button>
                )}
                <select value={sel.status} onChange={(e) => mudar({ status: e.target.value as ConversaTela["status"] })} className="campo h-8 w-auto py-0 text-[13px]" aria-label="Status da conversa">
                  <option value="aberta">Aberta</option>
                  <option value="pendente">Precisa de você</option>
                  <option value="resolvida">Resolvida</option>
                </select>
                <select value={sel.atribuido_a ?? ""} onChange={(e) => { iniciar(async () => { const r = await atribuirConversa(sel.id, e.target.value || null); if (!r.ok) setErro(r.erro); else setConversas((l) => l.map((c) => c.id === sel.id ? { ...c, atribuido_a: e.target.value || null } : c)); }); }} className="campo h-8 w-auto py-0 text-[13px]" aria-label="Responsável">
                  <option value="">Não atribuído</option>
                  {membros.filter((m) => m.ativo).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.nome}</option>
                  ))}
                </select>
                {sel.atribuido_a && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Users size={12} /> {membros.find((m) => m.user_id === sel.atribuido_a)?.nome ?? "—"}
                  </span>
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5">
                {sel.resumo_ia && !sel.ia_ativa && (
                  <div className="mx-auto mb-3 max-w-[90%] rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[13px] text-gray-200">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-300"><Bot size={11} /> Resumo da IA para quem assume</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{sel.resumo_ia}</p>
                  </div>
                )}
                {carregando && <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-500" /></div>}
                {msgs.map((m) => (
                  <div key={m.id} className={cn("flex", m.direcao === "saida" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed", m.direcao === "saida" ? "rounded-br-md bg-white text-black" : "rounded-bl-md bg-gray-800 text-gray-100")}>
                      {m.corpo ? <p className="whitespace-pre-wrap break-words">{m.corpo}</p> : !m.midia_url && <p className="italic opacity-70">[{m.tipo}]</p>}
                      {m.midia_url && <Midia m={m} url={(sel.canal ?? "whatsapp") === "whatsapp" ? `/api/whatsapp/midia/${m.id}` : m.midia_url} />}
                      {m.transcricao && (
                        <p className="mt-1 border-l-2 border-gray-600 pl-2 text-[12.5px] italic opacity-80">
                          {m.tipo === "audio" ? "Transcrição: " : "A IA viu: "}{m.transcricao}
                        </p>
                      )}
                      {m.apagada && <p className="mt-0.5 flex items-center gap-1 text-[11px] italic opacity-60"><Ban size={10} /> apagada pelo contato</p>}
                      <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10.5px]", m.direcao === "saida" ? "text-gray-500" : "text-gray-400")}>
                        {AUTOR[m.autor] && <span>{m.autor === "ia" && <Bot size={10} className="mr-0.5 inline" />}{AUTOR[m.autor]} ·</span>}
                        {hora(m.created_at)}
                        {m.direcao === "saida" && <Entrega status={m.status} />}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={fim} />
              </div>

              <form onSubmit={enviar} className="border-t border-gray-800 p-3">
                {erro && <p role="alert" className="mb-2 text-[12.5px] text-red-400">{erro}</p>}
                <div className="flex items-end gap-2">
                  {templates.length > 0 && (
                    <select
                      onChange={(e) => { if (e.target.value) inserirRapida(e.target.value); e.target.value = ""; }}
                      defaultValue=""
                      className="campo h-8 w-auto py-0 text-[12px] shrink-0"
                      aria-label="Resposta rápida"
                    >
                      <option value="">⚡ Resposta rápida</option>
                      {templates.map((t) => <option key={t.id} value={t.corpo}>{t.titulo}</option>)}
                    </select>
                  )}
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                    rows={1}
                    placeholder={conectado ? (sel.ia_ativa && conexoes.some((c) => c.ia_ativa) ? "Escreva para responder (a IA continua ativa)…" : "Escreva uma mensagem…") : `Conecte o ${sel.canal === "telegram" ? "Telegram" : "WhatsApp"} para enviar`}
                    disabled={!conectado}
                    className="campo min-h-[42px] flex-1 resize-none"
                    aria-label="Mensagem"
                  />
                  <button disabled={!conectado || pendente || !texto.trim()} className="btn btn-primario h-[42px] px-3" aria-label="Enviar"><Send size={16} /></button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      <ConexaoTelegram aberto={configTelegram} aoFechar={() => setConfigTelegram(false)} conexao={conexaoTelegram} />
      <ConexaoEmail aberto={configEmail} aoFechar={() => setConfigEmail(false)} conexao={emailConexao} />
      {nova && <NovaConversa aoFechar={() => setNova(false)} aoCriar={(id) => { setNova(false); abrir(id); }} />}
    </>
  );
}

function NovaConversa({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={aoFechar}>
      <form
        onClick={(e) => e.stopPropagation()}
        action={(f) => iniciar(async () => {
          const r = await novaConversa(String(f.get("fone")), String(f.get("texto")));
          if (r.ok) aoCriar(r.id); else setErro(r.erro);
        })}
        className="painel w-full max-w-sm space-y-3 p-5"
      >
        <h2 className="text-[16px] font-semibold text-white">Nova conversa</h2>
        <input name="fone" placeholder="DDD + número (ex.: 11 99999-8888)" className="campo" required autoFocus />
        <textarea name="texto" rows={3} placeholder="Primeira mensagem" className="campo" />
        {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="btn btn-fantasma btn-sm">Cancelar</button>
          <button disabled={pendente} className="btn btn-primario btn-sm">{pendente && <Loader2 size={14} className="animate-spin" />} Iniciar</button>
        </div>
      </form>
    </div>
  );
}
