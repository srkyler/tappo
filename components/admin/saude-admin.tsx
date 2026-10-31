import { Activity } from "lucide-react";
import { cn } from "@/components/ui/base";
import type { ItemSaude } from "@/lib/saude";

const COR = { ok: "bg-emerald-400", aviso: "bg-amber-400", falha: "bg-red-500" };

/** Painel de saúde do /admin: o que está fora do ar ou faltando configurar. */
export function SaudeAdmin({ itens }: { itens: ItemSaude[] }) {
  const falhas = itens.filter((i) => i.estado === "falha").length;
  return (
    <section className="painel p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Activity size={15} /> Saúde do sistema
        <span className={cn("rounded-full px-2 text-[11px]", falhas ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300")}>
          {falhas ? `${falhas} problema(s)` : "tudo certo"}
        </span>
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-start gap-2.5 rounded-lg border border-gray-800 px-3 py-2.5">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COR[i.estado])} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white">{i.nome}</p>
              <p className="break-words text-[12px] text-gray-500">{i.detalhe}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
