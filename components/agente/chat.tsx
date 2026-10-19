"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, RotateCcw, Sparkles, Wrench, ArrowUp, Square, MessageSquare, Bot, Activity, Settings, Users, Clock, CreditCard, Mail, Phone } from "lucide-react";
import { cn } from "@/components/ui/base";

type Msg = { role: "user" | "assistant"; content: string; ferramentas?: string[]; erro?: boolean };
type Evento = { t: "texto"; d: string } | { t: "ferramenta"; nome: string; rotulo: string } | { t: "erro"; d: string } | { t: "fim" };

type AcaoRapida = {
  id: string;
  icone: React.ElementType;
  label: string;
  descricao: string;
  prompt: string;
  cor: string;
};

const ACÕES_RAPIDAS: AcaoRapida[] = [
  { id: "configurar-sla", icone: Clock, label: "Configurar SLA", descricao: "Defina prazos de resposta por canal", prompt: "Configure o SLA de resposta para 15 minutos no inbox WhatsApp", cor: "text-blue-400" },
  { id: "criar-automacao", icone: Activity, label: "Criar automação", descricao: "Gatilhos para tarefas e notificações", prompt: "Crie uma automação: quando um lead virar Qualificado, criar uma tarefa de follow-up", cor: "text-emerald-400" },
  { id: "diagnostico-empresa", icone: Settings, label: "Diagnóstico da empresa", descricao: "Verifique configurações, conexões e SLAs", prompt: "Faça um diagnóstico completo da configuração da minha empresa", cor: "text-amber-400" },
  { id: "convite-equipe", icone: Users, label: "Convidar equipe", descricao: "Adicione novos usuários com permissões", prompt: "Quero convidar um novo vendedor para a equipe com permissões de leads e pipeline", cor: "text-purple-400" },
  { id: "promocao-avaliacao", icone: CreditCard, label: "Promoção de avaliação", descricao: "Crie campanhas de avaliação gratuita", prompt: "Crie uma promoção de avaliação gratuita começando hoje por 14 dias", cor: "text-rose-400" },
  { id: "contatos-hoje", icone: Phone, label: "Quem contatar hoje", descricao: "Agenda de contatos e cadências vencidas", prompt: "Quem devo contatar hoje? Mostre leads com cadências vencidas", cor: "text-indigo-400" },
  { id: "resumo-pipeline", icone: Activity, label: "Resumo do pipeline", descricao: "Negócios parados e valores por etapa", prompt: "Resuma meu pipeline e aponte riscos de negócios parados", cor: "text-cyan-400" },
  { id: "ultimos-30-dias", icone: Clock, label: "Últimos 30 dias", descricao: "Leads, respostas, reuniões e ganhos", prompt: "Como foram os últimos 30 dias? Leads, respostas, reuniões e ganhos", cor: "text-violet-400" },
  { id: "email-primeiro-contato", icone: Mail, label: "E-mail de primeiro contato", descricao: "Mensagem curta e consultiva", prompt: "Escreva um e-mail de primeiro contato para um diretor de compras de tecnologia", cor: "text-sky-400" },
];

type ChatProps = {
  agente: { nome: string; descricao: string | null } | null;
  endpoint?: string;
  chaveStorage?: string;
  rotaBase?: string;
  sugestoes?: { t: string; d: string }[];
  nomeExibicao?: string;
  descricaoExibicao?: string;
};

export function Chat({ agente, endpoint = "/api/jarvis", chaveStorage = "tappo:jarvis:conversa", rotaBase = "/app/jarvis", sugestoes = [], nomeExibicao = "Jarvis", descricaoExibicao }: ChatProps) {
  const params = useSearchParams();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [rodando, setRodando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveStorage);
      if (salvo) setMsgs(JSON.parse(salvo));
    } catch { /* storage indisponível */ }
  }, [chaveStorage]);

  useEffect(() => {
    try { localStorage.setItem(chaveStorage, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, chaveStorage]);

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

    const atualizar = (fn: (m: Msg) => Msg) =>
      setMsgs((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: historico.map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.erro ?? "Falha ao falar com o Jarvis.");
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
else if (e.t === "erro") atualizar((m) => ({ ...m, content: `${m.content}${m.content ? "\n\n" : ""}⚠ ${e.d}`, erro: !m.content }));
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
  }, [msgs, rodando, router, endpoint, chaveStorage]);

  useEffect(() => {
    const q = params.get("q");
    if (q && !iniciou.current) {
      iniciou.current = true;
      router.replace(rotaBase);
      enviar(q);
    }
  }, [params, enviar, router, rotaBase]);

  if (!agente) {
    return (
      <div className="flex h-full flex-col">
        <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-gray-800 bg-black/50 p-4">
          <div className="space-y-3 mb-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Ações rápidas</h3>
            {ACÕES_RAPIDAS.map((a) => (
              <button key={a.id} onClick={() => enviar(a.prompt)} className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-left text-[12.5px] text-gray-300 hover:border-gray-600 hover:text-white transition-colors group">
                <a.icon className={`h-5 w-5 shrink-0 ${a.cor}`} />
                <div>
                  <div className="font-medium text-white">{a.label}</div>
                  <div className="text-[10px] text-gray-500">{a.descricao}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 bg-black/80 backdrop-blur px-4 py-3 z-10">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-400" />
              <span className="text-[13px] font-medium text-white">Jarvis — Assistente de IA</span>
            </div>
            <button onClick={() => setSidebarAberta(!sidebarAberta)} className="lg:hidden text-gray-400 hover:text-white p-1">
              <span className="sr-only">Abrir menu</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 lg:px-8 lg:py-6">
            <div className="mx-auto max-w-2xl lg:max-w-3xl">
              {msgs.length === 0 ? (
                <div className="pt-8 sm:pt-16">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                      <Sparkles size={20} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Conectado</span>
                  </div>
                  <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">{nomeExibicao}</h1>
                  <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-gray-400">
                    {descricaoExibicao ?? agente.descricao ?? "Pergunte sobre seus leads, campanhas e pipeline."} Ele lê e atualiza a sua base de verdade — nada é inventado.
                  </p>
                  <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ACÕES_RAPIDAS.map((a) => (
                      <button key={a.id} onClick={() => enviar(a.prompt)} className={cn(
                        "p-4 rounded-lg border border-gray-800 bg-black/30 text-left hover:border-gray-600 hover:bg-black/50 transition-colors group",
                        a.cor
                      )}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white mb-2 group-hover:bg-blue-500/20 transition-colors">
                          <a.icone className="h-4 w-4" />
                        </div>
                        <p className="text-[12.5px] font-medium text-white">{a.label}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{a.descricao}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="space-y-6">
                  {msgs.map((m, i) => (
                    <li key={i} className={cn("flex animate-[surgir_0.3s_ease-out]", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "user" ? (
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[14px] leading-relaxed text-black">{m.content}</div>
                      ) : (
                        <div className="flex w-full gap-3">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 text-white">
                            <Sparkles size={13} />
                          </span>
                          <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-gray-200">
                            {!!m.ferramentas?.length && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {[...new Set(m.ferramentas)].map((f) => (
                                  <span key={f} className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-0.5 text-[11px] text-gray-500">
                                    <Wrench size={10} /> {f}
                                  </span>
                                ))}
                              </div>
                            )}
                            {m.content ? (
                              <div className="prose prose-sm:max-w-none text-gray-200">
                                {m.content.split("\n").map((line, idx) => (
                                  <p key={idx} className="mb-2 last:mb-0">{line}</p>
                                ))}
                              </div>
                            ) : rodando && i === msgs.length - 1 && (
                              <span className="inline-flex items-center gap-2 text-[13px] text-gray-500">
                                <Loader2 size={14} className="animate-spin" /> {status}
                              </span>
                            )}
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
          <div className="border-t border-gray-800 bg-black/80 backdrop-blur-xl px-4 py-3 lg:px-8 lg:py-4">
            <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="mx-auto flex w-full max-w-2xl items-end gap-2">
              {msgs.length > 0 && (
                <button type="button" onClick={() => { setMsgs([]); }} disabled={rodando} aria-label="Nova conversa" className="mb-1 rounded-full p-2 text-gray-500 hover:bg-gray-900 hover:text-white disabled:opacity-40">
                  <RotateCcw size={17} />
                </button>
              )}
              <textarea
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
                rows={1}
                maxLength={4000}
                placeholder={`Mensagem para ${agente?.nome ?? nomeExibicao}…`}
                aria-label="Mensagem"
                className="campo max-h-40 min-h-[44px] flex-1 !rounded-2xl !py-[11px] leading-snug"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              {rodando ? (
                <button type="button" onClick={() => abortar.current?.abort()} aria-label="Parar" className="btn btn-secundario mb-0.5 !h-10 !w-10 !p-0">
                  <Square size={14} />
                </button>
              ) : (
                <button disabled={!texto.trim()} aria-label="Enviar" className="btn btn-primario mb-0.5 !h-10 !w-10 !p-0">
                  <ArrowUp size={17} />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-gray-800 bg-black/50 p-4">
        <div className="space-y-3 mb-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Ações rápidas</h3>
          {ACÕES_RAPIDAS.map((a) => (
            <button key={a.id} onClick={() => enviar(a.prompt)} className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-left text-[12.5px] text-gray-300 hover:border-gray-600 hover:text-white transition-colors group">
              <a.icone className={`h-5 w-5 shrink-0 ${a.cor}`} />
              <div>
                <div className="font-medium text-white">{a.label}</div>
                <div className="text-[10px] text-gray-500">{a.descricao}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="pt-4 border-t border-gray-800">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Capacidades</h3>
          <ul className="space-y-1 text-[11.5px] text-gray-400">
            <li className="flex items-center gap-1.5">• Diagnóstico de configurações</li>
            <li className="flex items-center gap-1.5">• Criação de automações e SLA</li>
            <li className="flex items-center gap-1.5">• Gestão de equipe e permissões</li>
            <li className="flex items-center gap-1.5">• Campanhas e promoções</li>
            <li className="flex items-center gap-1.5">• Análise de pipeline e leads</li>
          </ul>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-800 bg-black/80 backdrop-blur px-4 py-3 z-10">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-400" />
            <span className="text-[13px] font-medium text-white">{nomeExibicao}</span>
          </div>
          <button onClick={() => setSidebarAberta(!sidebarAberta)} className="lg:hidden text-gray-400 hover:text-white p-1">
            <span className="sr-only">Abrir menu</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-2xl lg:max-w-3xl">
            {msgs.length === 0 ? (
              <div className="pt-8 sm:pt-16">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Sparkles size={20} />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Conectado</span>
                </div>
                <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[32px]">{nomeExibicao}</h1>
                <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-gray-400">
                  {descricaoExibicao ?? agente.descricao ?? "Pergunte sobre seus leads, campanhas e pipeline."} Ele lê e atualiza a sua base de verdade — nada é inventado.
                </p>
                <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ACÕES_RAPIDAS.map((a) => (
                    <button key={a.id} onClick={() => enviar(a.prompt)} className={cn(
                      "p-4 rounded-lg border border-gray-800 bg-black/30 text-left hover:border-gray-600 hover:bg-black/50 transition-colors group",
                      a.cor
                    )}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white mb-2 group-hover:bg-blue-500/20 transition-colors">
                        <a.icone className="h-4 w-4" />
                      </div>
                      <p className="text-[12.5px] font-medium text-white">{a.label}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{a.descricao}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-6">
                {msgs.map((m, i) => (
                  <li key={i} className={cn("flex animate-[surgir_0.3s_ease-out]", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "user" ? (
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[14px] leading-relaxed text-black">{m.content}</div>
                    ) : (
                      <div className="flex w-full gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 text-white">
                          <Sparkles size={13} />
                        </span>
                        <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-gray-200">
                          {!!m.ferramentas?.length && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {[...new Set(m.ferramentas)].map((f) => (
                                <span key={f} className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-0.5 text-[11px] text-gray-500">
                                  <Wrench size={10} /> {f}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.content ? (
                            <div className="prose prose-sm:max-w-none text-gray-200">
                              {m.content.split("\n").map((line, idx) => (
                                <p key={idx} className="mb-2 last:mb-0">{line}</p>
                              ))}
                            </div>
                          ) : rodando && i === msgs.length - 1 && (
                            <span className="inline-flex items-center gap-2 text-[13px] text-gray-500">
                              <Loader2 size={14} className="animate-spin" /> {status}
                            </span>
                          )}
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
        <div className="border-t border-gray-800 bg-black/80 backdrop-blur-xl px-4 py-3 lg:px-8 lg:py-4">
          <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="mx-auto flex w-full max-w-2xl items-end gap-2">
            {msgs.length > 0 && (
              <button type="button" onClick={() => { setMsgs([]); }} disabled={rodando} aria-label="Nova conversa" className="mb-1 rounded-full p-2 text-gray-500 hover:bg-gray-900 hover:text-white disabled:opacity-40">
                <RotateCcw size={17} />
              </button>
            )}
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
              rows={1}
              maxLength={4000}
              placeholder={`Mensagem para ${agente?.nome ?? nomeExibicao}…`}
              aria-label="Mensagem"
              className="campo max-h-40 min-h-[44px] flex-1 !rounded-2xl !py-[11px] leading-snug"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {rodando ? (
              <button type="button" onClick={() => abortar.current?.abort()} aria-label="Parar" className="btn btn-secundario mb-0.5 !h-10 !w-10 !p-0">
                <Square size={14} />
              </button>
            ) : (
              <button disabled={!texto.trim()} aria-label="Enviar" className="btn btn-primario mb-0.5 !h-10 !w-10 !p-0">
                <ArrowUp size={17} />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export { Chat as ChatJarvis };
