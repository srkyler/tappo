import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Kpi } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerAtendimentoAtendente } from "@/lib/data/crm";
import { formatBRL, formatNum } from "@/lib/data/format";

export const metadata = { title: "Atendimento por Atendente — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const atendimento = await lerAtendimentoAtendente();

  const totalAbertas = atendimento.reduce((s, a) => s + a.conversas_abertas, 0);
  const totalResolvidas = atendimento.reduce((s, a) => s + a.conversas_resolvidas_mes, 0);
  const tempos = atendimento.filter((a) => a.tempo_medio_resposta_seg !== null).map((a) => a.tempo_medio_resposta_seg!);
  const tempoMedioGeral = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Gestão" titulo="Atendimento por Atendente" descricao="Métricas de atendimento da equipe: conversas abertas, resolvidas e tempo médio de resposta." />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Conversas Abertas" valor={formatNum(totalAbertas)} detalhe="Aguardando atendimento" />
        <Kpi rotulo="Resolvidas no Mês" valor={formatNum(totalResolvidas)} detalhe="Conversas fechadas" />
        <Kpi rotulo="Tempo Médio Resp." valor={tempoMedioGeral !== null ? `${Math.round(tempoMedioGeral / 60)} min` : "—"} detalhe="Média da equipe" />
        <Kpi rotulo="Atendentes" valor={formatNum(atendimento.length)} detalhe="Na equipe" />
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Detalhe por Atendente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[11px] uppercase tracking-[0.1em] text-gray-500">
                <th className="pb-3 font-medium">Atendente</th>
                <th className="pb-3 font-medium text-right w-20">Papel</th>
                <th className="pb-3 font-medium text-right w-20">Status</th>
                <th className="pb-3 font-medium text-right w-20">Abertas</th>
                <th className="pb-3 font-medium text-right w-20">Resolvidas Mês</th>
                <th className="pb-3 font-medium text-right w-20">Tempo Médio Resp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {atendimento.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center text-gray-500">Nenhum atendente com dados.</td>
                </tr>
              ) : (
                atendimento.map((a) => (
                  <tr key={a.user_id} className="hover:bg-gray-900/30">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[11px] font-bold text-white">{a.nome[0]?.toUpperCase()}</span>
                        <span className="text-[13px] font-medium text-white">{a.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-[12px] text-gray-400">{a.papel}</td>
                    <td className="py-3 text-right">
                      <span className={`inline-flex h-6 items-center rounded-full border px-2 font-mono text-[10px] uppercase ${a.status_atendimento === "disponível" ? "border-emerald-500 text-emerald-400" : a.status_atendimento === "ocupado" ? "border-amber-500 text-amber-400" : "border-gray-700 text-gray-500"}`}>
                        {a.status_atendimento}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{a.conversas_abertas}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{a.conversas_resolvidas_mes}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">
                      {a.tempo_medio_resposta_seg !== null ? `${Math.round(a.tempo_medio_resposta_seg / 60)} min` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AtendimentoAtendentePage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
