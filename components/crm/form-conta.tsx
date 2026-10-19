"use client";

import { useState, useTransition } from "react";
import { salvarConta } from "@/app/crm/actions";

export function FormConta({ aoSalvar }: { aoSalvar?: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarConta(fd);
        if (r.ok) { setErro(null); (document.getElementById("form-conta") as HTMLFormElement | null)?.reset(); aoSalvar?.(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      })}
      id="form-conta"
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome da empresa</label>
        <input name="nome" placeholder="Ex.: Clínica Sorriso" className="campo w-full" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">CNPJ / CPF</label>
          <input name="cnpj_cpf" placeholder="00.000.000/0001-00" className="campo w-full" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Segmento</label>
          <input name="segmento" placeholder="Odontologia, Imobiliária…" className="campo w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Telefone</label>
          <input name="telefone" placeholder="(11) 99999-8888" className="campo w-full" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">E-mail</label>
          <input name="email" type="email" placeholder="contato@empresa.com" className="campo w-full" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Endereço</label>
        <input name="endereco" placeholder="Rua, número, bairro" className="campo w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Cidade</label>
          <input name="cidade" className="campo w-full" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Estado</label>
          <input name="estado" className="campo w-full" />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">CEP</label>
          <input name="cep" className="campo w-full" />
        </div>
      </div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Salvar conta"}</button>
    </form>
  );
}
