import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerChatbotQualificacao } from "@/lib/data/crm";
import { SEGMENTOS } from "@/lib/segmentos";
import { FormPerguntaChatbot } from "@/components/chatbot/form-pergunta-chatbot";
import type { ChatbotQualificacao } from "@/lib/data/types";

export const metadata = { title: "Chatbot Qualificação — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const perguntasPorSegmento: Record<string, ChatbotQualificacao[]> = {};
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
              <FormPerguntaChatbot segmentoId={seg.id} perguntas={perguntas} />
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
