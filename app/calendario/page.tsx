import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Calendário — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Agenda" titulo="Calendário de tarefas" descricao="Acompanhe tarefas, compromissos e follow-ups em uma visão de calendário." />

      <section className="painel p-5">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Calendário mensal</h2>
        </div>
        <Vazio titulo="Sem compromissos" texto="Nenhuma tarefa ou compromisso agendado ainda." />
      </section>
    </div>
  );
}

export default function CalendarioPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
