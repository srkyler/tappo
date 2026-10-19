"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/components/ui/base";
import { excluirPromocao } from "@/app/marketing/actions";
import { formatData } from "@/lib/data/format";
import type { Promocao } from "@/lib/data/types";

const ROTULO_STATUS: Record<Promocao["status"], string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const COR_STATUS: Record<Promocao["status"], string> = {
  planejada: "text-gray-400 border-gray-700",
  ativa: "text-emerald-400 border-emerald-500/30",
  concluida: "text-gray-500 border-gray-800",
  cancelada: "text-red-400 border-red-500/30",
};
const ROTULO_CANAL: Record<Promocao["canal"], string> = {
  whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", site: "Site", outro: "Outro",
};

export function ListaPromocoes({ promocoes }: { promocoes: Promocao[] }) {
  const [pendente, iniciar] = useTransition();

  const porMes = new Map<string, Promocao[]>();
  for (const p of promocoes) {
    const chave = p.data_inicio.slice(0, 7);
    if (!porMes.has(chave)) porMes.set(chave, []);
    porMes.get(chave)!.push(p);
  }

  return (
    <div className="space-y-5">
      {Array.from(porMes.entries()).map(([mes, lista]) => (
        <div key={mes}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {new Date(`${mes}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <div className="space-y-2">
            {lista.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-900/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium text-white">{p.titulo}</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase", COR_STATUS[p.status])}>{ROTULO_STATUS[p.status]}</span>
                  </div>
                  {p.oferta && <p className="mt-0.5 text-[12.5px] text-amber-400">{p.oferta}</p>}
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {formatData(p.data_inicio)}{p.data_fim ? ` → ${formatData(p.data_fim)}` : ""} · {ROTULO_CANAL[p.canal]}
                  </p>
                  {p.descricao && <p className="mt-1 text-[12px] text-gray-400">{p.descricao}</p>}
                </div>
                <button
                  disabled={pendente}
                  onClick={() => { if (confirm(`Excluir a promoção "${p.titulo}"?`)) iniciar(async () => { await excluirPromocao(p.id); }); }}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Excluir ${p.titulo}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
