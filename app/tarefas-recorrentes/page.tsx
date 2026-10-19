import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Tarefas Recorrentes — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tarefas" titulo="Tarefas recorrentes" descricao="Configure tarefas que se repetem automaticamente em intervalos definidos." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova tarefa recorrente</h3>
        <form className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
            <input name="titulo" placeholder="Ex.: Seguimento semanal de leads" className="campo w-full" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Frequência</label>
              <select name="frequencia" className="campo w-full">
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Dia da semana</label>
              <select name="dia_semana" className="campo w-full">
                <option value="segunda">Segunda-feira</option>
                <option value="terca">Terça-feira</option>
                <option value="quarta">Quarta-feira</option>
                <option value="quinta">Quinta-feira</option>
                <option value="sexta">Sexta-feira</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Horário</label>
              <input name="horario" type="time" defaultValue="09:00" className="campo w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Responsável</label>
              <select name="responsavel_id" className="campo w-full">
                <option value="">Eu mesmo</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primario w-full">Criar tarefa recorrente</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Tarefas recorrentes ativas</h2>
        </div>
        <Vazio titulo="Sem tarefas recorrentes" texto="Nenhuma tarefa recorrente configurada ainda." />
      </section>
    </div>
  );
}

export default function TarefasRecorrentesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}