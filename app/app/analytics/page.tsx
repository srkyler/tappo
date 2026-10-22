import Link from "next/link";
import { Suspense } from "react";
import { Barra, Cabecalho, Kpi, Pagina, Painel, Vazio, cn } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, lerResumo } from "@/lib/data/queries";
import { formatBRL, formatNum } from "@/lib/data/format";
import { LEAD_STATUS } from "@/lib/data/types";

export const metadata = { title: "Analytics — Tappo" };

const PERIODOS = [7, 30, 90] as const;
type Params = Promise<{ p?: string }>;

function pct(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "—";
}

function variacao(a: number, b: number) {
  if (b === 0) return a > 0 ? "novo no período" : "sem variação";
  const v = Math.round(((a - b) / b) * 100);
  return `${v > 0 ? "+" : ""}${v}% vs período anterior`;
}

async function Conteudo({ searchParams }: { searchParams: Params }) {
  const { p } = await searchParams;
  const dias = PERIODOS.includes(Number(p) as 7) ? Number(p) : 30;
  if (!(await bancoPronto())) return <AvisoBanco />;
  const r = await lerResumo(dias);

  return (
    <>
      <div className="mb-6 inline-flex rounded-full border border-gray-800 p-1">
        {PERIODOS.map((d) => (
          <Link key={d} href={`/app/analytics?p=${d}`} className={cn("rounded-full px-4 py-1.5 text-[13px] transition-colors", d === dias ? "bg-white text-black" : "text-gray-400 hover:text-white")}>
            {d} dias
          </Link>
        ))}
      </div>

      {!r ? (
        <div className="painel"><Vazio titulo="Não foi possível calcular as métricas" texto="Verifique se a função analytics_resumo foi criada no Supabase." /></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Kpi rotulo="Novos leads" valor={formatNum(r.leads_periodo)} detalhe={variacao(r.leads_periodo, r.leads_anterior)} />
            <Kpi rotulo="Taxa de resposta" valor={pct(r.respostas_periodo, r.em_campanha_periodo)} detalhe={`${r.respostas_periodo} de ${r.em_campanha_periodo} em campanha`} />
            <Kpi rotulo="Reuniões" valor={formatNum(r.reunioes_periodo)} detalhe={variacao(r.reunioes_periodo, r.reunioes_anterior)} />
            <Kpi rotulo="Win rate" valor={pct(r.ganhos_periodo, r.ganhos_periodo + r.perdidos_periodo)} detalhe={`${formatBRL(r.valor_ganho_periodo)} ganhos`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Painel titulo="Novos leads por semana" corpo="p-5">
              {r.leads_por_semana.length === 0 ? <Vazio titulo="Sem dados" /> : (
                <div className="flex h-48 items-end gap-1.5">
                  {r.leads_por_semana.map((s) => {
                    const max = Math.max(1, ...r.leads_por_semana.map((x) => x.total));
                    return (
                      <div key={s.semana} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <span className="text-[11px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 tabular">{s.total}</span>
                        <div className="w-full max-w-[36px] rounded-t-md bg-white transition-[height] duration-700" style={{ height: `${Math.max(2, (s.total / max) * 100)}%`, opacity: s.total ? 1 : 0.15 }} />
                        <span className="text-[10px] text-gray-600 tabular">{s.semana}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Painel>

            <Painel titulo="Funil do pipeline" corpo="p-5">
              <ul className="space-y-3">
                {r.funil.map((f) => {
                  const max = Math.max(1, ...r.funil.map((x) => x.total));
                  return (
                    <li key={f.etapa}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className={f.tipo === "perdido" ? "text-gray-500" : "text-gray-200"}>{f.etapa}</span>
                        <span className="text-gray-500 tabular">{f.total} · {formatBRL(f.valor)}</span>
                      </div>
                      <Barra valor={f.total} max={max} />
                    </li>
                  );
                })}
              </ul>
            </Painel>

            <Painel titulo="Base por status" corpo="p-5">
              <ul className="space-y-3">
                {LEAD_STATUS.map((s) => {
                  const n = r.leads_por_status[s] ?? 0;
                  return (
                    <li key={s} className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-[13px]">
                      <span className="text-gray-400">{s}</span>
                      <Barra valor={n} max={Math.max(1, r.leads_total)} />
                      <span className="text-right text-white tabular">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </Painel>

            <Painel titulo="Origem dos novos leads" corpo="p-5">
              {r.leads_por_origem.length === 0 ? <Vazio titulo="Sem leads no período" /> : (
                <ul className="space-y-3">
                  {r.leads_por_origem.map((o) => (
                    <li key={o.origem} className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-[13px]">
                      <span className="text-gray-400">{o.origem}</span>
                      <Barra valor={o.total} max={Math.max(1, r.leads_periodo)} />
                      <span className="text-right text-white tabular">{o.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel titulo="Campanhas com mais respostas" className="lg:col-span-2">
              {r.top_campanhas.length === 0 ? <Vazio titulo="Nenhuma campanha" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-[13.5px]">
                    <thead><tr className="border-b border-gray-800 text-[11px] uppercase tracking-[0.1em] text-gray-500">
                      <th className="px-5 py-3 font-medium">Campanha</th><th className="px-3 py-3 text-right font-medium">Leads</th><th className="px-3 py-3 text-right font-medium">Respostas</th><th className="px-5 py-3 text-right font-medium">Reuniões</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-800">
                      {r.top_campanhas.map((c) => (
                        <tr key={c.nome}>
                          <td className="px-5 py-3 text-white">{c.nome}</td>
                          <td className="px-3 py-3 text-right text-gray-300 tabular">{c.leads}</td>
                          <td className="px-3 py-3 text-right text-gray-300 tabular">{c.respostas} <span className="text-gray-600">({pct(c.respostas, c.leads)})</span></td>
                          <td className="px-5 py-3 text-right text-white tabular">{c.reunioes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Painel>
          </div>
        </>
      )}
    </>
  );
}

export default function AnalyticsPage({ searchParams }: { searchParams: Params }) {
  return (
    <Pagina>
      <Cabecalho rotulo="Resultados" titulo="Analytics" descricao="Todos os números vêm da sua base — nada é estimado." />
      <Suspense fallback={<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-[110px]" />)}</div>}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </Pagina>
  );
}
