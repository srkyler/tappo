"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BookOpen, GraduationCap, UserRound } from "lucide-react";
import { Vazio, cn } from "@/components/ui/base";
import type { Execucao } from "@/lib/ai/assistente-tipos";

type Filtro = "todas" | "sem_resposta" | "transferidas" | "erros";

const ROTULO: Record<string, string> = {
  buscar_conhecimento: "consultou a base",
  ver_cliente: "abriu a ficha",
  salvar_cliente: "salvou no CRM",
  lembrar_sobre_cliente: "guardou na memória",
  criar_tarefa_equipe: "criou tarefa",
  transferir_para_humano: "transferiu",
};
const CANAL: Record<string, string> = { whatsapp: "WhatsApp", telegram: "Telegram", email: "E-mail", teste: "Teste" };

/** A IA transferiu sem ter achado nada na base: candidata a virar FAQ. */
const semResposta = (e: Execucao) => e.transferiu && !e.conhecimento_ids.length && !e.erro;

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Atividade({ execucoes, aoEnsinar }: { execucoes: Execucao[]; aoEnsinar: (pergunta: string) => void }) {
  const reais = useMemo(() => execucoes.filter((e) => !e.teste), [execucoes]);
  const [filtro, setFiltro] = useState<Filtro>(() => (reais.some(semResposta) ? "sem_resposta" : "todas"));

  const lista = useMemo(() => {
    const base = filtro === "todas" ? execucoes : reais;
    return base.filter((e) =>
      filtro === "todas" ? true : filtro === "sem_resposta" ? semResposta(e) : filtro === "transferidas" ? e.transferiu : !!e.erro);
  }, [execucoes, reais, filtro]);

  const total = reais.length;
  const resolvidas = reais.filter((e) => !e.transferiu && !e.erro).length;
  const taxa = total ? Math.round((resolvidas / total) * 100) : 0;
  const filtros: { id: Filtro; label: string; n: number }[] = [
    { id: "sem_resposta", label: "Sem resposta na base", n: reais.filter(semResposta).length },
    { id: "transferidas", label: "Transferidas", n: reais.filter((e) => e.transferiu).length },
    { id: "erros", label: "Falhas", n: reais.filter((e) => e.erro).length },
    { id: "todas", label: "Todas", n: execucoes.length },
  ];

  return (
    <div className="space-y-4">
      <div className="painel flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 text-[13px] text-gray-400">
        <span><strong className="text-white tabular">{total}</strong> respostas recentes</span>
        <span><strong className="text-white tabular">{taxa}%</strong> resolvidas sem a equipe</span>
        <span className="text-[12px] text-gray-500">Perguntas que a IA não encontrou na base viram oportunidade: ensine a resposta e ela acerta da próxima vez.</span>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-800 p-1">
        {filtros.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={cn("rounded-md px-3 py-1.5 text-[12.5px]", filtro === f.id ? "bg-white font-medium text-black" : "text-gray-400 hover:text-white")}>
            {f.label} <span className="font-mono text-[11px] opacity-70">{f.n}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="painel">
          <Vazio icone={<Activity size={18} />} titulo={filtro === "sem_resposta" ? "Nenhuma pergunta sem resposta" : "Nada por aqui ainda"}
            texto="Assim que o assistente responder clientes, cada resposta aparece aqui com o que ele consultou e fez." />
        </div>
      ) : (
        <ul className="painel divide-y divide-gray-800">
          {lista.map((e) => (
            <li key={e.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-500">
                <span>{quando(e.created_at)}</span>
                <span className="rounded-full border border-gray-800 px-2 py-0.5">{CANAL[e.canal] ?? e.canal}</span>
                {e.ms != null && <span>{(e.ms / 1000).toFixed(1)}s</span>}
                {e.conversa_id && <Link href="/app/inbox" className="normal-case tracking-normal text-gray-400 underline hover:text-white">ver no Inbox</Link>}
              </div>
              {e.pergunta && <p className="text-[13px] text-white"><span className="text-gray-500">Cliente:</span> {e.pergunta}</p>}
              {e.resposta && <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-300"><span className="text-gray-500">IA:</span> {e.resposta}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                {e.conhecimento_ids.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2 py-0.5 text-[11px] text-gray-400"><BookOpen size={11} /> {e.conhecimento_ids.length} fonte(s)</span>
                )}
                {[...new Set(e.ferramentas)].filter((f) => f !== "buscar_conhecimento" && f !== "transferir_para_humano").map((f) => (
                  <span key={f} className="rounded-full border border-gray-800 px-2 py-0.5 text-[11px] text-gray-400">{ROTULO[f] ?? f}</span>
                ))}
                {e.transferiu && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-600 px-2 py-0.5 text-[11px] text-gray-200"><UserRound size={11} /> {e.motivo ?? "Transferiu para a equipe"}</span>
                )}
                {e.erro && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-600 px-2 py-0.5 text-[11px] text-gray-300"><AlertTriangle size={11} /> {e.erro}</span>
                )}
                {!e.teste && e.pergunta && (semResposta(e) || e.erro) && (
                  <button onClick={() => aoEnsinar(e.pergunta!)} className="btn btn-secundario btn-sm ml-auto"><GraduationCap size={13} /> Ensinar resposta</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
