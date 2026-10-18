import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Kpi } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { formatBRL, formatNum } from "@/lib/data/format";

export const metadata = { title: "Previsão de fechamento por IA — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const predicoes = [
    {
      lead: "Clínica Sorriso",
      valor: 45000,
      probabilidade: 85,
      prazo: 14,
      fatores: ["Respondeu WhatsApp", "Solicitou proposta", "Prazo curto"],
      tipo: "quente",
    },
    {
      lead: "Hospital Central",
      valor: 120000,
      probabilidade: 45,
      prazo: 45,
      fatores: ["Em negociação", "Esperando aprovação direoria", "Concorrência ativa"],
      tipo: "morno",
    },
    {
      lead: "Consultório Dr. Alves",
      valor: 18000,
      probabilidade: 92,
      prazo: 7,
      fatores: ["Orçamento aprovado", "Aguardando assinatura", "Cliente decisor"],
      tipo: "qualificado",
    },
    {
      lead: "Laboratório XYZ",
      valor: 85000,
      probabilidade: 25,
      prazo: 60,
      fatores: ["Não respondeu 3 mensagens", "Orçamento enviado sem retorno", "Concorrente mais barato"],
      tipo: "frio",
    },
  ];

  const totalPrevisto = predicoes.reduce((s, p) => s + p.valor * (p.probabilidade / 100), 0);
  const totalBruto = predicoes.reduce((s, p) => s + p.valor, 0);
  const mediaProb = predicoes.reduce((s, p) => s + p.probabilidade, 0) / predicoes.length;

  const tipoCor: Record<string, string> = {
    quente: "text-red-400",
    morno: "text-amber-400",
    frio: "text-gray-500",
    qualificado: "text-emerald-400",
  };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Vendas" titulo="Previsão de fechamento por IA" descricao="A IA analisa histórico, engajamento e dados do lead para prever probabilidade de fechamento e prazo." />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Previsão ponderada" valor={formatBRL(totalPrevisto)} detalhe="Valor × probabilidade" />
        <Kpi rotulo="Valor total pipeline" valor={formatBRL(totalBruto)} detalhe="Todos os negócios" />
        <Kpi rotulo="Probab. média" valor={formatNum(Math.round(mediaProb))} + "%" detalhe="Média do pipeline" />
        <Kpi rotulo="Leads analisados" valor={formatNum(predicoes.length)} detalhe="Com previsão ativa" />
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Previsões por lead</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[11px] uppercase tracking-[0.1em] text-gray-500">
                <th className="pb-3 font-medium">Lead</th>
                <th className="pb-3 font-medium text-right w-20">Valor</th>
                <th className="pb-3 font-medium text-right w-20">Prob.</th>
                <th className="pb-3 font-medium text-right w-20">Previsto</th>
                <th className="pb-3 font-medium text-right w-20">Prazo</th>
                <th className="pb-3 font-medium w-20">Classif.</th>
                <th className="pb-3 font-medium w-24">Fatores</th>
                <th className="pb-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {predicoes.map((p) => (
                <tr key={p.lead} className="hover:bg-gray-900/30">
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[11px] font-bold text-white">{p.lead[0]}</span>
                      <span className="truncate text-[13px] font-medium text-white">{p.lead}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{formatBRL(p.valor)}</td>
                  <td className="py-3 text-right text-[13px] font-bold tabular" style={{ color: tipoCor[p.tipo] }}>{p.probabilidade}%</td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{formatBRL(Math.round(p.valor * (p.probabilidade / 100)))}</td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{p.prazo} dias</td>
                  <td className="py-3 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase ${tipoCor[p.tipo]}`}>{p.tipo}</span>
                  </td>
                  <td className="py-3 text-right text-[11px] text-gray-400">
                    <ul className="flex flex-wrap gap-1">
                      {p.fatores.slice(0, 3).map((f) => (
                        <li key={f} className="rounded bg-gray-900/50 px-1.5 py-0.5">{f}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3 text-right">
                    <button className="text-[11px] text-blue-400 hover:text-blue-300">Ver detalhes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-gray-900/30 border border-gray-800">
          <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Como a IA calcula</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 p-3">
              <h5 className="text-[11px] font-bold text-white mb-1">Engajamento</h5>
              <p className="text-[12px] text-gray-400">Respostas no WhatsApp, e-mails abertos, chamadas atendidas.</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <h5 className="text-[11px] font-bold text-white mb-1">Histórico</h5>
              <p className="text-[12px] text-gray-400">Leads similares que fecharam, estágio atual, tempo no pipeline.</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <h5 className="text-[11px] font-bold text-white mb-1">Dados da empresa</h5>
              <p className="text-[12px] text-gray-400">Porte, faturamento, segmento, região geográfica.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PrevisaoIAPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[80vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
