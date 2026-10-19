import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Assinatura Recorrente — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Financeiro" titulo="Assinaturas recorrentes" descricao="Gerencie planos de assinatura, renovações e cobranças recorrentes." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Novo plano recorrente</h3>
        <form className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome do plano</label>
              <input name="nome" placeholder="Ex.: Plano Mensal" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Valor</label>
              <input name="valor" type="number" placeholder="0,00" className="campo w-full" required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Ciclo</label>
              <select name="ciclo" className="campo w-full">
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Dia de vencimento</label>
              <input name="dia_vencimento" type="number" min="1" max="28" defaultValue="5" className="campo w-full" />
            </div>
          </div>
          <button className="btn btn-primario w-full">Criar plano</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Assinaturas ativas</h2>
        </div>
        <Vazio titulo="Sem assinaturas recorrentes" texto="Nenhum plano recorrente cadastrado ainda." />
      </section>
    </div>
  );
}

export default function AssinaturaRecorrentePage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}