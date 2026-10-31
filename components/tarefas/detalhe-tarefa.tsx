"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import {
  adicionarItemChecklist, buscarLeadsParaTarefa, detalheTarefa, excluirItemChecklist, marcarItemChecklist, vincularLeadTarefa,
  type DetalheTarefa as Detalhe,
} from "@/app/app/tarefas/actions";

/** Checklist e leads da tarefa (abre ao clicar na tarefa). */
export function DetalheTarefa({ tarefaId }: { tarefaId: string }) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [item, setItem] = useState("");
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ id: string; nome: string; empresa: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const recarregar = useCallback(() => detalheTarefa(tarefaId).then(setD).catch(() => setErro("Não consegui carregar.")), [tarefaId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => {
    if (busca.trim().length < 2) return;
    let vivo = true;
    const t = setTimeout(() => { buscarLeadsParaTarefa(busca).then((r) => { if (vivo) setAchados(r); }); }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca]);

  const rodar = (f: () => Promise<{ ok: boolean; erro?: string }>) => iniciar(async () => {
    const r = await f();
    if (!r.ok) setErro(r.erro ?? "Falhou."); else { setErro(null); await recarregar(); }
  });

  if (!d) return <div className="py-3"><Loader2 size={14} className="animate-spin text-gray-500" /></div>;
  const feitos = d.checklist.filter((c) => c.concluido).length;

  return (
    <div className="grid gap-5 py-3 sm:grid-cols-2">
      <div>
        <p className="rotulo mb-2">Checklist {d.checklist.length ? `· ${feitos}/${d.checklist.length}` : ""}</p>
        <ul className="space-y-1">
          {d.checklist.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={c.concluido} disabled={pendente} onChange={(e) => rodar(() => marcarItemChecklist(c.id, e.target.checked))} />
              <span className={c.concluido ? "text-gray-500 line-through" : "text-gray-200"}>{c.titulo}</span>
              <button onClick={() => rodar(() => excluirItemChecklist(c.id))} className="ml-auto text-gray-600 opacity-0 hover:text-white group-hover:opacity-100" aria-label="Excluir item"><X size={12} /></button>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = item; setItem(""); rodar(() => adicionarItemChecklist(tarefaId, t)); }}>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Novo item" className="campo !h-8 !text-[13px]" />
          <button disabled={pendente || !item.trim()} className="btn btn-secundario btn-sm !h-8"><Plus size={13} /></button>
        </form>
      </div>
      <div>
        <p className="rotulo mb-2">Leads desta tarefa</p>
        <ul className="space-y-1">
          {d.leads.map((l) => (
            <li key={l.id} className="group flex items-center gap-2 text-[13px]">
              <Link href={`/app/leads/${l.id}`} className="truncate text-gray-200 hover:text-white">{l.nome} <span className="text-gray-500">· {l.empresa}</span></Link>
              <button onClick={() => rodar(() => vincularLeadTarefa(tarefaId, l.id, false))} className="ml-auto text-gray-600 opacity-0 hover:text-white group-hover:opacity-100" aria-label="Tirar lead"><X size={12} /></button>
            </li>
          ))}
          {!d.leads.length && <li className="text-[12.5px] text-gray-500">Nenhum lead extra.</li>}
        </ul>
        <div className="relative mt-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Adicionar lead (busque pelo nome)" className="campo !h-8 !text-[13px]" />
          {busca.trim().length >= 2 && achados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-800 bg-[#0c0c0c]">
              {achados.filter((a) => !d.leads.some((l) => l.id === a.id)).map((a) => (
                <li key={a.id}>
                  <button onClick={() => { setBusca(""); setAchados([]); rodar(() => vincularLeadTarefa(tarefaId, a.id, true)); }} className="block w-full truncate px-3 py-1.5 text-left text-[13px] text-gray-200 hover:bg-gray-900">
                    {a.nome} <span className="text-gray-500">· {a.empresa}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {erro && <p role="alert" className="text-[12.5px] text-red-400 sm:col-span-2">{erro}</p>}
    </div>
  );
}
