"use client";

import { useState } from "react";
import { calcularScoreLeadAction } from "@/app/app/crm/actions";

const COR: Record<string, string> = {
  frio: "text-gray-500",
  morno: "text-amber-400",
  quente: "text-red-400",
  qualificado: "text-emerald-400",
};

export function RecalcularScore({ leadId, scoreInicial, classificacaoInicial }: { leadId: string; scoreInicial: number | null; classificacaoInicial: string | null }) {
  const [score, setScore] = useState(scoreInicial);
  const [classificacao, setClassificacao] = useState(classificacaoInicial);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recalcular() {
    setCalculando(true);
    setErro(null);
    const r = await calcularScoreLeadAction(leadId);
    setCalculando(false);
    if (r.ok) { setScore(r.score ?? null); setClassificacao(r.classificacao ?? null); }
    else setErro(r.erro ?? "Não foi possível calcular.");
  }

  return (
    <div className="painel p-5">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Score</p>
      <div className="flex items-center justify-between">
        <p className={`text-[24px] font-bold tabular ${classificacao ? COR[classificacao] ?? "text-gray-500" : "text-gray-500"}`}>
          {score ?? "—"}
        </p>
        <button onClick={recalcular} disabled={calculando} className="btn btn-fantasma btn-sm px-2 text-[11px]">
          {calculando ? "…" : "Recalcular"}
        </button>
      </div>
      <p className="text-[11px] text-gray-500">{classificacao ?? "—"}</p>
      {erro && <p role="alert" className="mt-1 text-[11px] text-white">⚠ {erro}</p>}
    </div>
  );
}
