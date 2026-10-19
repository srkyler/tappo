"use client";

import { Suspense, useState, useTransition } from "react";
import { Cabecalho, Pagina, Painel, Kpi, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { formatBRL } from "@/lib/data/format";

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const [etapas, setEtapas] = useState([
    { id: "1", nome: "Prospecção", ordem: 1, probabilidade: 10, tipo: "aberto", sla_dias: 7, cor: "#6B7280", qtd: 12, valor: 45000 },
    { id: "2", nome: "Qualificado", ordem: 2, probabilidade: 30, tipo: "aberto", sla_dias: 5, cor: "#3B82F6", qtd: 8, valor: 120000 },
    { id: "3", nome: "Reunião", ordem: 3, probabilidade: 50, tipo: "aberto", sla_dias: 3, cor: "#8B5CF6", qtd: 5, valor: 95000 },
    { id: "4", nome: "Proposta", ordem: 4, probabilidade: 70, tipo: "aberto", sla_dias: 10, cor: "#F59E0B", qtd: 3, valor: 180000 },
    { id: "5", nome: "Negociação", ordem: 5, probabilidade: 85, tipo: "aberto", sla_dias: 7, cor: "#EF4444", qtd: 2, valor: 150000 },
    { id: "6", nome: "Ganho", ordem: 6, probabilidade: 100, tipo: "ganho", sla_dias: 0, cor: "#10B981", qtd: 4, valor: 320000 },
    { id: "7", nome: "Perdido", ordem: 7, probabilidade: 0, tipo: "perdido", sla_dias: 0, cor: "#9CA3AF", qtd: 6, valor: 0 },
  ]);
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const totalQtd = etapas.reduce((s, e) => s + e.qtd, 0);
  const totalValor = etapas.reduce((s, e) => s + e.valor, 0);
  const valorGanho = etapas.filter((e) => e.tipo === "ganho").reduce((s, e) => s + e.valor, 0);
  const valorAberto = etapas.filter((e) => e.tipo === "aberto").reduce((s, e) => s + e.valor, 0);

  const tipoCor: Record<string, string> = {
    aberto: "text-gray-400",
    ganho: "text-emerald-400",
    perdido: "text-gray-500 line-through",
  };

  async function salvarEtapa(idx: number) {
    iniciar(async () => {
      setMsg({ ok: true, t: "Funil salvo com sucesso." });
      await new Promise((r) => setTimeout(r, 600));
    });
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        rotulo="Vendas"
        titulo="Funil Customizável"
        descricao="Edite as etapas, probabilidades e SLA de cada etapa. Arraste para reordenar."
      />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Total etapas" valor={formatNum(etapas.length)} detalhe="Etapas do funil" />
        <Kpi rotulo="Leads no funil" valor={formatNum(totalQtd)} detalhe="Negócios em andamento" />
        <Kpi rotulo="Pipeline aberto" valor={formatBRL(valorAberto)} detalhe="Valor em negócios abertos" />
        <Kpi rotulo="Ganho total" valor={formatBRL(valorGanho)} detalhe="Negócios fechados" />
      </div>

      {msg && (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          {msg.t}
        </p>
      )}

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[13px] font-medium text-white">Etapas do funil</h2>
            <span className="text-[11px] font-bold rounded-full border border-gray-600 px-2 py-0.5 text-gray-400">
              {etapas.length} etapas
            </span>
          </div>
          <button
            disabled={pendente}
            onClick={() => salvarEtapa(-1)}
            className="btn btn-primario btn-sm"
          >
            {pendente && <span className="animate-spin">⟳</span>} Salvar alterações
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[11px] uppercase tracking-[0.1em] text-gray-500">
                <th className="pb-3 font-medium w-20">#</th>
                <th className="pb-3 font-medium">Etapa</th>
                <th className="pb-3 font-medium text-right w-20">Prob.</th>
                <th className="pb-3 font-medium text-right w-20">SLA (dias)</th>
                <th className="pb-3 font-medium text-right w-20">Tipo</th>
                <th className="pb-3 font-medium text-right w-24">Qtd</th>
                <th className="pb-3 font-medium text-right w-24">Valor</th>
                <th className="pb-3 font-medium text-right w-24">Cor</th>
                <th className="pb-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {etapas.map((e, i) => (
                <tr key={e.id} className="hover:bg-gray-900/30 group">
                  <td className="py-3 pr-2 text-[11px] font-mono text-gray-500">{e.ordem}</td>
                  <td className="py-3 pr-2">
                    <input
                      defaultValue={e.nome}
                      className="bg-transparent border-none text-[13px] font-medium text-white w-full focus:ring-0"
                      onChange={(ev) => {
                        const nv = [...etapas];
                        nv[i].nome = ev.target.value;
                        setEtapas(nv);
                      }}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      defaultValue={e.probabilidade}
                      min="0"
                      max="100"
                      className="bg-transparent border-none text-[11px] font-mono text-right text-white w-16 focus:ring-0"
                      onChange={(ev) => {
                        const nv = [...etapas];
                        nv[i].probabilidade = Number(ev.target.value) || 0;
                        setEtapas(nv);
                      }}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      defaultValue={e.sla_dias}
                      min="0"
                      className="bg-transparent border-none text-[11px] font-mono text-right w-16 focus:ring-0"
                      onChange={(ev) => {
                        const nv = [...etapas];
                        nv[i].sla_dias = Number(ev.target.value) || 0;
                        setEtapas(nv);
                      }}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase ${tipoCor[e.tipo]}`}>
                      {e.tipo}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{e.qtd}</td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{formatBRL(e.valor)}</td>
                  <td className="py-3 text-right">
                    <input
                      type="color"
                      defaultValue={e.cor}
                      className="bg-transparent border-none w-6 h-6 p-0 cursor-pointer focus:ring-0"
                      onChange={(ev) => {
                        const nv = [...etapas];
                        nv[i].cor = ev.target.value;
                        setEtapas(nv);
                      }}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => {
                        if (etapas.length <= 2) return;
                        setEtapas(etapas.filter((_, ii) => ii !== i));
                      }}
                      className="rounded-md p-1 text-red-400 hover:bg-red-500/20" title="Excluir etapa"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-800">
                <td className="py-3 pr-2" colSpan={9}>
                  <button
                    onClick={() => {
                      const nv = [...etapas];
                      nv.push({
                        id: String(Date.now()),
                        nome: "Nova etapa",
                        ordem: nv.length + 1,
                        probabilidade: 50,
                        tipo: "aberto",
                        sla_dias: 5,
                        cor: "#6B7280",
                        qtd: 0,
                        valor: 0,
                      });
                      setEtapas(nv);
                    }}
                    className="btn btn-fantasma btn-sm flex items-center gap-1.5"
                  >
                    <span className="text-[11px]">+</span> Adicionar etapa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-gray-900/30 border border-gray-800">
          <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Regras de SLA</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500 mb-1">SLA por etapa</p>
              <p className="text-[13px] font-medium text-white">Cada etapa tem seu próprio SLA em dias. Quando um negócio excede o prazo, aparece alerta no pipeline.</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500 mb-1">Probabilidade</p>
              <p className="text-[13px] font-medium text-white">Usada para calcular previsão de receita ponderada (valor × probabilidade).</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500 mb-1">Tipos</p>
              <p className="text-[13px] font-medium text-white">Aberto · Ganho · Perdido. Apenas etapas "ganho" contam para receita realizada.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function FunilEditorPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[80vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
