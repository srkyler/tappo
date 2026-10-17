import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerTarefasRecorrentes } from "@/lib/data/crm";
import { FormTarefaRecorrente } from "@/components/crm/form-tarefa-recorrente";

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
          <FormTarefaRecorrente />
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
