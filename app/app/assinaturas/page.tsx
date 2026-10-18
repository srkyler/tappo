import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Kpi, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { formatBRL, formatNum } from "@/lib/data/format";

export const metadata = { title: "Receita recorrente — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const assinaturas = [
    { cliente: "Clínica Sorriso", plano: "Plano Anual", valor: 2990, status: "ativa", renovacao: "15/11/2026", pagamento: "Cartão" },
    { cliente: "Hospital Central", plano: "Plano Empresarial", valor: 8990, status: "ativa", renovacao: "05/12/2026", pagamento: "Boleto" },
    { cliente: "Consultório Dr. Alves", plano: "Plano Básico", valor: 499, status: "ativa", renovacao: "20/10/2026", pagamento: "Pix" },
    { cliente: "Laboratório XYZ", plano: "Plano Médio", valor: 1490, status: "pausada", renovacao: "—", pagamento: "—" },
    { cliente: "Academia Fit", plano: "Plano Premium", valor: 3490, status: "ativa", renovacao: "10/11/2026", pagamento: "Cartão" },
  ];

  const mrr = assinaturas.filter((a) => a.status === "ativa").reduce((s, a) => s + a.valor, 0);
  const ativas = assinaturas.filter((a) => a.status === "ativa").length;
  const pausadas = assinaturas.filter((a) => a.status === "pausada").length;
  const canceladas = assinaturas.filter((a) => a.status === "cancelada").length;

  const statusCor: Record<string, string> = {
    ativa: "text-emerald-400",
    pausada: "text-amber-400",
    cancelada: "text-gray-500",
    expirada: "text-red-400",
  };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Vendas" titulo="Receita recorrente" descricao="Gerencie assinaturas, MRR e renovações de clientes." />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi rotulo="MRR" valor={formatBRL(mrr)} detalhe="Receita recorrente mensal" />
        <Kpi rotulo="Assinaturas ativas" valor={formatNum(ativas)} detalhe="Clientes ativos" />
        <Kpi rotulo="Pausadas" valor={formatNum(pausadas)} detalhe="Temporariamente pausadas" />
        <Kpi rotulo="Canceladas" valor={formatNum(canceladas)} detalhe="Clientes perdidos" />
        <Kpi rotulo="ARR (anual)" valor={formatBRL(mrr * 12)} detalhe="Projeção anual" />
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Assinaturas ({assinaturas.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[11px] uppercase tracking-[0.1em] text-gray-500">
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Plano</th>
                <th className="pb-3 font-medium text-right w-20">Valor/mês</th>
                <th className="pb-3 font-medium text-right w-20">Renovação</th>
                <th className="pb-3 font-medium text-right w-20">Pagamento</th>
                <th className="pb-3 font-medium w-20">Status</th>
                <th className="pb-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {assinaturas.map((a) => (
                <tr key={a.cliente} className="hover:bg-gray-900/30">
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[11px] font-bold text-white">{a.cliente[0]}</span>
                      <span className="truncate text-[13px] font-medium text-white">{a.cliente}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[13px] text-gray-400">{a.plano}</td>
                  <td className="py-3 text-right text-[13px] font-medium text-white tabular">{formatBRL(a.valor)}</td>
                  <td className="py-3 text-right text-[13px] text-gray-400">{a.renovacao}</td>
                  <td className="py-3 text-right text-[13px] text-gray-400">{a.pagamento}</td>
                  <td className="py-3 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusCor[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">Gerenciar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-gray-900/30 border border-gray-800">
          <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Previsão de renovação (próximos 30 dias)</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500">Vencem esta semana</p>
              <p className="text-[13px] font-bold text-white">2</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500">Vencem este mês</p>
              <p className="text-[13px] font-bold text-white">5</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="text-[11px] text-gray-500">Valor em risco</p>
              <p className="text-[13px] font-bold text-white">{formatBRL(4990)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AssinaturasPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
