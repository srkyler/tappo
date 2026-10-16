import { Suspense } from "react";
import { Cabecalho, Pagina, Barra, Kpi } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { lerPainelGestor, bancoPronto } from "@/lib/data/queries";
import { formatBRL, formatNum } from "@/lib/data/format";
import { salvarMetas } from "@/app/app/empresa/actions";

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const painel = await lerPainelGestor(30);
  if (!painel) return <div className="text-[14px] text-gray-500">Não foi possível carregar o painel.</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Ganho · 30d" valor={formatBRL(painel.ganho_valor)} detalhe={`${painel.ganho_qtd} negócios fechados`} />
        <Kpi rotulo="Perdidos · 30d" valor={formatNum(painel.perdido_qtd)} detalhe="Negócios perdidos no período" />
        <Kpi rotulo="Pipeline aberto" valor={formatBRL(painel.aberto_valor)} detalhe="Valor em negócios abertos" />
        <Kpi rotulo="Previsão (ponderada)" valor={formatBRL(painel.previsao)} detalhe="Soma valor × probabilidade" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Funil</h2>
          </div>
          <div className="px-5 py-3 space-y-3">
            {painel.funil.length === 0 ? (
              <p className="text-[12px] text-gray-500">Sem etapas no funil.</p>
            ) : (
              <ul>
                {painel.funil.map((f) => {
                  const max = Math.max(1, ...painel.funil.map((x) => x.qtd));
                  return (
                    <li key={f.etapa} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-[12px]">
                      <span className={`truncate ${f.tipo === "ganho" ? "text-emerald-400" : f.tipo === "perdido" ? "text-gray-500" : "text-gray-400"}`}>{f.etapa}</span>
                      <Barra valor={f.qtd} max={max} />
                      <span className="w-8 text-right text-white tabular">{f.qtd}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Inbox</h2>
          </div>
          <div className="px-5 py-3 grid gap-2 grid-cols-2 text-[12px]">
            <div className="rounded-lg bg-gray-900/30 p-3">
              <p className="text-gray-500 text-[10px] uppercase">Abertas</p>
              <p className="text-white font-medium">{painel.inbox.abertas}</p>
            </div>
            <div className="rounded-lg bg-gray-900/30 p-3">
              <p className="text-gray-500 text-[10px] uppercase">Sem responsável</p>
              <p className="text-white font-medium">{painel.inbox.sem_responsavel}</p>
            </div>
            <div className="rounded-lg bg-gray-900/30 p-3">
              <p className="text-gray-500 text-[10px] uppercase">Aguardando &gt;15m</p>
              <p className="text-white font-medium">{painel.inbox.aguardando_15m}</p>
            </div>
            <div className="rounded-lg bg-gray-900/30 p-3">
              <p className="text-gray-500 text-[10px] uppercase">Tempo médio resp.</p>
              <p className="text-white font-medium">{painel.inbox.tempo_medio_seg === null ? "—" : Math.round(painel.inbox.tempo_medio_seg / 60) + " min"}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Equipe</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[11px] uppercase text-gray-500">
                <th className="pb-3 font-medium">Membro</th>
                <th className="pb-3 font-medium text-right w-20">Ganho 30d</th>
                <th className="pb-3 font-medium text-right w-20">Meta</th>
                <th className="pb-3 font-medium text-right w-20">Atividades</th>
                <th className="pb-3 font-medium text-right w-20">Conversas</th>
                <th className="pb-3 font-medium text-right w-20">Tarefas</th>
                <th className="pb-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {painel.equipe.length === 0 ? (
                <tr><td colSpan={7} className="h-24 text-center text-gray-500">Sem membros na equipe.</td></tr>
              ) : (
                painel.equipe.map((m) => (
                  <tr key={m.user_id} className="hover:bg-gray-900/30">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[11px] font-bold text-white">{m.nome[0]?.toUpperCase()}</span>
                        <span className="text-[13px] font-medium text-white truncate">{m.nome}</span>
                        <span className="ml-auto text-[10px] uppercase text-gray-500">{m.papel}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{formatBRL(m.ganho_mes)}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{formatBRL(m.meta_valor ?? 0)}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{m.atividades}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{m.conversas_abertas}</td>
                    <td className="py-3 text-right text-[12px] text-white tabular">{m.tarefas_feitas}</td>
                    <td className="py-3 text-right">
                      {m.tarefas_atrasadas > 0 && <span className="text-red-400 text-[11px]">{m.tarefas_atrasadas} atrasada{m.tarefas_atrasadas > 1 ? "s" : ""}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {painel.equipe.length > 0 && (
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Metas do mês</h2>
          </div>
          <form action={async (f) => { await salvarMetas(f); }} className="px-5 py-4 space-y-3 grid gap-3 sm:grid-cols-2">
            <div className="col-span-full">
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Mês</label>
              <input name="mes" type="month" className="campo w-48" />
            </div>
            {painel.equipe.map((m) => (
              <div key={m.user_id} className="rounded-lg border border-gray-800 p-3">
                <p className="text-[12px] font-medium text-white mb-1">{m.nome}</p>
                <div className="flex gap-2">
                  <input
                    name="meta_valor"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={m.meta_valor ?? 0}
                    placeholder="R$ meta"
                    className="campo flex-1"
                  />
                  <input
                    name="meta_vendas"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={0}
                    placeholder="Vendas"
                    className="campo w-32"
                  />
                  <input type="hidden" name="user_id" value={m.user_id} />
                </div>
                </div>
              ))}
            <input type="hidden" name="mes" defaultValue={new Date().toISOString().slice(0, 7)} />
            <button className="btn btn-primario btn-sm col-span-full sm:col-span-1">Salvar metas</button>
          </form>
        </section>
      )}

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Previsão por mês</h2>
        </div>
        <div className="px-5 py-3 space-y-2">
          {painel.previsao_meses.length === 0 ? (
            <p className="text-[12px] text-gray-500">Sem previsão de fechamento.</p>
          ) : (
            <ul>
              {painel.previsao_meses.map((x) => (
                <li key={x.mes} className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-400">{x.mes}</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-white font-medium tabular">{formatBRL(x.bruto)}</span>
                    <span className="text-gray-500 text-[11px]">· {x.qtd} negócios</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function GestorPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Gestão" titulo="Painel do gestor" descricao="Previsão de receita, funil, ranking da equipe e tempo de resposta. Somente donos e gestores." />
      <Suspense fallback={<div className="esqueleto h-[80vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
