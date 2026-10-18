import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerChatbotQualificacao, salvarChatbotQualificacao, excluirChatbotQualificacao } from "@/lib/data/crm";
import { SEGMENTOS } from "@/lib/segmentos";

export const metadata = { title: "Chatbot Qualificação — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const perguntasPorSegmento: Record<string, any[]> = {};
  for (const segmento of SEGMENTOS) {
    perguntasPorSegmento[segmento.id] = await lerChatbotQualificacao(segmento.id);
  }

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="IA & Atendimento" titulo="Chatbot de Qualificação" descricao="Configure perguntas automáticas que o chatbot faz para qualificar leads antes de passar para um atendente humano." />

      <div className="grid gap-6 lg:grid-cols-3">
        {SEGMENTOS.map((seg) => {
          const perguntas = perguntasPorSegmento[seg.id] ?? [];
          return (
            <section key={seg.id} className="painel">
              <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
                <h3 className="text-[13px] font-medium text-white">{seg.nome}</h3>
                <span className="text-[11px] font-bold text-gray-500">{perguntas.length} pergunta{perguntas.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="px-5 py-3 space-y-2">
                {perguntas.length === 0 ? (
                  <p className="text-[12px] text-gray-500">Nenhuma pergunta configurada.</p>
                ) : (
                  <div className="space-y-1">
                    {perguntas.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-white truncate">{p.pergunta}</p>
                          <p className="text-[10px] text-gray-500">{p.campo_resposta} · ordem {p.ordem}</p>
                        </div>
                        <button
                          onClick={() => { if (confirm("Excluir esta pergunta?")) { (window as any).tappoExcluirChatbot?.(p.id); } }}
                          className="text-[10px] text-red-400 hover:bg-red-500/10 px-1.5 py-0.5 rounded" title="Excluir"
                        >
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <form className="px-5 py-4 space-y-3">
                <input type="hidden" name="segmento" defaultValue={seg.id} />
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Pergunta</label>
                  <input name="pergunta" placeholder="Ex.: Qual tratamento você procura?" className="campo w-full" required />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Campo resposta</label>
                    <input name="campo_resposta" defaultValue="resposta" className="campo w-full" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Ordem</label>
                    <input name="ordem" type="number" min="1" defaultValue={perguntas.length + 1} className="campo w-full" />
                  </div>
                  <div>
                    <label className="mb-1 block flex items-center gap-1.5">
                      <input type="checkbox" name="obrigatoria" defaultChecked className="mt-1" />
                      <span className="text-[11px] text-gray-400">Obrigatória</span>
                    </label>
                    <label className="mb-1 block flex items-center gap-1.5">
                      <input type="checkbox" name="ativa" defaultChecked className="mt-1" />
                      <span className="text-[11px] text-gray-400">Ativa</span>
                    </label>
                  </div>
                </div>
                <button className="btn btn-primario btn-sm w-full">Adicionar pergunta</button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ChatbotQualificacaoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
