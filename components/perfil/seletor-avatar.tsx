"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Rotulo, cn } from "@/components/ui/base";
import { salvarAvatarIcone } from "@/app/actions";
import { AVATARES_CARTOON, type AvatarIconeId } from "./avatares-cartoon";

export function SeletorAvatar({ iconeAtual }: { iconeAtual: string | null }) {
  const [icone, setIcone] = useState(iconeAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function escolher(novo: AvatarIconeId | null) {
    setIcone(novo);
    setErro(null);
    iniciar(async () => {
      const r = await salvarAvatarIcone(novo);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div>
      <Rotulo>Avatar</Rotulo>
      <p className="mb-3 text-[12.5px] text-gray-500">Escolha um ícone, ou deixe em branco para usar sua foto/inicial.</p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(AVATARES_CARTOON) as [AvatarIconeId, typeof AVATARES_CARTOON[AvatarIconeId]][]).map(([id, { nome, Icone }]) => (
          <button
            key={id}
            type="button"
            onClick={() => escolher(id)}
            title={nome}
            className={cn("rounded-full transition-transform", icone === id ? "scale-110 ring-2 ring-white" : "hover:scale-105 opacity-80 hover:opacity-100")}
          >
            <Icone tamanho={40} />
          </button>
        ))}
        {icone && (
          <button
            type="button"
            onClick={() => escolher(null)}
            title="Remover ícone"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-gray-700 text-gray-500 transition-colors hover:border-gray-500 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
        {pendente && <span className="self-center text-[11px] text-gray-500">salvando…</span>}
      </div>
      {erro && <p role="alert" className="mt-2 text-[12px] text-white">⚠ {erro}</p>}
    </div>
  );
}
