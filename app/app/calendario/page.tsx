import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerTarefasCalendario } from "@/lib/data/crm";
import { formatData } from "@/lib/data/format";

export const metadata = { title: "Calendário de Tarefas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const tarefas = await lerTarefasCalendario();

  // Agrupa por data
  const porData = new Map<string, TarefaView[]>();
  for (const t of tarefas) {
    if (!t.vence_em) continue;
    const data = t.vence_em.slice(0, 10);
    if (!porData.has(data)) porData.set(data, []);
    porData.get(data)!.push(t);
  }

  const datas = Array.from(porData.keys()).sort();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tarefas" titulo="Calendário" descricao="Visualize suas tarefas por data de vencimento." />

      {datas.length === 0 ? (
        <Vazio titulo="Sem tarefas agendadas" texto="Crie tarefas com data de vencimento para aparecerem aqui." />
      ) : (
        <div className="space-y-4">
          {datas.map((data) => {
            const ts = porData.get(data)!;
            return (
              <section key={data} className="painel">
                <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
                  <h3 className="text-[13px] font-medium text-white">{formatData(data)}</h3>
                  <span className="text-[11px] font-bold text-gray-500">{ts.length}</span>
                </div>
                <div className="px-5 py-3 space-y-2">
                  {ts.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{t.titulo}</p>
                        <p className="text-[11px] text-gray-500">
                          {t.tipo} · {t.prioridade}
                          {t.lead_nome ? ` · ${t.lead_nome}` : ""}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {t.responsavel_nome || "Sem responsável"} {t.concluida_em ? "· concluída" : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase rounded-full border px-2 py-0.5 ${t.prioridade === "alta" ? "text-red-400 border-red-500/30" : t.prioridade === "media" ? "text-amber-400 border-amber-500/30" : "text-gray-500 border-gray-700"}`}>
                        {t.prioridade}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
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
