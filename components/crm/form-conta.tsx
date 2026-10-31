"use client";

import { useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { buscarCnpj, salvarConta } from "@/app/app/crm/actions";

export function FormConta({ aoSalvar }: { aoSalvar?: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [buscando, buscar] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Preenche só os campos vazios com o que a Receita tem (não apaga o que a pessoa digitou)
  const enriquecer = () => buscar(async () => {
    const f = form.current;
    if (!f) return;
    setErro(null); setInfo(null);
    const r = await buscarCnpj((f.elements.namedItem("cnpj_cpf") as HTMLInputElement).value);
    if (!r.ok) { setErro(r.erro); return; }
    const d = r.dados;
    const valores: Record<string, string | null> = {
      nome: d.fantasia || d.nome, segmento: d.segmento, telefone: d.telefone, email: d.email,
      endereco: d.endereco, cidade: d.cidade, estado: d.estado, cep: d.cep,
    };
    for (const [k, v] of Object.entries(valores)) {
      const el = f.elements.namedItem(k) as HTMLInputElement | null;
      if (el && v && !el.value.trim()) el.value = v;
    }
    setInfo(`${d.nome}${d.situacao ? ` — situação: ${d.situacao.toLowerCase()}` : ""}`);
  });

  return (
    <form
      ref={form}
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
          <div className="flex gap-2">
            <input name="cnpj_cpf" placeholder="00.000.000/0001-00" className="campo w-full" />
            <button type="button" onClick={enriquecer} disabled={buscando} className="btn btn-secundario btn-sm shrink-0" title="Preencher com os dados da Receita">
              <Search size={13} /> {buscando ? "…" : "Buscar"}
            </button>
          </div>
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
      {info && <p className="text-[12.5px] text-emerald-300">Receita: {info}</p>}
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Salvar conta"}</button>
    </form>
  );
}
