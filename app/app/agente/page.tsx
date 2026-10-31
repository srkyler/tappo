import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ChatCRM } from "@/components/agente/chat-crm";
import { agenteAtivoPublico } from "@/lib/ai/agentes";
import { usuarioAtual } from "@/lib/data/queries";

export const metadata = { title: "Agente IA — Tappo" };

async function Conteudo() {
  await usuarioAtual(); // marca a rota como dinâmica por sessão
  const agente = await agenteAtivoPublico();
  return <ChatCRM agente={agente} />;
}

export default function AgentePage() {
  return (
    <div className="h-[calc(100svh-57px-96px)] lg:h-[100svh]">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500"><Loader2 className="animate-spin" size={18} /></div>}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
