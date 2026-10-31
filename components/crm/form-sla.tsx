"use client";

import { useState, useTransition } from "react";
import { salvarSlaConfig } from "@/app/app/crm/actions";
import type { SlaConfig } from "@/lib/data/types";

export function FormSla({ sla }: { sla: SlaConfig | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarSlaConfig(fd);
        if (r.ok) { setErro(null); setOk(true); } else { setOk(false); setErro(r.erro ?? "Não foi possível salvar."); }
      })}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tempo de resposta (minutos)</label>
          <input name="tempo_resposta_min" type="number" min="1" defaultValue={sla?.tempo_resposta_min ?? 15} className="campo w-full" required />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
          <input type="checkbox" name="ativo" defaultChecked={sla?.ativo ?? true} className="mt-1" />
          <span>
            <span className="block text-[14px] font-medium text-white">SLA ativo</span>
            <span className="block text-[12.5px] text-gray-500">Quando inativo, não há alertas de tempo de resposta.</span>
          </span>
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
        <input type="checkbox" name="alertar_email" defaultChecked={sla?.alertar_email ?? true} className="mt-1" />
        <span>
          <span className="block text-[14px] font-medium text-white">Avisar por e-mail</span>
          <span className="block text-[12.5px] text-gray-500">Quando o cliente espera além do tempo, o responsável (ou os gestores, se ninguém assumiu) recebe um e-mail. O sino avisa sempre.</span>
        </span>
      </label>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      {ok && !erro && <p className="text-[13px] text-emerald-400">Configuração salva.</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Salvar configuração"}</button>
    </form>
  );
}
