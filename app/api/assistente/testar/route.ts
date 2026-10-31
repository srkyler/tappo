import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";
import { limitar } from "@/lib/auth/rate-limit";
import { IABloqueada, gerarRespostaIA } from "@/lib/ai/atendimento";
import type { Evento } from "@/lib/ai/motor";

/*
 * POST /api/assistente/testar — simula um cliente conversando com o assistente da empresa.
 * Mesmo núcleo do atendimento real (perfil, conhecimento, memória, skills), mas em modo
 * teste: nada é enviado e as ferramentas não gravam nada. Resposta: NDJSON.
 */

const Corpo = z.object({
  mensagens: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
});

const json = (status: number, erro: string) => Response.json({ erro }, { status });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, "Sessão expirada. Entre novamente.");
  const empresa = await empresaAtual();
  if (!empresa) return json(403, "Empresa não encontrada.");
  if (!ehGestor(empresa.papel)) return json(403, "Só o dono ou um gestor pode testar o assistente.");
  if (!limitar({ acao: "assistente-teste", id: user.id }, 20, 300)) return json(429, "Muitos testes seguidos. Aguarde alguns minutos.");

  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return json(400, "Pedido inválido.");

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitir = (e: Evento) => {
        try { controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`)); } catch { /* cliente saiu */ }
      };
      try {
        const r = await gerarRespostaIA(createAdminClient(), {
          orgId: empresa.id,
          conversa: { id: null, user_id: user.id, chat_id: null, canal: "teste", nome: null, telefone: null, lead_id: null, atribuido_a: null },
          canal: "teste",
          mensagens: corpo.data.mensagens,
          teste: true,
          emitir,
          sinal: req.signal,
        });
        if (!r) emitir({ t: "erro", d: "Nenhum agente de IA está ativo na plataforma no momento." });
      } catch (e) {
        if (!req.signal.aborted) {
          // Detalhes do provedor/modelo ficam só no log do servidor — o cliente não vê
          if (!(e instanceof IABloqueada)) console.error("[assistente/testar]", e instanceof Error ? e.message : e);
          emitir({ t: "erro", d: e instanceof IABloqueada ? e.message : "O assistente não conseguiu responder agora. Tente de novo em instantes." });
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
