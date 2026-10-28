import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { semSegredo, type Agente } from "@/lib/ai/agentes";
import { isoDiasAtras } from "@/lib/data/format";
import { AgentesView } from "@/components/agentes/agentes-view";

export const metadata = { title: "Agentes de IA — Tappo", robots: { index: false } };

async function Conteudo() {
  await exigirAdmin(); // não-admin = 404 (a área nem existe pra ele)
  const db = createAdminClient();
  const desde = isoDiasAtras(30);
  const [{ data: agentes, error }, { data: usos }] = await Promise.all([
    db.from("ai_agents").select("*").order("created_at"),
    db.from("ai_uso").select("agent_id, tokens_entrada, tokens_cache, tokens_saida").gte("created_at", desde).limit(20000),
  ]);
  if (error) {
    return (
      <div className="painel p-6 text-[14px] text-gray-300">
        As tabelas de agentes ainda não existem. Rode <code className="rounded bg-gray-800 px-1.5 font-mono text-[12px] text-white">supabase/setup_completo.sql</code> no SQL Editor do Supabase.
      </div>
    );
  }

  const uso: Record<string, { pedidos: number; tokens: number; cache: number }> = {};
  let totalTokens = 0;
  for (const u of usos ?? []) {
    const k = u.agent_id ?? "-";
    uso[k] ??= { pedidos: 0, tokens: 0, cache: 0 };
    uso[k].pedidos++;
    uso[k].tokens += u.tokens_entrada + u.tokens_saida;
    uso[k].cache += u.tokens_cache;
    totalTokens += u.tokens_entrada + u.tokens_saida;
  }

  return (
    <AgentesView
      agentes={(agentes ?? []).map((a) => semSegredo(a as Agente))}
      uso={uso}
      totalTokens={totalTokens}
      totalPedidos={usos?.length ?? 0}
    />
  );
}

export default function AgentesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-gray-500"><Loader2 className="animate-spin" size={18} /></div>}>
      <Conteudo />
    </Suspense>
  );
}
