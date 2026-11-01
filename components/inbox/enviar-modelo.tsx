"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { enviarModeloWhatsApp } from "@/app/app/inbox/actions";

/** Aparece quando a Meta recusa por janela de 24h: manda um modelo aprovado. */
export function EnviarModelo({ conversaId, aoEnviar }: { conversaId: string; aoEnviar: () => void }) {
  const [nome, setNome] = useState("");
  const [idioma, setIdioma] = useState("pt_BR");
  const [params, setParams] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="mb-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-[12px] text-amber-200">Envie um modelo aprovado no WhatsApp Manager para reabrir a conversa:</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="nome_do_modelo" className="campo !h-8 !text-[13px]" />
        <input value={idioma} onChange={(e) => setIdioma(e.target.value)} placeholder="pt_BR" className="campo !h-8 !text-[13px]" />
      </div>
      <input value={params} onChange={(e) => setParams(e.target.value)} placeholder="Variáveis {{1}}, {{2}}… separadas por |" className="campo !h-8 !text-[13px]" />
      {erro && <p role="alert" className="text-[12px] text-red-400">{erro}</p>}
      <button
        type="button"
        disabled={pendente || !nome.trim()}
        onClick={() => iniciar(async () => {
          setErro(null);
          const r = await enviarModeloWhatsApp(conversaId, nome, idioma, params.split("|"));
          if (!r.ok) setErro(r.erro); else aoEnviar();
        })}
        className="btn btn-primario btn-sm"
      >
        {pendente ? <Loader2 size={13} className="animate-spin" /> : "Enviar modelo"}
      </button>
    </div>
  );
}
