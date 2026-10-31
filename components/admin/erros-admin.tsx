"use client";

import { useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { limparErros } from "@/app/admin/actions";

export type LinhaErro = { id: string; origem: string; empresa: string | null; mensagem: string; detalhe: Record<string, unknown>; created_at: string };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Falhas técnicas com o detalhe real (resposta do provedor de IA, WAHA…). Só o admin vê. */
export function ErrosAdmin({ erros }: { erros: LinhaErro[] }) {
  const [pendente, iniciar] = useTransition();
  return (
    <section className="painel overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><AlertTriangle size={15} /> Falhas recentes</h2>
          <p className="mt-1 text-[13px] text-gray-500">Por que a IA não respondeu, WhatsApp que caiu, agendador… O cliente só vê uma mensagem genérica.</p>
        </div>
        {erros.length > 0 && (
          <button disabled={pendente} onClick={() => iniciar(async () => { await limparErros(); })} className="btn btn-fantasma btn-sm">
            {pendente ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Limpar
          </button>
        )}
      </div>
      {erros.length === 0 ? (
        <p className="border-t border-gray-800 px-5 py-4 text-[13px] text-gray-500">Nenhuma falha registrada.</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-gray-800 overflow-y-auto border-t border-gray-800">
          {erros.map((e) => (
            <li key={e.id} className="px-5 py-3">
              <p className="flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
                <span className="font-mono text-gray-300">{e.origem}</span>
                <span>{quando(e.created_at)}</span>
                {e.empresa && <span>· {e.empresa}</span>}
                {typeof e.detalhe.modelo === "string" && <span>· {String(e.detalhe.agente ?? "")} ({e.detalhe.modelo})</span>}
              </p>
              <p className="mt-1 break-words font-mono text-[12px] text-red-300">{e.mensagem}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
