"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Rotulo, cn } from "@/components/ui/base";
import { alternarAutomacao, excluirAutomacao, salvarAutomacao } from "@/app/app/automacoes/actions";
import type { Automacao, GatilhoAutomacao, AcaoAutomacao, PipelineStage, LeadTag } from "@/lib/data/types";

const GATILHO_ROTULO: Record<GatilhoAutomacao, string> = {
  lead_mudou_status: "Lead mudou de status",
  lead_entrou_campanha: "Lead entrou em campanha",
  deal_mudou_etapa: "Negócio mudou de etapa",
  tag_adicionada: "Lead recebeu uma tag",
};
const ACAO_ROTULO: Record<AcaoAutomacao, string> = {
  mover_etapa: "Mover negócio para etapa",
  adicionar_tag: "Adicionar tag ao lead",
  atribuir_responsavel: "Criar tarefa para responsável",
  criar_tarefa: "Criar tarefa",
};

type Campanha = { id: string; nome: string };
type Membro = { user_id: string; nome: string };

export function AutomacoesView({ automacoes, etapas, tags, campanhas, membros }: {
  automacoes: Automacao[];
  etapas: PipelineStage[];
  tags: LeadTag[];
  campanhas: Campanha[];
  membros: Membro[];
}) {
  const [gatilho, setGatilho] = useState<GatilhoAutomacao>("lead_mudou_status");
  const [acao, setAcao] = useState<AcaoAutomacao>("adicionar_tag");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function campoValorGatilho() {
    if (gatilho === "deal_mudou_etapa") return (
      <select name="gatilho_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha a etapa…</option>
        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
    );
    if (gatilho === "tag_adicionada") return (
      <select name="gatilho_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha a tag…</option>
        {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
    );
    if (gatilho === "lead_entrou_campanha") return (
      <select name="gatilho_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha a campanha…</option>
        {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    );
    return <input name="gatilho_valor" className="campo" placeholder="Ex.: Qualificado (vazio = qualquer status)" />;
  }

  function campoValorAcao() {
    if (acao === "mover_etapa") return (
      <select name="acao_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha a etapa destino…</option>
        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
    );
    if (acao === "adicionar_tag") return (
      <select name="acao_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha a tag…</option>
        {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
    );
    if (acao === "atribuir_responsavel") return (
      <select name="acao_valor" className="campo" required defaultValue="">
        <option value="" disabled>Escolha o responsável…</option>
        {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
      </select>
    );
    return <input name="acao_valor" className="campo" placeholder="Título da tarefa" required />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Automações ({automacoes.length})</h2>
        </div>
        <div className="divide-y divide-gray-900">
          {automacoes.length === 0 ? (
            <p className="px-5 py-4 text-[12px] text-gray-500">Nenhuma automação ainda. Toda automação nasce pausada — crie e ative quando revisar.</p>
          ) : automacoes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <button
                onClick={() => iniciar(async () => { await alternarAutomacao(a.id, !a.ativo); })}
                disabled={pendente}
                className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", a.ativo ? "bg-green-500/15 text-green-400" : "bg-gray-800 text-gray-400")}
                title={a.ativo ? "Clique para pausar" : "Clique para ativar"}
              >
                {a.ativo ? "Ativa" : "Pausada"}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{a.nome}</p>
                <p className="truncate text-[11.5px] text-gray-500">
                  {GATILHO_ROTULO[a.gatilho] ?? a.gatilho} → {ACAO_ROTULO[a.acao] ?? a.acao} · {a.execucoes} execuções
                </p>
              </div>
              <button
                onClick={() => { if (confirm("Excluir esta automação?")) iniciar(async () => { await excluirAutomacao(a.id); }); }}
                className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                aria-label="Excluir automação"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="painel p-5">
        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-gray-400">Nova automação</h3>
        <form
          action={(fd) => iniciar(async () => {
            const r = await salvarAutomacao(fd);
            setErro(r.ok ? null : r.erro);
          })}
          className="space-y-3"
        >
          <div><Rotulo htmlFor="nome-auto">Nome</Rotulo><input id="nome-auto" name="nome" required className="campo" placeholder="Ex.: Qualificado → tag VIP" /></div>
          <div>
            <Rotulo htmlFor="gatilho">Quando</Rotulo>
            <select id="gatilho" name="gatilho" value={gatilho} onChange={(e) => setGatilho(e.target.value as GatilhoAutomacao)} className="campo">
              {Object.entries(GATILHO_ROTULO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><Rotulo htmlFor="gatilho_valor">Condição</Rotulo>{campoValorGatilho()}</div>
          <div>
            <Rotulo htmlFor="acao">Então</Rotulo>
            <select id="acao" name="acao" value={acao} onChange={(e) => setAcao(e.target.value as AcaoAutomacao)} className="campo">
              {Object.entries(ACAO_ROTULO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><Rotulo htmlFor="acao_valor">Detalhe da ação</Rotulo>{campoValorAcao()}</div>
          {erro && <p role="alert" className="text-[13px] text-red-400">⚠ {erro}</p>}
          <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Criar automação"}</button>
        </form>
      </section>
    </div>
  );
}
