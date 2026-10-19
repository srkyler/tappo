"use client";

import { useState, useTransition } from "react";
import { salvarCampoPersonalizado } from "@/app/crm/actions";

export function FormCampoPersonalizado() {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarCampoPersonalizado(fd);
        if (r.ok) { setErro(null); (document.getElementById("form-campo-personalizado") as HTMLFormElement | null)?.reset(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      })}
      id="form-campo-personalizado"
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tabela</label>
        <select name="tabela" className="campo w-full">
          <option value="leads">Leads</option>
          <option value="deals">Negócios</option>
          <option value="contas">Contas</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome do campo</label>
        <input name="nome" placeholder="Ex.: Convênio, Cor do imóvel, Nível do curso" className="campo w-full" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tipo</label>
          <select name="tipo" className="campo w-full">
            <option value="texto">Texto</option>
            <option value="numero">Número</option>
            <option value="data">Data</option>
            <option value="selecao">Seleção (lista)</option>
            <option value="booleano">Sim/Não</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pt-6">
          <input type="checkbox" name="obrigatorio" />
          <span className="text-[13px] text-gray-300">Obrigatório</span>
        </label>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Opções (para seleção, JSON ou lista separada por vírgula)</label>
        <textarea name="opcoes" rows={2} placeholder='["Opção A", "Opção B"] ou Opção A, Opção B' className="campo w-full" />
      </div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Criando…" : "Criar campo"}</button>
    </form>
  );
}
