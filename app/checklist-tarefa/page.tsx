import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Checklist de Tarefa — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tarefas" titulo="Checklist de tarefa" descricao="Adicione itens de checklist para detalhamento de tarefas complexas." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Novo item de checklist</h3>
        <form className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tarefa principal</label>
            <select name="tarefa_id" className="campo w-full" required>
              <option value="">Selecione uma tarefa</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Item do checklist</label>
            <input name="item" placeholder="Ex.: Enviar contrato assinado" className="campo w-full" required />
          </div>
          <button className="btn btn-primario w-full">Adicionar item</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Checklists</h2>
        </div>
        <Vazio titulo="Sem checklists" texto="Nenhum item de checklist cadastrado." />
      </section>
    </div>
  );
}

export default function ChecklistTarefaPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}