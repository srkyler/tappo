"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { responderProposta } from "./actions";

export function RespostaProposta({ token }: { token: string }) {
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<null | boolean>(null);
  const [pendente, iniciar] = useTransition();

  if (feito !== null) {
    return (
      <section className="painel p-6 text-[14px]">
        {feito ? <p className="text-emerald-400">Proposta aceita. Obrigado! Em breve entraremos em contato.</p> : <p className="text-gray-300">Resposta registrada. Obrigado pelo retorno.</p>}
      </section>
    );
  }

  const responder = (aceitar: boolean) => iniciar(async () => {
    setErro(null);
    const r = await responderProposta(token, aceitar, nome, mensagem);
    if (!r.ok) setErro(r.erro); else setFeito(aceitar);
  });

  return (
    <section className="painel space-y-3 p-6">
      <h2 className="text-[15px] font-medium text-white">Sua resposta</h2>
      <label className="block text-[12px] text-gray-400">Seu nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="campo mt-1 w-full" placeholder="Nome de quem aprova" />
      </label>
      <label className="block text-[12px] text-gray-400">Mensagem (opcional)
        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={2000} rows={3} className="campo mt-1 w-full" placeholder="Algum ajuste, dúvida ou condição?" />
      </label>
      {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button disabled={pendente || nome.trim().length < 2} onClick={() => responder(true)} className="btn btn-primario flex-1">
          {pendente ? <Loader2 size={14} className="animate-spin" /> : "Aceitar proposta"}
        </button>
        <button disabled={pendente || nome.trim().length < 2} onClick={() => responder(false)} className="btn btn-fantasma flex-1">Recusar</button>
      </div>
    </section>
  );
}
