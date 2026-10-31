import { Suspense } from "react";
import Link from "next/link";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerTarefasRecorrentes } from "@/lib/data/crm";
import { FormTarefaRecorrente } from "@/components/crm/form-tarefa-recorrente";
import { ListaRecorrentes } from "@/components/crm/lista-recorrentes";

export const metadata = { title: "Tarefas recorrentes — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const itens = await lerTarefasRecorrentes();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="painel">
        <h2 className="border-b border-gray-800 px-5 py-3 text-[13px] font-medium text-white">Recorrentes ({itens.length})</h2>
        <ListaRecorrentes itens={itens} />
      </section>
      <section className="painel p-5">
        <h2 className="mb-3 text-[13px] font-medium text-white">Nova tarefa recorrente</h2>
        <FormTarefaRecorrente />
        <p className="mt-3 text-[12px] text-gray-500">O agendador cria a tarefa em Tarefas no horário marcado (verifica a cada 15 minutos) e já programa a próxima.</p>
      </section>
    </div>
  );
}

export default function TarefasRecorrentesPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Tarefas" titulo="Tarefas recorrentes" descricao="Tarefas que se repetem sozinhas: ligação semanal, relatório mensal, revisão diária."
        acoes={<Link href="/app/tarefas" className="btn btn-secundario btn-sm">Ver tarefas</Link>} />
      <Suspense fallback={<div className="esqueleto h-[50vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
