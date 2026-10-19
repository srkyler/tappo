"use client";

import { useState, useTransition } from "react";
import { Phone, Activity, Mail, Video, MapPin, CheckCircle, Clock, Plus, type LucideIcon } from "lucide-react";
import { criarTarefa, concluirTarefa, listarTarefas } from "@/app/tarefas/actions";
import type { Tarefa } from "@/lib/data/types";

const TAREFA_TIPOS: { id: string; rotulo: string; icone: LucideIcon }[] = [
  { id: "ligacao", rotulo: "Ligação", icone: Phone },
  { id: "whatsapp", rotulo: "WhatsApp", icone: Activity },
  { id: "email", rotulo: "E-mail", icone: Mail },
  { id: "reuniao", rotulo: "Reunião", icone: Video },
  { id: "visita", rotulo: "Visita", icone: MapPin },
  { id: "outro", rotulo: "Outro", icone: Activity },
];

const PRIORIDADES: { id: string; rotulo: string }[] = [
  { id: "alta", rotulo: "Alta" },
  { id: "media", rotulo: "Média" },
  { id: "baixa", rotulo: "Baixa" },
];

type EmpresaRes = { id: string; nome: string } | null;

export function TarefasView({ inicial }: { inicial: { tarefas: Tarefa[]; empresa: EmpresaRes } | null }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(inicial?.tarefas ?? []);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const pendentes = tarefas.filter((t) => !t.concluida_em);
  const concluidas = tarefas.filter((t) => t.concluida_em);
  const atrasadas = pendentes.filter((t) => t.vence_em && new Date(t.vence_em) < new Date() && !t.concluida_em);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    iniciar(async () => {
      const res = await criarTarefa(fd);
      if (res.ok) {
        (e.currentTarget as HTMLFormElement).reset();
        setMsg({ ok: true, t: "Tarefa criada." });
        const atual = await listarTarefas();
        setTarefas(atual.tarefas);
      } else {
        setMsg({ ok: false, t: res.erro });
      }
    });
  }

  async function toggle(id: string, atual: boolean) {
    iniciar(async () => {
      const res = await concluirTarefa(id, !atual);
      if (res.ok) {
        setTarefas((l) => l.map((t) => (t.id === id ? { ...t, concluida_em: !atual ? new Date().toISOString() : null } : t)));
      } else {
        setMsg({ ok: false, t: res.erro });
      }
    });
  }

  const IconeTipo = (tipo: string) => {
    const T = TAREFA_TIPOS.find((x) => x.id === tipo);
    return T ? T.icone : Activity;
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`rounded-lg border px-3 py-2 text-[13px] ${msg.ok ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>{msg.t}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Pendentes</p>
          <p className="text-[30px] font-bold text-white">{pendentes.length}</p>
        </div>
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Concluídas</p>
          <p className="text-[30px] font-bold text-white">{concluidas.length}</p>
        </div>
        <div className="painel p-5 border-amber-500/30">
          <p className="text-[11px] uppercase tracking-wide text-amber-400 mb-1">Atrasadas</p>
          <p className="text-[30px] font-bold text-red-400">{atrasadas.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <h2 className="text-[14px] font-medium text-white">Tarefas pendentes ({pendentes.length})</h2>

          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-[11px] uppercase text-gray-500">
                  <th className="pb-3 font-medium">Tarefa</th>
                  <th className="pb-3 font-medium text-right w-24">Vence</th>
                  <th className="pb-3 font-medium text-right w-16">Prioridade</th>
                  <th className="pb-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pendentes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-gray-500">Tudo em dia. Nenhuma tarefa pendente.</td>
                  </tr>
                ) : (
                  pendentes.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-900/30">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          {(() => { const Comp = IconeTipo(t.tipo); return <Comp size={14} className="text-gray-500 shrink-0" />; })()}
                          <span className="truncate text-[13px] font-medium text-white">{t.titulo}</span>
                          {t.descricao && <span className="text-[11px] text-gray-500 ml-auto hidden sm:block">· {t.descricao}</span>}
                        </div>
                      </td>
                      <td className="py-3 text-right text-[12px]">
                        {t.vence_em ? (
                          <div className={`text-[12px] font-medium ${new Date(t.vence_em) < new Date() ? "text-red-400" : "text-white"}`}>{new Date(t.vence_em).toLocaleDateString("pt-BR")}</div>
                        ) : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px] uppercase ${t.prioridade === "alta" ? "border-red-500 text-red-400" : t.prioridade === "media" ? "border-white text-white" : "border-gray-500 text-gray-500"}`}>{t.prioridade}</span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => toggle(t.id, false)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white" aria-label="Concluir tarefa">
                          <CheckCircle size={14} strokeWidth={0} fill="currentColor" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {atrasadas.length > 0 && (
            <div className="painel p-4 border-amber-500/30">
              <h3 className="text-[12px] font-medium text-amber-400 mb-2 flex items-center gap-1"><Clock size={13} className="shrink-0" /> {atrasadas.length} atrasada{atrasadas.length > 1 ? "s" : ""}</h3>
              <ul className="space-y-1 text-[12px]">
                {atrasadas.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-gray-300">{t.titulo}</span>
                    <span className="text-amber-400 text-[11px]">{new Date(t.vence_em!).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="painel p-4">
            <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova tarefa</h3>
            <form onSubmit={criar} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
                <input name="titulo" required placeholder="Ex.: Ligar para o cliente X" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Descrição</label>
                <textarea name="descricao" rows={2} placeholder="Detalhes da tarefa…" className="campo w-full" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tipo</label>
                  <select name="tipo" className="campo w-full" defaultValue="outro">
                    {TAREFA_TIPOS.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Prioridade</label>
                  <select name="prioridade" className="campo w-full" defaultValue="media">
                    {PRIORIDADES.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Vence em</label>
                  <input name="vence_em" type="date" defaultValue={hoje} className="campo w-full" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Responsável</label>
                  <select name="responsavel_id" className="campo w-full" defaultValue="">
                    <option value="">Eu mesmo</option>
                  </select>
                </div>
              </div>
              <button disabled={pendente} className="btn btn-primario w-full">
                {pendente && <Plus size={14} className="animate-spin mr-2" />}
                Criar tarefa
              </button>
            </form>
          </div>

          <div className="painel p-4">
            <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Concluídas recentemente</h3>
            {concluidas.slice(0, 6).length === 0 ? (
              <p className="text-[12px] text-gray-500">Nenhuma tarefa concluída ainda.</p>
            ) : (
              <ul className="space-y-1">
                {concluidas.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-900/30">
                    <span className="flex items-center gap-2 text-[12px] text-gray-400">
                      <CheckCircle size={12} fill="currentColor" /> {t.titulo}
                    </span>
                    <button onClick={() => toggle(t.id, true)} className="rounded-md p-1 text-gray-500 hover:bg-gray-800 hover:text-white" aria-label="Desfazer">Desfazer</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
