"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTagLead } from "@/app/app/tags/actions";

/** Liga/desliga tags do lead com um clique (antes o formulário não tinha como enviar). */
export function TagsLead({ leadId, tags, ativas }: { leadId: string; tags: { id: string; nome: string; cor: string }[]; ativas: string[] }) {
  const [sel, alternar] = useOptimistic(new Set(ativas), (atual, id: string) => {
    const n = new Set(atual);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const [, iniciar] = useTransition();
  if (!tags.length) return <p className="text-[12px] text-gray-500">Nenhuma tag cadastrada. Crie em Tags.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = sel.has(t.id);
        return (
          <button
            key={t.id}
            aria-pressed={on}
            onClick={() => iniciar(async () => { alternar(t.id); await toggleTagLead(leadId, t.id); })}
            className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
            style={{ borderColor: on ? t.cor : "#333", color: on ? t.cor : "#888", background: on ? `${t.cor}1a` : "transparent" }}
          >{on ? "✓ " : ""}{t.nome}</button>
        );
      })}
    </div>
  );
}
