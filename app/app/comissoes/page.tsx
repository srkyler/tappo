import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio, Kpi } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerComissoes } from "@/lib/data/crm";
import { membrosDaEmpresa } from "@/lib/data/empresa";
import { formatBRL } from "@/lib/data/format";
import { FormComissao } from "@/components/crm/form-comissao";

export const metadata = { title: "Comissões — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [comissoes, membros] = await Promise.all([lerComissoes(), membrosDaEmpresa()]);

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
        <FormComissao membros={membros} />
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
