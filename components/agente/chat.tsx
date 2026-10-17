"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, Wrench } from "lucide-react";
import { Markdown } from "./markdown";
import { cn } from "@/components/ui/base";

type Msg = { role: "user" | "assistant"; content: string; ferramentas?: string[]; erro?: boolean };
type Evento = { t: "texto"; d: string } | { t: "ferramenta"; nome: string; rotulo: string } | { t: "erro"; d: string } | { t: "fim" };

const CHAVE = "tappo:agente:conversa";
const SUGESTOES = [
  { t: "Quem devo contatar hoje?", d: "Agenda de contatos e cadências vencidas" },
  { t: "Resuma meu pipeline e aponte riscos", d: "Negócios parados e valores por etapa" },
  { t: "Como foram os últimos 30 dias?", d: "Leads, respostas, reuniões e ganhos" },
  { t: "Escreva um e-mail de primeiro contato para um diretor de compras", d: "Mensagem curta e consultiva" },
];

export function Chat({ agente, endpoint = "/api/agente", chaveStorage = CHAVE, rotaBase = "/app/agente", sugestoes = SUGESTOES, nomeExibicao, descricaoExibicao }: {
  agente: { nome: string; descricao: string | null } | null;
  endpoint?: string;
  chaveStorage?: string;
  rotaBase?: string;
  sugestoes?: typeof SUGESTOES;
  nomeExibicao?: string;
  descricaoExibicao?: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [rodando, setRodando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const iniciou = useRef(false);

  // Restaura a conversa deste navegador
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
          else if (e.t === "erro") atualizar((m) => ({ ...m, content: `${m.content}${m.content ? "\n\n" : ""}⚠ ${e.d}`, erro: !m.content }));
        }
      }
      router.refresh(); // o agente pode ter alterado dados: atualiza as outras telas
    } catch (e) {
      if (!ac.signal.aborted) atualizar((m) => ({ ...m, content: `⚠ ${e instanceof Error ? e.message : "Erro inesperado."}`, erro: true }));
    } finally {
      setRodando(false);
      setStatus(null);
      abortar.current = null;
      campo.current?.focus();
    }
  }, [msgs, rodando, router, endpoint]);

  // ?q= vindo do dashboard
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
      <div className="painel mx-auto mt-10 max-w-md p-8 text-center">
        <Sparkles size={22} className="mx-auto mb-3 text-gray-400" />
        <p className="text-[15px] font-medium text-white">Agente indisponível</p>
        <p className="mt-1.5 text-[13px] text-gray-500">Nenhum agente de IA está ativo no momento. O administrador precisa ativar um.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {msgs.length === 0 ? (
            <div className="pt-6 sm:pt-14">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black"><Sparkles size={20} /></span>
              <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em] text-white sm:text-[30px]">{nomeExibicao ?? agente.nome}</h1>
              <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-gray-400">
                {descricaoExibicao ?? agente.descricao ?? "Pergunte sobre seus leads, campanhas e pipeline."} Ele lê e atualiza a sua base de verdade — nada é inventado.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {sugestoes.map((s) => (
                  <button key={s.t} onClick={() => enviar(s.t)} className="painel group p-4 text-left transition-colors hover:border-gray-600">
                    <p className="text-[13.5px] font-medium text-white">{s.t}</p>
                    <p className="mt-1 text-[12px] text-gray-500">{s.d}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-6">
              {msgs.map((m, i) => (
                <li key={i} className={cn("flex animate-surgir", m.role === "user" ? "justify-end" : "justify-start")}>
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
                        {m.content ? <Markdown texto={m.content} /> : rodando && i === msgs.length - 1 && (
                          <span className="inline-flex items-center gap-2 text-[13px] text-gray-500"><Loader2 size={14} className="animate-spin" /> {status}</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div ref={fim} />
        </div>
      </div>

      <div className="border-t border-gray-800 bg-black/80 backdrop-blur-xl">
        <form
          onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3 sm:px-6"
        >
          {msgs.length > 0 && (
            <button type="button" onClick={() => { setMsgs([]); }} disabled={rodando} aria-label="Nova conversa" title="Nova conversa" className="mb-1 rounded-full p-2 text-gray-500 hover:bg-gray-900 hover:text-white disabled:opacity-40">
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
            placeholder={`Mensagem para ${agente.nome}…`}
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
