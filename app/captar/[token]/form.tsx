"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

export function FormCaptacao({ token }: { token: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (feito) return <div className="painel p-6 text-center text-[14px] text-emerald-400">Recebemos seus dados. Obrigado! Em breve entraremos em contato.</div>;

  return (
    <form
      className="painel space-y-4 p-6"
      action={(fd) => iniciar(async () => {
        setErro(null);
        const dados = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
        try {
          const r = await fetch(`/api/v1/webhooks/in/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
          const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
          if (!r.ok || !j.ok) setErro(j.erro ?? "Não consegui enviar. Tente de novo."); else setFeito(true);
        } catch { setErro("Sem conexão. Tente de novo."); }
      })}
    >
      <label className="block text-[12px] font-medium text-gray-300">Seu nome
        <input name="nome" placeholder="Nome completo" className="campo mt-1.5 w-full" required maxLength={200} />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">E-mail
        <input name="email" type="email" placeholder="seu@empresa.com" className="campo mt-1.5 w-full" required maxLength={200} />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Telefone (WhatsApp)
        <input name="telefone" type="tel" placeholder="(11) 99999-8888" className="campo mt-1.5 w-full" required maxLength={40} />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Empresa
        <input name="empresa" placeholder="Nome da empresa" className="campo mt-1.5 w-full" maxLength={200} />
      </label>
      <label className="block text-[12px] font-medium text-gray-300">Mensagem
        <textarea name="mensagem" rows={3} placeholder="Como podemos ajudar?" className="campo mt-1.5 w-full" maxLength={2000} />
      </label>
      {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? <Loader2 size={14} className="animate-spin" /> : "Enviar"}</button>
    </form>
  );
}
