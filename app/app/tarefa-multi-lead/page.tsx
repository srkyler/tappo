import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Tarefa Multi-Lead — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tarefas" titulo="Tarefa vinculada a múltiplos leads" descricao="Vincule uma tarefa a múltiplos leads e acompanhe o progresso em cada um." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova tarefa multi-lead</h3>
        <form className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
            <input name="titulo" placeholder="Ex.: Apresentação de proposta" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Descrição</label>
            <textarea name="descricao" rows={3} placeholder="Detalhes da tarefa..." className="campo w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tipo</label>
              <select name="tipo" className="campo w-full">
                <option value="ligacao">Ligação</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="reuniao">Reunião</option>
                <option value="visita">Visita</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Prioridade</label>
              <select name="prioridade" className="campo w-full">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Vence em</label>
              <input name="vence_em" type="datetime-local" className="campo w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Responsável</label>
              <select name="responsavel_id" className="campo w-full">
                <option value="">Eu mesmo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Leads vinculados</label>
            <div className="mt-1 rounded-lg border border-dashed border-gray-700 p-4">
              <p className="text-[12px] text-gray-500 mb-2">Clique ou arraste leads para vincular</p>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border-2 border-dashed border-gray-700 px-4 py-3 text-gray-500 hover:border-blue-500 hover:bg-blue-500/10 transition-colors">
                  + Adicionar lead
                </button>
              </div>
            </div>
          </div>
          <button className="btn btn-primario w-full">Salvar tarefa multi-lead</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Tarefas multi-lead</h2>
        </div>
        <Vazio titulo="Nenhuma tarefa multi-lead" texto="Crie sua primeira tarefa vinculada a múltiplos leads." />
      </section>
    </div>
  );
}

export default function TarefaMultiLeadPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}