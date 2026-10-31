"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Gauge } from "lucide-react";
import { Barra } from "@/components/ui/base";
import { salvarLimiteOrg } from "@/app/admin/actions";

export type LinhaLimite = { id: string; nome: string; plano: string; tokens: number; teto: number | null; bloqueado: boolean };

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

function Linha({ l }: { l: LinhaLimite }) {
  const [teto, setTeto] = useState(l.teto ? String(l.teto) : "");
  const [bloqueado, setBloqueado] = useState(l.bloqueado);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudou = teto !== (l.teto ? String(l.teto) : "") || bloqueado !== l.bloqueado;

  const salvar = () => iniciar(async () => {
    setSalvo(false);
    const n = teto.trim() ? Number(teto.replace(/\D/g, "")) : null;
    const r = await salvarLimiteOrg(l.id, n, bloqueado);
    if (r.ok) { setErro(null); setSalvo(true); } else setErro(r.erro);
  });

  return (
    <tr className="border-t border-gray-800 align-top">
      <td className="px-4 py-3">
        <p className="text-[13px] font-medium text-white">{l.nome}</p>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-500">{l.plano}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-[13px] tabular text-gray-200">{fmt(l.tokens)}</p>
        {l.teto ? <Barra valor={l.tokens} max={l.teto} className="mt-1.5 w-32" /> : null}
      </td>
      <td className="px-4 py-3">
        <input value={teto} onChange={(e) => setTeto(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Sem teto"
          className="campo w-36" aria-label={`Teto mensal de tokens de ${l.nome}`} />
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 text-[12.5px] text-gray-300">
          <input type="checkbox" checked={bloqueado} onChange={(e) => setBloqueado(e.target.checked)} /> Pausar IA
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={salvar} disabled={!mudou || pendente} className="btn btn-secundario btn-sm">{pendente ? "…" : "Salvar"}</button>
        {salvo && !mudou && <Check size={14} className="ml-2 inline text-gray-400" aria-label="Salvo" />}
        {erro && <p role="alert" className="mt-1 text-[12px] text-white">⚠ {erro}</p>}
      </td>
    </tr>
  );
}

export function LimitesOrg({ linhas }: { linhas: LinhaLimite[] }) {
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return [...linhas].sort((a, b) => b.tokens - a.tokens).filter((l) => !t || l.nome.toLowerCase().includes(t));
  }, [linhas, busca]);

  return (
    <section className="painel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-800 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[14px] font-medium text-white"><Gauge size={14} /> Limites de IA por empresa</h2>
          <p className="mt-0.5 text-[12px] text-gray-500">Tokens do mês corrente (entrada + saída). Ao atingir o teto, a IA daquela empresa para de responder até o próximo mês; o resto da plataforma segue normal.</p>
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa…" className="campo w-full sm:w-56" aria-label="Buscar empresa" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-500">
              <th className="px-4 py-2.5 font-normal">Empresa</th>
              <th className="px-4 py-2.5 font-normal">Uso no mês</th>
              <th className="px-4 py-2.5 font-normal">Teto mensal (tokens)</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => <Linha key={l.id} l={l} />)}
            {!visiveis.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-gray-500">Nenhuma empresa encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
