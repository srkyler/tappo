"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Loader2 } from "lucide-react";
import { salvarModeloAtendente } from "@/app/admin/actions";

export type LinhaAtendente = { id: string; nome: string; funcao: string; empresa: string; ativo: boolean; agent_id: string | null };
export type OpcaoAgente = { id: string; nome: string; modelo: string; ativo: boolean };

function Linha({ l, agentes }: { l: LinhaAtendente; agentes: OpcaoAgente[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <tr className="border-t border-gray-800">
      <td className="px-4 py-3 text-[13px] text-gray-400">{l.empresa}</td>
      <td className="px-4 py-3">
        <p className="text-[13px] font-medium text-white">{l.nome}{!l.ativo && <span className="ml-1.5 text-[11px] text-gray-500">(pausado)</span>}</p>
        <p className="text-[12px] text-gray-500">{l.funcao || "—"}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            defaultValue={l.agent_id ?? ""}
            disabled={pendente}
            onChange={(e) => iniciar(async () => {
              setSalvo(false);
              const r = await salvarModeloAtendente(l.id, e.target.value || null);
              if (r.ok) { setErro(null); setSalvo(true); } else setErro(r.erro);
            })}
            className="campo w-auto min-w-[220px] py-1.5 text-[13px]"
            aria-label={`Modelo de ${l.nome}`}
          >
            <option value="">Padrão da plataforma{agentes.find((a) => a.ativo) ? ` (${agentes.find((a) => a.ativo)!.nome})` : ""}</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nome} — {a.modelo}</option>)}
          </select>
          {pendente && <Loader2 size={13} className="animate-spin text-gray-500" />}
          {salvo && <Check size={13} className="text-emerald-400" />}
        </div>
        {erro && <p className="mt-1 text-[12px] text-red-400">{erro}</p>}
      </td>
    </tr>
  );
}

/** Atendentes de IA de todas as empresas e o modelo de cada um (o cliente nunca vê esta escolha). */
export function AtendentesAdmin({ linhas, agentes }: { linhas: LinhaAtendente[]; agentes: OpcaoAgente[] }) {
  return (
    <section className="painel overflow-hidden">
      <div className="p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><Bot size={15} /> Atendentes de IA das empresas</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Cada empresa cria quantos atendentes quiser em /app/assistente. Aqui você escolhe o modelo de cada um; sem escolha, usa o agente ativo.
        </p>
      </div>
      {linhas.length === 0 ? (
        <p className="border-t border-gray-800 px-5 py-4 text-[13px] text-gray-500">Nenhuma empresa criou atendentes ainda (ou a migration 20261101000000 não rodou).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] uppercase tracking-wide text-gray-500"><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">Atendente</th><th className="px-4 py-2">Modelo</th></tr></thead>
            <tbody>{linhas.map((l) => <Linha key={l.id} l={l} agentes={agentes} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
