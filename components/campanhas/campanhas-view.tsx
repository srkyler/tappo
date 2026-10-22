"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronRight, Pause, Play, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Barra, Rotulo, Status, Vazio, cn } from "@/components/ui/base";
import {
  adicionarLeadsCampanha, avancarEtapa, excluirCampanha, mudarStatusCampanha,
  mudarStatusLeadCampanha, salvarCampanha, type PassoInput,
} from "@/app/app/actions";
import { CAMPAIGN_STATUS, CANAL, type CampaignStatus, type Canal, type Lead } from "@/lib/data/types";
import type { CampanhaCompleta } from "@/lib/data/queries";
import { formatData } from "@/lib/data/format";

const PASSOS_PADRAO: PassoInput[] = [
  { dia: 0, canal: "E-mail", acao: "E-mail de apresentação" },
  { dia: 2, canal: "LinkedIn", acao: "Pedido de conexão com nota curta" },
  { dia: 5, canal: "Telefone", acao: "Ligação de qualificação" },
  { dia: 9, canal: "E-mail", acao: "Follow-up com caso de uso" },
];

export function CampanhasView({ campanhas, leads }: { campanhas: CampanhaCompleta[]; leads: Pick<Lead, "id" | "nome" | "empresa" | "status">[] }) {
  const [editando, setEditando] = useState<CampanhaCompleta | "nova" | null>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const aberta = campanhas.find((c) => c.id === abertaId) ?? null;

  return (
    <>
      <div className="mb-5 flex justify-end">
        <button onClick={() => setEditando("nova")} className="btn btn-primario btn-sm"><Plus size={15} /> Nova campanha</button>
      </div>

      {campanhas.length === 0 ? (
        <div className="painel">
          <Vazio icone={<Send size={18} />} titulo="Nenhuma campanha ainda" texto="Monte uma cadência multicanal (e-mail, LinkedIn, telefone, WhatsApp) e adicione leads para o Tappo dizer quem tocar a cada dia." acao={<button onClick={() => setEditando("nova")} className="btn btn-primario btn-sm"><Plus size={15} /> Criar primeira campanha</button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((c) => {
            const total = c.leads.length * Math.max(1, c.passos.length);
            const feitas = c.leads.reduce((s, l) => s + l.etapas_concluidas, 0);
            const respostas = c.leads.filter((l) => l.status === "Respondeu" || l.status === "Reunião").length;
            return (
              <button key={c.id} onClick={() => setAbertaId(c.id)} className="painel group flex flex-col p-5 text-left transition-colors hover:border-gray-600">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-[16px] font-medium leading-snug text-white">{c.nome}</h3>
                  <Status valor={c.status} />
                </div>
                {c.descricao && <p className="mb-4 line-clamp-2 text-[13px] text-gray-500">{c.descricao}</p>}
                <div className="mt-auto">
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                    {[["Leads", c.leads.length], ["Etapas", c.passos.length], ["Respostas", respostas]].map(([r, v]) => (
                      <div key={r} className="rounded-lg bg-gray-900 py-2">
                        <p className="text-[17px] font-semibold text-white tabular">{v}</p>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-gray-500">{r}</p>
                      </div>
                    ))}
                  </div>
                  <Barra valor={feitas} max={total} />
                  <p className="mt-2 flex items-center justify-between text-[12px] text-gray-500">
                    <span>{total ? Math.round((feitas / total) * 100) : 0}% executado</span>
                    <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialogo aberto={editando !== null} aoFechar={() => setEditando(null)} titulo={editando === "nova" ? "Nova campanha" : "Editar campanha"} largura={600}>
        {editando !== null && <FormCampanha key={editando === "nova" ? "nova" : editando.id} campanha={editando === "nova" ? null : editando} aoSalvar={() => setEditando(null)} />}
      </Dialogo>

      <Dialogo aberto={!!aberta} aoFechar={() => setAbertaId(null)} titulo={aberta?.nome ?? ""} descricao={aberta?.iniciada_em ? `Ativada em ${formatData(aberta.iniciada_em)}` : aberta?.status} largura={640}>
        {aberta && <DetalheCampanha c={aberta} leads={leads} aoEditar={() => { setEditando(aberta); setAbertaId(null); }} aoExcluir={() => setAbertaId(null)} />}
      </Dialogo>
    </>
  );
}

function FormCampanha({ campanha, aoSalvar }: { campanha: CampanhaCompleta | null; aoSalvar: () => void }) {
  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [descricao, setDescricao] = useState(campanha?.descricao ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campanha?.status ?? "Rascunho");
  const [passos, setPassos] = useState<PassoInput[]>(campanha?.passos.length ? campanha.passos.map(({ dia, canal, acao }) => ({ dia, canal, acao })) : PASSOS_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const muda = (i: number, p: Partial<PassoInput>) => setPassos((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await salvarCampanha(campanha?.id ?? null, { nome, descricao: descricao.trim() || null, status, passos });
          if (r.ok) aoSalvar(); else setErro(r.erro);
        });
      }}
      className="space-y-4"
    >
      <div><Rotulo htmlFor="c-nome">Nome *</Rotulo><input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="campo" placeholder="Ex.: Indústrias Sul — Q4" autoFocus /></div>
      <div><Rotulo htmlFor="c-desc">Descrição</Rotulo><textarea id="c-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="campo" placeholder="Público, oferta, objetivo…" /></div>
      <div>
        <Rotulo htmlFor="c-status">Status</Rotulo>
        <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className="campo">{CAMPAIGN_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-gray-300">Cadência</span>
          <button type="button" onClick={() => setPassos((p) => [...p, { dia: (p.at(-1)?.dia ?? 0) + 3, canal: "E-mail", acao: "" }])} className="btn btn-fantasma btn-sm !h-7"><Plus size={13} /> Etapa</button>
        </div>
        <ol className="space-y-2">
          {passos.map((p, i) => (
            <li key={i} className="grid grid-cols-[28px_64px_1fr_28px] items-center gap-2 sm:grid-cols-[28px_72px_130px_1fr_28px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-700 font-mono text-[11px] text-gray-400">{i + 1}</span>
              <label className="relative">
                <span className="sr-only">Dia</span>
                <input type="number" min={0} value={p.dia} onChange={(e) => muda(i, { dia: Number(e.target.value) })} className="campo !pr-1 text-center" aria-label={`Dia da etapa ${i + 1}`} />
              </label>
              <select value={p.canal} onChange={(e) => muda(i, { canal: e.target.value as Canal })} className="campo col-span-2 sm:col-span-1" aria-label={`Canal da etapa ${i + 1}`}>{CANAL.map((c) => <option key={c}>{c}</option>)}</select>
              <input value={p.acao} onChange={(e) => muda(i, { acao: e.target.value })} className="campo col-span-3 sm:col-span-1" placeholder="O que fazer" aria-label={`Ação da etapa ${i + 1}`} />
              <button type="button" onClick={() => setPassos((ps) => ps.filter((_, j) => j !== i))} aria-label="Remover etapa" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-800 hover:text-white"><X size={14} /></button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11.5px] text-gray-600">“Dia” = dias após a entrada do lead na campanha.</p>
      </div>

      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button>
        <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Salvando…" : "Salvar campanha"}</button>
      </div>
    </form>
  );
}

function DetalheCampanha({ c, leads, aoEditar, aoExcluir }: {
  c: CampanhaCompleta;
  leads: Pick<Lead, "id" | "nome" | "empresa" | "status">[];
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [adicionando, setAdicionando] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const naCampanha = useMemo(() => new Set(c.leads.map((l) => l.lead_id)), [c.leads]);
  const disponiveis = leads.filter((l) => !naCampanha.has(l.id) && l.status !== "Perdido" && `${l.nome} ${l.empresa}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {c.status === "Ativa" ? (
          <button disabled={pendente} onClick={() => iniciar(async () => { await mudarStatusCampanha(c.id, "Pausada"); })} className="btn btn-secundario btn-sm"><Pause size={14} /> Pausar</button>
        ) : (
          <button disabled={pendente} onClick={() => iniciar(async () => { await mudarStatusCampanha(c.id, "Ativa"); })} className="btn btn-primario btn-sm"><Play size={14} /> Ativar</button>
        )}
        <button onClick={aoEditar} className="btn btn-secundario btn-sm">Editar cadência</button>
        <button disabled={pendente} onClick={() => { if (confirm("Excluir esta campanha?")) iniciar(async () => { await excluirCampanha(c.id); aoExcluir(); }); }} className="btn btn-fantasma btn-sm"><Trash2 size={14} /> Excluir</button>
      </div>

      <section>
        <p className="rotulo mb-3">Cadência</p>
        {c.passos.length === 0 ? <p className="text-[13px] text-gray-500">Sem etapas.</p> : (
          <ol className="space-y-0">
            {c.passos.map((p, i) => (
              <li key={p.id} className="relative flex gap-3 pb-3 pl-1">
                {i < c.passos.length - 1 && <span className="absolute left-[14px] top-7 h-[calc(100%-20px)] w-px bg-gray-800" />}
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-black font-mono text-[11px] text-gray-300">{i + 1}</span>
                <div className="pt-0.5">
                  <p className="text-[13.5px] text-white">{p.acao}</p>
                  <p className="text-[11.5px] text-gray-500">Dia {p.dia} · {p.canal}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="rotulo">Leads na campanha · {c.leads.length}</p>
          <button onClick={() => setAdicionando((v) => !v)} className="btn btn-fantasma btn-sm !h-7"><UserPlus size={14} /> Adicionar</button>
        </div>

        {adicionando && (
          <div className="mb-4 rounded-xl border border-gray-800 p-3">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar leads…" className="campo mb-2" />
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {disponiveis.length === 0 && <li className="px-2 py-3 text-[13px] text-gray-500">Nenhum lead disponível.</li>}
              {disponiveis.map((l) => (
                <li key={l.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-900">
                    <input type="checkbox" checked={sel.includes(l.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id))} className="h-4 w-4 accent-white" />
                    <span className="min-w-0 truncate text-[13px] text-white">{l.nome} <span className="text-gray-500">· {l.empresa}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              disabled={pendente || sel.length === 0}
              onClick={() => iniciar(async () => { await adicionarLeadsCampanha(c.id, sel); setSel([]); setAdicionando(false); })}
              className="btn btn-primario btn-sm mt-3 w-full"
            >
              Adicionar {sel.length || ""} lead{sel.length === 1 ? "" : "s"}
            </button>
          </div>
        )}

        {c.leads.length === 0 ? <p className="text-[13px] text-gray-500">Nenhum lead ainda.</p> : (
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
            {c.leads.map((cl) => {
              const fim = cl.etapas_concluidas >= c.passos.length;
              const prox = c.passos[cl.etapas_concluidas];
              return (
                <li key={cl.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-white">{cl.lead?.nome ?? "Lead removido"}</p>
                    <p className="truncate text-[12px] text-gray-500">
                      {fim ? "Cadência concluída" : `Próx.: ${prox?.acao ?? "—"}${cl.proximo_passo_em ? ` · ${formatData(cl.proximo_passo_em)}` : ""}`}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      {c.passos.map((_, i) => <span key={i} className={cn("h-1 w-5 rounded-full", i < cl.etapas_concluidas ? "bg-white" : "bg-gray-800")} />)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      value={cl.status}
                      disabled={pendente}
                      onChange={(e) => iniciar(async () => { await mudarStatusLeadCampanha(cl.id, e.target.value); })}
                      className="campo !h-8 !w-auto !text-[12px]"
                      aria-label="Status na campanha"
                    >
                      {["Ativo", "Respondeu", "Reunião", "Concluído", "Removido"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    {!fim && cl.status === "Ativo" && (
                      <button disabled={pendente} onClick={() => iniciar(async () => { await avancarEtapa(cl.id); })} className="btn btn-primario btn-sm !h-8" title="Marcar etapa como feita">
                        <Check size={14} /> Feito
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
