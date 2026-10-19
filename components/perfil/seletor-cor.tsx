"use client";

import { useState, useTransition } from "react";
import { Rotulo, cn } from "@/components/ui/base";
import { salvarCorDestaque } from "@/app/actions";
import { CORES_RAPIDAS } from "@/lib/data/cor";

export function SeletorCor({ corAtual }: { corAtual: string }) {
  const [cor, setCor] = useState(corAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function escolher(nova: string) {
    setCor(nova);
    setErro(null);
    iniciar(async () => {
      const r = await salvarCorDestaque(nova);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <div>
      <Rotulo>Cor de destaque</Rotulo>
      <p className="mb-3 text-[12.5px] text-gray-500">Usada nos botões principais e nos realces — o resto da interface continua preto e branco.</p>
      <div className="flex flex-wrap items-center gap-2">
        {CORES_RAPIDAS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => escolher(c)}
            aria-label={`Usar ${c}`}
            className={cn("h-8 w-8 rounded-full border-2 transition-transform", cor.toUpperCase() === c ? "scale-110 border-white" : "border-transparent hover:scale-105")}
            style={{ background: c }}
          />
        ))}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-gray-700">
          <input
            type="color"
            value={cor}
            onChange={(e) => escolher(e.target.value)}
            className="absolute inset-0 h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
            aria-label="Escolher outra cor"
          />
        </label>
        {pendente && <span className="text-[11px] text-gray-500">salvando…</span>}
      </div>
      {erro && <p role="alert" className="mt-2 text-[12px] text-white">⚠ {erro}</p>}
    </div>
  );
}
