import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Executivo — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Analytics" titulo="Dashboard executivo" descricao="Visão estratégica de receita, conversão e performance da equipe." />

      <section className="painel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-[11px] text-gray-500 uppercase mb-1">Receita mensal</p>
            <p className="text-[24px] font-bold text-white">R$ 0,00</p>
          </div>
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-[11px] text-gray-500 uppercase mb-1">Leads convertidos</p>
            <p className="text-[24px] font-bold text-white">0</p>
          </div>
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-[11px] text-gray-500 uppercase mb-1">Taxa de conversão</p>
            <p className="text-[24px] font-bold text-white">0%</p>
          </div>
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-[11px] text-gray-500 uppercase mb-1">Ticket médio</p>
            <p className="text-[24px] font-bold text-white">R$ 0,00</p>
          </div>
        </div>
        <Vazio titulo="Sem dados" texto="Não há dados suficientes para exibir o dashboard executivo." />
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
