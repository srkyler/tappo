import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agenteAtivo } from "@/lib/ai/agentes";
import { rodarAgente, type Evento } from "@/lib/ai/motor";

/* POST /api/jarvis — assistente de configuração do Tappo. Mesmo motor do
 * agente principal, modo "jarvis" (ferramentas de configuração, não de
 * dados de CRM). NDJSON, igual /api/agente. */

const Corpo = z.object({
  mensagens: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(12000),
  })).min(1).max(80),
});

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
  if (!agente) return json(503, "Nenhum agente de IA está ativo. Peça ao administrador para ativar um em /admin.");

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
          modo: "jarvis",
          emitir,
          sinal: req.signal,
        });
        emitir({ t: "fim", uso });
        await createAdminClient().from("ai_uso").insert({
          agent_id: agente.id, user_id: user.id, modelo: agente.modelo,
          tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
        });
      } catch (e) {
        if (!req.signal.aborted) {
          console.error("[jarvis]", e instanceof Error ? e.message : e);
          emitir({ t: "erro", d: "O Jarvis não conseguiu responder agora. Tente novamente em instantes." });
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
