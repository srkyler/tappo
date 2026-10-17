import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Kpi, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { formatBRL, formatNum } from "@/lib/data/format";

export const metadata = { title: "Dashboard Executivo — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase, user } = await usuarioAtual();

  // Buscar métricas globais da empresa atual
  const [{ data: leads }, { data: deals }, { data: conversas }] = await Promise.all([
    supabase.from("leads").select("id, status, origem, criado_em"),
    supabase.from("deals").select("id, valor, tipo, fechado_em, stage_id"),
    supabase.from("wa_conversas").select("id, status, ultima_em"),
  ]);

  const totalLeads = leads?.length ?? 0;
  const totalDeals = deals?.length ?? 0;
  const totalConversas = conversas?.length ?? 0;
  const ganhoTotal = deals?.filter((d: any) => d.tipo === "ganho").reduce((s, d) => s + Number(d.valor), 0) ?? 0;
  const pipelineAberto = deals?.filter((d: any) => d.tipo === "aberto").reduce((s, d) => s + Number(d.valor), 0) ?? 0;

  const taxaConversao = totalLeads > 0 ? Math.round((deals?.filter((d: any) => d.tipo === "ganho").length ?? 0) / totalLeads * 100) : 0;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Gestão" titulo="Dashboard Executivo" descricao="Visão consolidada da empresa. Métricas de leads, vendas, pipeline e atendimento." />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi rotulo="Total Leads" valor={formatNum(totalLeads)} detalhe="Na base atual" />
        <Kpi rotulo="Total Negócios" valor={formatNum(totalDeals)} detalhe="No pipeline" />
        <Kpi rotulo="Conversas" valor={formatNum(totalConversas)} detalhe="No inbox (todos canais)" />
        <Kpi rotulo="Ganho Total" valor={formatBRL(ganhoTotal)} detalhe="Negócios fechados" />
        <Kpi rotulo="Pipeline Aberto" valor={formatBRL(pipelineAberto)} detalhe="Em andamento" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Taxa de Conversão</h2>
          </div>
          <div className="px-5 py-6 text-center">
            <p className="text-[48px] font-bold text-white">{taxaConversao}%</p>
            <p className="text-[12px] text-gray-500 mt-2">Leads → Negócios Ganhos</p>
          </div>
        </section>

        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Leads por Origem</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {(leads ?? []).length === 0 ? (
              <Vazio titulo="Sem leads" texto="Cadastre leads para ver a distribuição por origem." />
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  (leads ?? []).reduce((acc: Record<string, number>, l: any) => {
                    acc[l.origem] = (acc[l.origem] ?? 0) + 1;
                    return acc;
                  }, {})
                ).slice(0, 6).map(([origem, total]) => (
                  <div key={origem} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <span className="text-[13px] text-white truncate flex-1 pr-2">{origem}</span>
                    <span className="text-[13px] font-bold text-white tabular">{total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Evolução de Leads por Semana</h2>
        </div>
        <div className="px-5 py-3">
          <p className="text-[12px] text-gray-500">Integre com o Google Analytics ou use a captação via webhook para ver a evolução detalhada.</p>
        </div>
      </section>
    </div>
  );
}

export default function ExecutivoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
