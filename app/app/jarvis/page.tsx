import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Chat } from "@/components/agente/chat";
import { agenteAtivoPublico } from "@/lib/ai/agentes";
import { usuarioAtual } from "@/lib/data/queries";

export const metadata = { title: "Jarvis — Tappo" };

const SUGESTOES_JARVIS = [
  { t: "Como está a configuração da minha empresa?", d: "Equipe, conexões, SLA, automações" },
  { t: "Configure o SLA de resposta pra 15 minutos", d: "Alerta no inbox quando passar do tempo" },
  { t: "Crie uma automação: quando um lead virar Qualificado, criar uma tarefa", d: "Nasce pausada — você revisa e ativa" },
  { t: "Crie uma promoção de avaliação gratuita começando hoje", d: "Vai pro calendário de marketing" },
];

async function Conteudo() {
  await usuarioAtual();
  const agente = await agenteAtivoPublico();
  return (
    <Chat
      agente={agente}
      endpoint="/api/jarvis"
      chaveStorage="tappo:jarvis:conversa"
      rotaBase="/app/jarvis"
      sugestoes={SUGESTOES_JARVIS}
      nomeExibicao="Jarvis"
      descricaoExibicao="Seu assistente de configuração. Diagnóstico, automações, SLA, promoções e convite de equipe."
    />
  );
}

export default function JarvisPage() {
  return (
    <div className="h-[calc(100svh-57px-96px)] lg:h-[100svh]">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500"><Loader2 className="animate-spin" size={18} /></div>}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
