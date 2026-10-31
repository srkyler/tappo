"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { alternarTarefaRecorrente, excluirTarefaRecorrente } from "@/app/app/crm/actions";
import type { TarefaRecorrente } from "@/lib/data/types";

const ROTULO = { diaria: "Todo dia", semanal: "Toda semana", mensal: "Todo mês", anual: "Todo ano" } as const;
const quando = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function ListaRecorrentes({ itens }: { itens: TarefaRecorrente[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (f: () => Promise<{ ok: boolean; erro?: string }>) => iniciar(async () => {
    const r = await f();
    setErro(r.ok ? null : r.erro ?? "Não foi possível.");
  });

  if (!itens.length) return <p className="px-5 py-8 text-center text-[13px] text-gray-500">Nenhuma tarefa recorrente ainda.</p>;
  return (
    <>
      {erro && <p role="alert" className="px-5 pt-3 text-[13px] text-red-400">{erro}</p>}
      <ul className="divide-y divide-gray-800">
        {itens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[14px] ${t.ativa ? "text-white" : "text-gray-500 line-through"}`}>{t.titulo}</p>
              <p className="text-[12px] text-gray-500">
                {ROTULO[t.recorrencia]} · {t.ativa ? `próxima: ${quando(t.proxima_execucao)}` : "pausada"} · {t.tipo} · prioridade {t.prioridade}
              </p>
            </div>
            <button disabled={pendente} onClick={() => rodar(() => alternarTarefaRecorrente(t.id, !t.ativa))} className="btn btn-fantasma btn-sm" aria-label={t.ativa ? "Pausar" : "Ativar"} title={t.ativa ? "Pausar" : "Ativar"}>
              {t.ativa ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button disabled={pendente} onClick={() => rodar(() => excluirTarefaRecorrente(t.id))} className="btn btn-fantasma btn-sm" aria-label="Excluir" title="Excluir">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
