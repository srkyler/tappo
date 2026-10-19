"use client";

import { useState, useTransition } from "react";
import { salvarPessoa } from "@/app/crm/actions";
import type { Conta } from "@/lib/data/types";

export function FormPessoa({ contas }: { contas: Pick<Conta, "id" | "nome">[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarPessoa(fd);
        if (r.ok) { setErro(null); (document.getElementById("form-pessoa") as HTMLFormElement | null)?.reset(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      })}
      id="form-pessoa"
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome</label>
        <input name="nome" placeholder="Ex.: Maria Silva" className="campo w-full" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Conta (empresa)</label>
          <select name="conta_id" className="campo w-full">
            <option value="">— nenhuma —</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Cargo</label>
          <input name="cargo" placeholder="Ex.: Gerente, Dentista" className="campo w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Telefone</label>
          <input name="telefone" placeholder="(11) 99999-8888" className="campo w-full" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">WhatsApp</label>
          <input name="telefone_whatsapp" placeholder="(11) 99999-8888" className="campo w-full" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">E-mail</label>
        <input name="email" type="email" placeholder="maria@empresa.com" className="campo w-full" />
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
        <input type="checkbox" name="lider_decisao" className="mt-1" />
        <span>
          <span className="block text-[14px] font-medium text-white">É decisor / tomador de decisão</span>
          <span className="block text-[12.5px] text-gray-500">Marca esta pessoa como quem decide a compra na conta.</span>
        </span>
      </label>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Salvar pessoa"}</button>
    </form>
  );
}
