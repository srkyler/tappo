"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { excluirEtapa, moverEtapa, salvarEtapa } from "@/app/app/actions";
import type { PipelineStage } from "@/lib/data/types";

type Rascunho = { nome: string; probabilidade: number; tipo: PipelineStage["tipo"]; sla_dias: number | null };

/** Etapas do funil editadas na própria tela: nome, probabilidade, tipo, SLA, ordem. */
export function EditorEtapas({ pipelineId, etapas }: { pipelineId: string; etapas: PipelineStage[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [nova, setNova] = useState<Rascunho>({ nome: "", probabilidade: 50, tipo: "aberto", sla_dias: null });
  const rodar = (f: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) => iniciar(async () => {
    const r = await f();
    if (r.ok) { setErro(null); depois?.(); } else setErro(r.erro ?? "Não foi possível salvar.");
  });

  return (
    <div className="grid gap-3">
      <p className="rotulo">Etapas</p>
      <ul className="grid gap-2">
        {etapas.map((e, i) => (
          <LinhaEtapa key={`${e.id}-${e.nome}-${e.probabilidade}-${e.tipo}-${e.sla_dias}`} etapa={e} primeira={i === 0} ultima={i === etapas.length - 1} pendente={pendente}
            aoSalvar={(r) => rodar(() => salvarEtapa(e.id, pipelineId, r))}
            aoMover={(d) => rodar(() => moverEtapa(e.id, d))}
            aoExcluir={() => { if (confirm(`Excluir a etapa "${e.nome}"?`)) rodar(() => excluirEtapa(e.id)); }} />
        ))}
      </ul>
      <form
        className="grid grid-cols-[1fr_4.5rem_auto] gap-2"
        onSubmit={(ev) => { ev.preventDefault(); rodar(() => salvarEtapa(null, pipelineId, nova), () => setNova({ ...nova, nome: "" })); }}
      >
        <input value={nova.nome} onChange={(ev) => setNova({ ...nova, nome: ev.target.value })} placeholder="Nova etapa" className="campo !h-9" required />
        <input type="number" min={0} max={100} value={nova.probabilidade} onChange={(ev) => setNova({ ...nova, probabilidade: Number(ev.target.value) })} className="campo !h-9" aria-label="Probabilidade %" />
        <button disabled={pendente} className="btn btn-secundario btn-sm"><Plus size={13} /> Adicionar</button>
      </form>
      {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}

function LinhaEtapa({ etapa, primeira, ultima, pendente, aoSalvar, aoMover, aoExcluir }: {
  etapa: PipelineStage; primeira: boolean; ultima: boolean; pendente: boolean;
  aoSalvar: (r: Rascunho) => void; aoMover: (d: -1 | 1) => void; aoExcluir: () => void;
}) {
  const [r, setR] = useState<Rascunho>({ nome: etapa.nome, probabilidade: etapa.probabilidade, tipo: etapa.tipo, sla_dias: etapa.sla_dias });
  const mudou = r.nome !== etapa.nome || r.probabilidade !== etapa.probabilidade || r.tipo !== etapa.tipo || r.sla_dias !== etapa.sla_dias;
  return (
    <li className="grid grid-cols-[1fr_4rem_6.5rem_4rem_auto] items-center gap-1.5 rounded-lg border border-gray-800 p-1.5">
      <input value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} className="campo !h-8 !text-[13px]" aria-label="Nome da etapa" />
      <input type="number" min={0} max={100} value={r.probabilidade} onChange={(e) => setR({ ...r, probabilidade: Number(e.target.value) })} className="campo !h-8 !text-[13px]" aria-label="Probabilidade %" title="Probabilidade %" />
      <select value={r.tipo} onChange={(e) => setR({ ...r, tipo: e.target.value as Rascunho["tipo"] })} className="campo !h-8 !text-[12px]" aria-label="Tipo">
        <option value="aberto">Aberta</option><option value="ganho">Ganho</option><option value="perdido">Perdido</option>
      </select>
      <input type="number" min={0} max={365} value={r.sla_dias ?? ""} placeholder="SLA d" onChange={(e) => setR({ ...r, sla_dias: e.target.value ? Number(e.target.value) : null })} className="campo !h-8 !text-[12px]" aria-label="SLA em dias" title="Dias máximos na etapa (alerta)" />
      <div className="flex">
        {mudou
          ? <button disabled={pendente} onClick={() => aoSalvar(r)} className="btn btn-primario btn-sm !h-8">Salvar</button>
          : <>
              <button disabled={pendente || primeira} onClick={() => aoMover(-1)} className="btn btn-fantasma btn-sm !h-8 !px-1.5" aria-label="Subir"><ArrowUp size={13} /></button>
              <button disabled={pendente || ultima} onClick={() => aoMover(1)} className="btn btn-fantasma btn-sm !h-8 !px-1.5" aria-label="Descer"><ArrowDown size={13} /></button>
              <button disabled={pendente} onClick={aoExcluir} className="btn btn-fantasma btn-sm !h-8 !px-1.5" aria-label="Excluir"><Trash2 size={13} /></button>
            </>}
      </div>
    </li>
  );
}
