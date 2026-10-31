"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { salvarProposta } from "@/app/app/propostas/actions";

export function FormProposta({ leads }: { leads: { id: string; nome: string; empresa: string }[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, iniciar] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={(fd) => iniciar(async () => {
        setErro(null); setOk(false);
        const r = await salvarProposta(fd);
        if (!r.ok) setErro(r.erro); else { setOk(true); ref.current?.reset(); }
      })}
      className="space-y-3"
    >
      <label className="block text-[12px] font-medium text-gray-300">Título
        <input name="titulo" placeholder="Ex.: Proposta comercial" className="campo mt-1.5 w-full" required maxLength={200} />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Valor (R$)
        <input name="valor" type="number" step="0.01" min="0" placeholder="0,00" className="campo mt-1.5 w-full" />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Lead
        <select name="lead_id" className="campo mt-1.5 w-full" defaultValue="">
          <option value="">— sem lead —</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.empresa}</option>)}
        </select>
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Escopo e condições (o cliente vê no link)
        <textarea name="descricao" rows={6} maxLength={8000} className="campo mt-1.5 w-full" placeholder={"O que está incluso, prazos, forma de pagamento…"} />
      </label>
      <input type="hidden" name="status" value="rascunho" />
      {erro && <p role="alert" className="text-[12.5px] text-red-400">{erro}</p>}
      {ok && <p className="text-[12.5px] text-emerald-400">Proposta criada. Use “Gerar link” para enviar ao cliente.</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? <Loader2 size={14} className="animate-spin" /> : "Criar proposta"}</button>
    </form>
  );
}
