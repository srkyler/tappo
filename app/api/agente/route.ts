import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agenteAtivo } from "@/lib/ai/agentes";
import { rodarAgente, type Evento } from "@/lib/ai/motor";
import { motivoBloqueio } from "@/lib/ai/atendimento";

/* POST /api/agente — conversa com o agente ativo. Resposta: NDJSON (um evento por linha). */

const Corpo = z.object({
  mensagens: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(12000),
  })).min(1).max(80),
});

// Limite simples por usuário (por instância): 20 pedidos a cada 5 minutos
const JANELA = 5 * 60_000;
const LIMITE = 20;
const pedidos = new Map<string, number[]>();
function dentroDoLimite(id: string) {
  const agora = Date.now();
  const lista = (pedidos.get(id) ?? []).filter((t) => agora - t < JANELA);
  if (lista.length >= LIMITE) return false;
  lista.push(agora);
  pedidos.set(id, lista);
  return true;
}

const json = (status: number, erro: string) => Response.json({ erro }, { status });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, "Sessão expirada. Entre novamente.");
  if (!dentroDoLimite(user.id)) return json(429, "Muitas mensagens seguidas. Aguarde alguns minutos.");

  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return json(400, "Pedido inválido.");

  const agente = await agenteAtivo().catch(() => null);
  if (!agente) return json(503, "Nenhum agente de IA está ativo. Peça ao administrador para ativar um.");

  // Teto de gasto (economia): por agente no mês e por membro no dia
  if (agente.teto_tokens_mes || agente.teto_tokens_usuario_dia) {
    const db = createAdminClient();
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const inicioDia = new Date(agora.getTime() - 86400000).toISOString();
    const [mes, dia] = await Promise.all([
      agente.teto_tokens_mes ? db.rpc("ai_tokens_usados", { agente: agente.id, desde: inicioMes }) : { data: 0 },
      agente.teto_tokens_usuario_dia ? db.rpc("ai_tokens_usados", { agente: agente.id, desde: inicioDia, usuario: user.id }) : { data: 0 },
    ]);
    if (agente.teto_tokens_mes && Number(mes.data ?? 0) >= agente.teto_tokens_mes) {
      return json(429, "O limite mensal de uso da IA foi atingido. Fale com o administrador.");
    }
    if (agente.teto_tokens_usuario_dia && Number(dia.data ?? 0) >= agente.teto_tokens_usuario_dia) {
      return json(429, "Você atingiu seu limite diário de uso da IA. Volta amanhã!");
    }
  }

  // Limite da empresa (definido só pelo admin da plataforma em /admin)
  const { data: orgId } = await supabase.rpc("org_atual");
  if (orgId) {
    const bloqueio = await motivoBloqueio(createAdminClient(), agente, orgId as string);
    if (bloqueio) return json(429, bloqueio);
  }

  const { data: perfil } = await supabase.from("profiles").select("nome_completo").eq("id", user.id).maybeSingle();

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitir = (e: Evento) => {
        try { controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`)); } catch { /* cliente saiu */ }
      };
      try {
        const uso = await rodarAgente({
          agente,
          sb: supabase,
          mensagens: corpo.data.mensagens,
          nomeUsuario: perfil?.nome_completo?.split(" ")[0] ?? null,
          emitir,
          sinal: req.signal,
        });
        emitir({ t: "fim", uso });
        await createAdminClient().from("ai_uso").insert({
          org_id: orgId ?? null, agent_id: agente.id, user_id: user.id, modelo: agente.modelo,
          tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
        });
      } catch (e) {
        if (!req.signal.aborted) {
          console.error("[agente]", e instanceof Error ? e.message : e);
          emitir({ t: "erro", d: "O agente não conseguiu responder agora. Tente novamente em instantes." });
        }
      } finally {
        try { controller.close(); } catch { /* já fechado */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
