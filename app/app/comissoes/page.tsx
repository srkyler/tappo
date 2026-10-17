import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio, Kpi } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerComissoes, salvarComissao } from "@/lib/data/crm";
import { formatBRL } from "@/lib/data/format";

export const metadata = { title: "Comissões — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const comissoes = await lerComissoes();

  const totalPendente = comissoes.filter((c) => c.status === "pendente").reduce((s, c) => s + c.valor_comissao, 0);
  const totalPago = comissoes.filter((c) => c.status === "pago").reduce((s, c) => s + c.valor_comissao, 0);

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Gestão" titulo="Comissões" descricao="Controle de comissões de vendas por vendedor e mês." />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-3">
        <Kpi rotulo="Comissões pendentes" valor={formatBRL(totalPendente)} detalhe="Aguardando pagamento" />
        <Kpi rotulo="Comissões pagas" valor={formatBRL(totalPago)} detalhe="Já liquidadas" />
        <Kpi rotulo="Total comissionado" valor={formatBRL(totalPendente + totalPago)} detalhe="Todos os períodos" />
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Comissões ({comissoes.length})</h2>
        </div>
        <div className="px-5 py-3 space-y-2">
          {comissoes.length === 0 ? (
            <Vazio titulo="Sem comissões" texto="Cadastre sua primeira comissão." />
          ) : (
            <div className="space-y-2">
              {comissoes.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{c.usuario?.nome_completo || "Vendedor"}</p>
                    <p className="text-[11px] text-gray-500">{c.mes} · {c.percentual}% sobre deal</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className={`text-[12px] font-bold ${c.status === "pago" ? "text-emerald-400" : c.status === "cancelado" ? "text-gray-600" : "text-amber-400"}`}>
                      {formatBRL(c.valor_comissao)}
                    </span>
                    <span className="text-[10px] uppercase rounded-full border px-2 py-0.5" style={{ borderColor: c.status === "pago" ? "#10B981" : c.status === "cancelado" ? "#6B7280" : "#F59E0B" }}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova comissão</h3>
        <form action={salvarComissao} className="space-y-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Vendedor (ID)</label>
            <input name="user_id" placeholder="UUID do usuário" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Deal (ID, opcional)</label>
            <input name="deal_id" placeholder="UUID do negócio" className="campo w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Percentual (%)</label>
            <input name="percentual" type="number" step="0.01" min="0" max="100" placeholder="10" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Valor (R$)</label>
            <input name="valor_comissao" type="number" step="0.01" min="0" placeholder="0,00" className="campo w-full" required />
          </div>
          <div className="col-span-full sm:col-span-2">
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Mês</label>
            <input name="mes" type="month" className="campo w-full" required />
          </div>
          <div className="col-span-full sm:col-span-2">
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Status</label>
            <select name="status" className="campo w-full">
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <button className="btn btn-primario w-full col-span-full sm:col-span-4">Salvar comissão</button>
        </form>
      </section>
    </div>
  );
}

export default function ComissoesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
