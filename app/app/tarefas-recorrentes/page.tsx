import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerTarefasRecorrentes } from "@/lib/data/crm";
import { salvarTarefaRecorrente, excluirTarefaRecorrente } from "@/app/app/crm/actions";

export const metadata = { title: "Tarefas Recorrentes — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const tarefas = await lerTarefasRecorrentes();

  const recorrenciaLabel: Record<string, string> = {
    diaria: "Diária",
    semanal: "Semanal",
    mensal: "Mensal",
    anual: "Anual",
  };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tarefas" titulo="Tarefas Recorrentes" descricao="Tarefas que se repetem automaticamente. Uma nova tarefa é criada sempre que a recorrente vence." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Tarefas Recorrentes ({tarefas.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {tarefas.length === 0 ? (
              <Vazio titulo="Sem tarefas recorrentes" texto="Cadastre sua primeira tarefa recorrente." />
            ) : (
              <div className="space-y-2">
                {tarefas.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{t.titulo}</p>
                      <p className="text-[11px] text-gray-500">{t.tipo} · {t.prioridade} · {recorrenciaLabel[t.recorrencia]}</p>
                      <p className="text-[11px] text-gray-400">Próxima: {t.proxima_execucao?.slice(0, 10) || "—"}</p>
                    </div>
                    <span className={`text-[10px] uppercase rounded-full border px-2 py-0.5 ${t.ativa ? "text-emerald-400 border-emerald-500/30" : "text-gray-600 border-gray-800"}`}>
                      {t.ativa ? "Ativa" : "Pausada"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova tarefa recorrente</h3>
          <form action={salvarTarefaRecorrente} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
              <input name="titulo" placeholder="Ex.: Ligar para clientes inativos" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Descrição</label>
              <textarea name="descricao" rows={2} placeholder="O que fazer nesta tarefa…" className="campo w-full" />
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
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Recorrência</label>
                <select name="recorrencia" className="campo w-full">
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Próxima execução</label>
                <input name="proxima_execucao" type="datetime-local" className="campo w-full" required />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="ativa" defaultChecked className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">Tarefa ativa</span>
                <span className="block text-[12.5px] text-gray-500">Quando inativa, não gera novas tarefas.</span>
              </span>
            </label>
            <button className="btn btn-primario w-full">Salvar tarefa recorrente</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function TarefasRecorrentesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
