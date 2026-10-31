import { createAdminClient } from "@/lib/supabase/admin";
import { iguaisTempoConstante } from "@/lib/auth/rate-limit";
import { TAREFAS } from "@/lib/cron/tarefas";

/*
 * POST /api/v1/cron/<tarefa> — agendador do Tappo.
 *  - `tick`: roda toda tarefa cujo intervalo (aCadaMin) já passou desde a última
 *    execução registrada. O serviço `agendador` do docker-compose chama a cada minuto.
 *  - `<nome>`: força uma tarefa específica (manutenção / teste).
 * Autenticação: header Authorization: Bearer $CRON_SECRET (≥ 16 caracteres).
 * Cada rodada fica em cron_execucoes (início, fim, ok, resumo ou erro).
 */

export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const segredo = (process.env.CRON_SECRET ?? "").trim();
  if (segredo.length < 16) return false;
  const cab = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return iguaisTempoConstante(cab, segredo);
}

export async function POST(req: Request, ctx: { params: Promise<{ tarefa: string }> }) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 });
  const { tarefa } = await ctx.params;
  if (tarefa !== "tick" && !TAREFAS[tarefa]) return Response.json({ ok: false, erro: "Tarefa desconhecida" }, { status: 404 });

  const db = createAdminClient();
  let nomes = [tarefa];
  if (tarefa === "tick") {
    nomes = [];
    for (const [nome, t] of Object.entries(TAREFAS)) {
      const { data: ultima } = await db.from("cron_execucoes").select("inicio")
        .eq("tarefa", nome).order("inicio", { ascending: false }).limit(1).maybeSingle();
      // Folga de 20 s: o tick a cada 60 s não deve pular uma rodada por atraso de relógio
      const vence = !ultima || Date.now() - new Date(ultima.inicio).getTime() >= t.aCadaMin * 60_000 - 20_000;
      if (vence) nomes.push(nome);
    }
  }

  const resultados: Record<string, unknown> = {};
  for (const nome of nomes) {
    const { data: exec } = await db.from("cron_execucoes").insert({ tarefa: nome }).select("id").single();
    try {
      const detalhe = await TAREFAS[nome].rodar(db);
      resultados[nome] = detalhe;
      if (exec) await db.from("cron_execucoes").update({ fim: new Date().toISOString(), ok: true, detalhe }).eq("id", exec.id);
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      resultados[nome] = { erro };
      console.error(`[cron:${nome}]`, erro);
      if (exec) await db.from("cron_execucoes").update({ fim: new Date().toISOString(), ok: false, detalhe: { erro } }).eq("id", exec.id);
    }
  }
  return Response.json({ ok: true, rodou: nomes, resultados });
}
