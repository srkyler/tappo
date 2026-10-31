"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlarmClock, Bell, CheckSquare, MessageCircle, UserRoundCheck } from "lucide-react";
import { minhasPendencias } from "@/app/app/notificacoes/actions";
import type { Pendencia } from "@/lib/notificacoes-tipos";

const ICONE = { mensagem: MessageCircle, transferida: UserRoundCheck, tarefa: CheckSquare, sla: AlarmClock } as const;

/** Sino do topo: o que precisa de você agora. Atualiza a cada minuto com a aba visível. */
export function Sino({ compacto }: { compacto?: boolean }) {
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const atualizar = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    minhasPendencias().then(setItens).catch(() => { /* sem rede: tenta no próximo minuto */ });
  }, []);

  useEffect(() => {
    atualizar();
    const t = setInterval(atualizar, 60_000);
    document.addEventListener("visibilitychange", atualizar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", atualizar); };
  }, [atualizar]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const urgentes = itens.filter((i) => i.urgente).length;
  return (
    <div ref={caixa} className="relative">
      <button
        onClick={() => { setAberto((v) => !v); if (!aberto) atualizar(); }}
        aria-label={`Notificações${itens.length ? ` (${itens.length})` : ""}`}
        aria-expanded={aberto}
        className="relative rounded-full p-2 text-gray-300 hover:bg-gray-900 hover:text-white"
      >
        <Bell size={compacto ? 18 : 16} />
        {itens.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-semibold leading-[1.1rem] ${urgentes ? "bg-red-500 text-white" : "bg-white text-gray-900"}`}>
            {itens.length > 9 ? "9+" : itens.length}
          </span>
        )}
      </button>
      {aberto && (
        <div className={`absolute z-50 mt-2 w-[20rem] max-w-[90vw] overflow-hidden rounded-xl border border-gray-800 bg-[#0b0b0b] shadow-2xl ${compacto ? "right-0" : "left-0"}`}>
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
            <p className="text-[13px] font-medium text-white">Para você agora</p>
            <Link href="/app/notificacoes" onClick={() => setAberto(false)} className="text-[12px] text-gray-400 hover:text-white">Ver tudo</Link>
          </div>
          {itens.length ? (
            <ul className="max-h-[22rem] divide-y divide-gray-800/70 overflow-y-auto">
              {itens.slice(0, 12).map((i) => {
                const Icone = ICONE[i.tipo];
                return (
                  <li key={i.id}>
                    <Link href={i.href} onClick={() => setAberto(false)} className="flex gap-3 px-4 py-2.5 hover:bg-gray-900">
                      <Icone size={15} className={`mt-0.5 shrink-0 ${i.urgente ? "text-red-400" : "text-gray-500"}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-white">{i.titulo}</span>
                        <span className={`block truncate text-[12px] ${i.urgente ? "text-red-300" : "text-gray-500"}`}>{i.detalhe}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-4 py-6 text-center text-[13px] text-gray-500">Nada pendente. 🎉</p>}
        </div>
      )}
    </div>
  );
}
