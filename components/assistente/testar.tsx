"use client";

import { useRef, useState } from "react";
import { ArrowUp, BookOpen, Loader2, RotateCcw, UserRound, Wrench } from "lucide-react";
import type { Atendente } from "@/lib/ai/assistente-tipos";
import { cn } from "@/components/ui/base";
import type { Evento } from "@/lib/ai/motor";

type Msg = {
  role: "user" | "assistant";
  content: string;
  ferramentas?: string[];
  fontes?: string[];
  transferiu?: string | null; // motivo
  erro?: boolean;
};

const SUGESTOES = [
  "Oi, quanto custa?",
  "Vocês abrem no sábado?",
  "Quero falar com uma pessoa",
  "Onde vocês ficam?",
];

export function TestarAssistente({ nomeAssistente, atendentes = [] }: { nomeAssistente: string; atendentes?: Atendente[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // Com vários atendentes, escolhe qual testar ("" = quem atende por padrão)
  const [atendenteId, setAtendenteId] = useState("");
  const [texto, setTexto] = useState("");
  const [rodando, setRodando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const rolar = () => requestAnimationFrame(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

  async function enviar(conteudo: string) {
    const t = conteudo.trim();
    if (!t || rodando) return;
    const historico: Msg[] = [...msgs.filter((m) => !m.erro), { role: "user", content: t }];
    setMsgs([...historico, { role: "assistant", content: "", ferramentas: [] }]);
    setTexto("");
    setRodando(true);
    rolar();
    const atualizar = (fn: (m: Msg) => Msg) => setMsgs((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    try {
      const res = await fetch("/api/assistente/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: historico.map(({ role, content }) => ({ role, content })), atendente_id: atendenteId || null }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null) as { erro?: string } | null;
        atualizar((m) => ({ ...m, content: `⚠ ${j?.erro ?? "Não foi possível testar agora."}`, erro: true }));
        return;
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
          if (e.t === "texto") atualizar((m) => ({ ...m, content: m.content + e.d }));
          else if (e.t === "ferramenta") atualizar((m) => ({ ...m, ferramentas: [...(m.ferramentas ?? []), e.rotulo] }));
          else if (e.t === "meta") atualizar((m) => ({ ...m, fontes: e.fontes, transferiu: e.transferiu ? (e.motivo ?? "") : null, content: m.content.replace(/\[HUMANO\]/gi, "").trim() }));
          else if (e.t === "erro") atualizar((m) => ({ ...m, content: `${m.content}${m.content ? "\n\n" : ""}⚠ ${e.d}`, erro: !m.content }));
        }
        rolar();
      }
    } catch {
      atualizar((m) => ({ ...m, content: "⚠ Conexão interrompida.", erro: true }));
    } finally {
      setRodando(false);
      rolar();
    }
  }

  return (
    <div className="painel flex h-[640px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
        <div>
          <p className="text-[14px] font-medium text-white">Converse como se fosse um cliente</p>
          <p className="text-[12px] text-gray-500">Simulação: nada é enviado e nenhum cadastro, tarefa ou memória é gravado.</p>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} disabled={rodando} className="btn btn-fantasma btn-sm"><RotateCcw size={13} /> Recomeçar</button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[14px] text-gray-300">Teste o {atendentes.find((a) => a.id === atendenteId)?.nome ?? nomeAssistente} antes de ligar a IA para seus clientes.</p>
            {atendentes.length > 0 && (
              <select value={atendenteId} onChange={(e) => setAtendenteId(e.target.value)} className="campo mt-3 w-auto text-[13px]" aria-label="Atendente a testar">
                <option value="">Atendente padrão</option>
                {atendentes.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.funcao ? ` — ${a.funcao}` : ""}</option>)}
              </select>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="rounded-full border border-gray-800 px-3 py-1.5 text-[12.5px] text-gray-300 hover:border-gray-600 hover:text-white">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] space-y-2")}>
              {m.role === "assistant" && !!m.ferramentas?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {m.ferramentas.map((f, j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-0.5 font-mono text-[10.5px] text-gray-500"><Wrench size={10} /> {f}</span>
                  ))}
                </div>
              )}
              <div className={cn(
                "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                m.role === "user" ? "bg-white text-black" : m.erro ? "border border-gray-700 text-gray-300" : "bg-gray-900 text-gray-100",
              )}>
                {m.content || (rodando && i === msgs.length - 1 ? <Loader2 size={14} className="animate-spin text-gray-500" /> : "")}
              </div>
              {m.role === "assistant" && !!m.fontes?.length && (
                <p className="flex items-start gap-1.5 text-[11.5px] text-gray-500"><BookOpen size={12} className="mt-0.5 shrink-0" /> Consultou: {m.fontes.join(" · ")}</p>
              )}
              {m.role === "assistant" && m.transferiu !== undefined && m.transferiu !== null && (
                <p className="flex items-start gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[11.5px] text-gray-300">
                  <UserRound size={12} className="mt-0.5 shrink-0" /> Passaria a conversa para a equipe{m.transferiu ? `: ${m.transferiu}` : "."}
                </p>
              )}
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex gap-2 border-t border-gray-800 p-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4000} placeholder="Escreva como um cliente…" className="campo flex-1" aria-label="Mensagem de teste" />
        <button disabled={rodando || !texto.trim()} className="btn btn-primario" aria-label="Enviar"><ArrowUp size={15} /></button>
      </form>
    </div>
  );
}
