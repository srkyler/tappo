"use client";

import { useState, useTransition } from "react";
import { resolverDuplicado } from "@/app/app/crm/actions";

export function FormMesclarDuplicado({ duplicadoId, leadId, duplicadoDeId }: { duplicadoId: string; leadId: string; duplicadoDeId: string }) {
  const [manter, setManter] = useState(leadId);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        iniciar(async () => {
          const r = await resolverDuplicado(duplicadoId, manter);
          if (!r.ok) setErro(r.erro ?? "Não foi possível mesclar.");
        });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="radio" name={`manter-${duplicadoId}`} checked={manter === leadId} onChange={() => setManter(leadId)} className="accent-emerald-500" />
      <label className="text-[11px] text-gray-300">Manter este</label>
      <input type="radio" name={`manter-${duplicadoId}`} checked={manter === duplicadoDeId} onChange={() => setManter(duplicadoDeId)} className="accent-emerald-500" />
      <label className="text-[11px] text-gray-300">Manter o outro</label>
      <button type="submit" disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Mesclando…" : "Mesclar"}</button>
      {erro && <p role="alert" className="text-[12px] text-white w-full">⚠ {erro}</p>}
    </form>
  );
}
