"use client";

import { useOptimistic, useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, cn } from "@/components/ui/base";
import { excluirDeal, moverDeal, salvarDeal } from "@/app/app/actions";
import type { Deal, Lead, PipelineStage } from "@/lib/data/types";
import { diasDesde, formatBRL, formatData } from "@/lib/data/format";

export function PipelineView({ etapas, deals, leads }: {
  etapas: PipelineStage[];
  deals: Deal[];
  leads: Pick<Lead, "id" | "nome" | "empresa">[];
}) {
  const [otimista, mover] = useOptimistic(deals, (atual, m: { id: string; stage: string }) =>
    atual.map((d) => (d.id === m.id ? { ...d, stage_id: m.stage, etapa_entrada_em: new Date().toISOString() } : d)),
  );
  const [, iniciar] = useTransition();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [editando, setEditando] = useState<Deal | null>(null);
  const [novoEm, setNovoEm] = useState<string | null>(null);
  const [perdendo, setPerdendo] = useState<{ id: string; stage: string; titulo: string } | null>(null);

  function soltar(stage: string, id: string) {
    const d = otimista.find((x) => x.id === id);
    if (!d || d.stage_id === stage) return;
    if (etapas.find((e) => e.id === stage)?.tipo === "perdido") {
      setPerdendo({ id, stage, titulo: d.titulo });
      return;
    }
    iniciar(async () => {
      mover({ id, stage });
      await moverDeal(id, stage);
    });
  }

  function confirmarPerda(motivo: string) {
    if (!perdendo) return;
    const { id, stage } = perdendo;
    setPerdendo(null);
    iniciar(async () => {
      mover({ id, stage });
      await moverDeal(id, stage, motivo);
    });
  }

  const abertos = otimista.filter((d) => etapas.find((e) => e.id === d.stage_id)?.tipo === "aberto");
  const ponderado = abertos.reduce((s, d) => s + d.valor * ((etapas.find((e) => e.id === d.stage_id)?.probabilidade ?? 0) / 100), 0);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6 text-[13px]">
          <div><p className="rotulo">Em aberto</p><p className="mt-1 text-[18px] font-semibold text-white tabular">{formatBRL(abertos.reduce((s, d) => s + d.valor, 0))}</p></div>
          <div><p className="rotulo">Ponderado</p><p className="mt-1 text-[18px] font-semibold text-white tabular">{formatBRL(ponderado)}</p></div>
          <div><p className="rotulo">Negócios</p><p className="mt-1 text-[18px] font-semibold text-white tabular">{abertos.length}</p></div>
        </div>
        <button onClick={() => setNovoEm(etapas[0]?.id ?? null)} disabled={!etapas.length} className="btn btn-primario btn-sm"><Plus size={15} /> Novo negócio</button>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {etapas.map((e) => {
          const lista = otimista.filter((d) => d.stage_id === e.id);
          const total = lista.reduce((s, d) => s + d.valor, 0);
          return (
            <section
              key={e.id}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }}
              onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
              onDrop={(ev) => { ev.preventDefault(); setSobre(null); soltar(e.id, ev.dataTransfer.getData("text/plain")); }}
              className={cn(
                "flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border bg-[#0C0C0C] transition-colors sm:w-[280px]",
                sobre === e.id && arrastando ? "border-white" : "border-gray-800",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
                <div className="min-w-0">
                  <h2 className={cn("truncate text-[13.5px] font-medium", e.tipo === "perdido" ? "text-gray-500" : "text-white")}>{e.nome}</h2>
                  <p className="text-[11.5px] text-gray-500 tabular">{lista.length} · {formatBRL(total)}</p>
                </div>
                <span className="shrink-0 rounded-full border border-gray-800 px-2 py-0.5 font-mono text-[10.5px] text-gray-400">{e.probabilidade}%</span>
              </header>
              <ul className="flex min-h-[120px] flex-1 flex-col gap-2 p-2.5">
                {lista.map((d) => (
                  <li
                    key={d.id}
                    draggable
                    onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", d.id); setArrastando(d.id); }}
                    onDragEnd={() => setArrastando(null)}
                    className={cn("group", arrastando === d.id && "opacity-40")}
                  >
                    <button onClick={() => setEditando(d)} className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      e.tipo === "ganho" ? "border-white bg-white text-black" : "border-gray-800 bg-black hover:border-gray-600",
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-[13.5px] font-medium leading-snug", e.tipo === "ganho" ? "text-black" : "text-white", e.tipo === "perdido" && "text-gray-500 line-through")}>{d.titulo}</p>
                        <GripVertical size={14} className="mt-0.5 hidden shrink-0 cursor-grab text-gray-600 sm:block" />
                      </div>
                      <p className={cn("mt-0.5 truncate text-[12px]", e.tipo === "ganho" ? "text-gray-600" : "text-gray-500")}>{d.empresa}</p>
                      <div className="mt-3 flex items-end justify-between">
                        <span className="text-[14px] font-semibold tabular">{formatBRL(d.valor)}</span>
                        <span className={cn("text-[11px]", e.tipo === "ganho" ? "text-gray-600" : "text-gray-600")}>{diasDesde(d.etapa_entrada_em)}d na etapa</span>
                      </div>
                      {e.tipo === "perdido" && d.motivo_perda && (
                        <p className="mt-1.5 truncate text-[11px] text-gray-600">Motivo: {d.motivo_perda}</p>
                      )}
                    </button>
                    {/* Mobile: mover sem arrastar */}
                    <select
                      value={d.stage_id}
                      onChange={(ev) => soltar(ev.target.value, d.id)}
                      className="campo mt-1 !h-8 !text-[12px] sm:hidden"
                      aria-label={`Mover ${d.titulo}`}
                    >
                      {etapas.map((x) => <option key={x.id} value={x.id}>→ {x.nome}</option>)}
                    </select>
                  </li>
                ))}
                {lista.length === 0 && <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-800 py-6 text-[12px] text-gray-600">Arraste para cá</li>}
              </ul>
              {e.tipo === "aberto" && (
                <button onClick={() => setNovoEm(e.id)} className="m-2.5 mt-0 flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12.5px] text-gray-500 transition-colors hover:bg-gray-900 hover:text-white">
                  <Plus size={13} /> Adicionar
                </button>
              )}
            </section>
          );
        })}
      </div>

      <Dialogo
        aberto={!!editando || !!novoEm}
        aoFechar={() => { setEditando(null); setNovoEm(null); }}
        titulo={editando ? editando.titulo : "Novo negócio"}
        descricao={editando ? `Na etapa desde ${formatData(editando.etapa_entrada_em)}` : undefined}
      >
        <FormDeal
          key={editando?.id ?? novoEm ?? "x"}
          deal={editando}
          etapaInicial={novoEm}
          etapas={etapas}
          leads={leads}
          aoSalvar={() => { setEditando(null); setNovoEm(null); }}
        />
      </Dialogo>

      <Dialogo aberto={!!perdendo} aoFechar={() => setPerdendo(null)} titulo="Motivo da perda" descricao={perdendo?.titulo}>
        <FormMotivoPerda aoConfirmar={confirmarPerda} aoCancelar={() => setPerdendo(null)} />
      </Dialogo>
    </>
  );
}

function FormMotivoPerda({ aoConfirmar, aoCancelar }: { aoConfirmar: (motivo: string) => void; aoCancelar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); aoConfirmar(motivo); }} className="grid gap-4">
      <div>
        <Rotulo htmlFor="motivo_perda">Por que esse negócio foi perdido?</Rotulo>
        <input
          id="motivo_perda"
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="campo"
          placeholder="Ex.: Preço, concorrente, sem orçamento, sem resposta…"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className="btn btn-fantasma btn-sm">Cancelar</button>
        <button className="btn btn-primario btn-sm">Confirmar</button>
      </div>
    </form>
  );
}

function FormDeal({ deal, etapaInicial, etapas, leads, aoSalvar }: {
  deal: Deal | null;
  etapaInicial: string | null;
  etapas: PipelineStage[];
  leads: Pick<Lead, "id" | "nome" | "empresa">[];
  aoSalvar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [empresa, setEmpresa] = useState(deal?.empresa ?? "");
  const [contato, setContato] = useState(deal?.contato ?? "");

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarDeal(deal?.id ?? null, fd);
        if (r.ok) aoSalvar(); else setErro(r.erro);
      })}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Rotulo htmlFor="lead_id">Lead vinculado</Rotulo>
        <select
          id="lead_id"
          name="lead_id"
          defaultValue={deal?.lead_id ?? ""}
          onChange={(e) => {
            const l = leads.find((x) => x.id === e.target.value);
            if (l) { setEmpresa(l.empresa); setContato(l.nome); }
          }}
          className="campo"
        >
          <option value="">— nenhum —</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.empresa}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><Rotulo htmlFor="titulo">Título *</Rotulo><input id="titulo" name="titulo" required defaultValue={deal?.titulo} className="campo" placeholder="Ex.: Licença anual — 20 usuários" /></div>
      <div><Rotulo htmlFor="empresa-d">Empresa *</Rotulo><input id="empresa-d" name="empresa" required value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="campo" /></div>
      <div><Rotulo htmlFor="contato">Contato</Rotulo><input id="contato" name="contato" value={contato} onChange={(e) => setContato(e.target.value)} className="campo" /></div>
      <div><Rotulo htmlFor="valor">Valor (R$)</Rotulo><input id="valor" name="valor" inputMode="decimal" defaultValue={deal ? String(deal.valor).replace(".", ",") : ""} className="campo tabular" placeholder="0" /></div>
      <div>
        <Rotulo htmlFor="stage_id">Etapa</Rotulo>
        <select id="stage_id" name="stage_id" defaultValue={deal?.stage_id ?? etapaInicial ?? etapas[0]?.id} className="campo">
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.probabilidade}%)</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><Rotulo htmlFor="data_fechamento_previsto">Fechamento previsto</Rotulo><input id="data_fechamento_previsto" name="data_fechamento_previsto" type="date" defaultValue={deal?.data_fechamento_previsto ?? ""} className="campo" /></div>
      <div className="sm:col-span-2"><Rotulo htmlFor="notas-d">Notas</Rotulo><textarea id="notas-d" name="notas" rows={3} defaultValue={deal?.notas ?? ""} className="campo" /></div>
      {erro && <p role="alert" className="text-[13px] text-white sm:col-span-2">⚠ {erro}</p>}
      <div className="flex items-center justify-between gap-2 sm:col-span-2">
        {deal ? (
          <button type="button" disabled={pendente} onClick={() => { if (confirm("Excluir este negócio?")) iniciar(async () => { await excluirDeal(deal.id); aoSalvar(); }); }} className="btn btn-fantasma btn-sm"><Trash2 size={14} /> Excluir</button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button>
          <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </form>
  );
}
