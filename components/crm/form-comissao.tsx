"use client";

import { useState, useTransition } from "react";
import { salvarComissao } from "@/app/crm/actions";
import type { Membro } from "@/lib/data/types";

export function FormComissao({ membros }: { membros: Membro[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarComissao(fd);
        if (r.ok) { setErro(null); (document.getElementById("form-comissao") as HTMLFormElement | null)?.reset(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      })}
      id="form-comissao"
      className="space-y-3 grid gap-3 sm:grid-cols-4"
    >
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Vendedor</label>
        <select name="user_id" className="campo w-full" required>
          <option value="">— selecione —</option>
          {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Deal (ID, opcional)</label>
        <input name="deal_id" placeholder="UUID do negócio" className="campo w-full" />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Percentual (%)</label>
        <input name="percentual" type="number" step="0.01" min="0" max="100" placeholder="10" className="campo w-full" required />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Valor (R$)</label>
        <input name="valor_comissao" type="number" step="0.01" min="0" placeholder="0,00" className="campo w-full" required />
      </div>
      <div className="col-span-full sm:col-span-2">
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Mês</label>
        <input name="mes" type="month" className="campo w-full" required />
      </div>
      <div className="col-span-full sm:col-span-2">
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Status</label>
        <select name="status" className="campo w-full">
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      {erro && <p role="alert" className="text-[13px] text-white col-span-full">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full col-span-full sm:col-span-4">{pendente ? "Salvando…" : "Salvar comissão"}</button>
    </form>
  );
}
