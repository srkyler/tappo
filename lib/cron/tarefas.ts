import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processarFila } from "@/lib/jobs/fila";
import { rodarFollowups, sugerirFaqs } from "@/lib/ai/automacoes-ia";
import "@/lib/jobs/tipos";
import { gerarTarefasRecorrentes } from "@/lib/tarefas/recorrentes";
import {
  ErroWaha, iniciarSessao, lerSessao, religarSessao, sessaoConfigurada, wahaServidorPronto, type Conexao,
} from "@/lib/whatsapp/waha";

/*
 * Tarefas do agendador (/api/v1/cron/*). Cada uma recebe o cliente admin e
 * devolve um resumo (vai para cron_execucoes.detalhe). `aCadaMin` = de quantos
 * em quantos minutos o "tick" a dispara.
 */

export type Tarefa = { aCadaMin: number; rodar: (db: SupabaseClient) => Promise<Record<string, unknown>> };

/** Religar no máximo isto por episódio de queda; depois espera alguém olhar (evita loop). */
const MAX_RELIGADAS = 3;

/*
 * Vigia das sessões do WhatsApp. O webhook session.status avisa em segundos,
 * mas emudece justamente quando o transporte morre — o vigia PERGUNTA, então
 * enxerga o silêncio (padrão DeskcommCRM: cron/channel-health).
 *  - WORKING sem o webhook certo (sessão antiga, sem HMAC/ack) → reconfigura.
 *  - STOPPED/FAILED → religa (até MAX_RELIGADAS seguidas).
 *  - SCAN_QR_CODE → só registra: precisa de alguém com o celular.
 */
async function whatsappSaude(db: SupabaseClient) {
  if (!wahaServidorPronto()) return { pulada: "WAHA não configurado" };
  const { data, error } = await db.from("wa_conexoes").select("*");
  if (error) throw error;
  const resumo = { total: data?.length ?? 0, conectadas: 0, reconfiguradas: 0, religadas: 0, aguardando_qr: 0, erros: 0 };

  for (const linha of data ?? []) {
    const c = linha as Conexao & { religadas?: number };
    const agora = new Date().toISOString();
    try {
      let s: Awaited<ReturnType<typeof lerSessao>> | null = null;
      try { s = await lerSessao(c); } catch (e) { if (!(e instanceof ErroWaha && e.status === 404)) throw e; }
      const status = s?.status ?? "STOPPED";
      const numero = s?.me?.id?.split("@")[0] ?? null;
      const mudanca: Record<string, unknown> = { verificado_em: agora };
      if (status !== c.status) Object.assign(mudanca, { status, status_em: agora });
      if (numero && numero !== c.numero) mudanca.numero = numero;

      if (status === "WORKING") {
        resumo.conectadas++;
        mudanca.religadas = 0;
        if (s && !sessaoConfigurada(c, s)) { await iniciarSessao(c); resumo.reconfiguradas++; }
      } else if (status === "SCAN_QR_CODE") {
        resumo.aguardando_qr++;
      } else if ((status === "STOPPED" || status === "FAILED") && (c.religadas ?? 0) < MAX_RELIGADAS && c.numero) {
        // Só religa quem já esteve conectado (tem número); conexão nunca pareada fica parada
        if (s) await religarSessao(c); else await iniciarSessao(c);
        mudanca.religadas = (c.religadas ?? 0) + 1;
        resumo.religadas++;
      }
      await db.from("wa_conexoes").update(mudanca).eq("id", c.id);
    } catch (e) {
      resumo.erros++;
      console.error("[cron:whatsapp-saude]", c.id, e instanceof Error ? e.message : e);
    }
  }
  return resumo;
}

/** Histórico do agendador: guarda 30 dias. */
async function limparExecucoes(db: SupabaseClient) {
  const corte = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count } = await db.from("cron_execucoes").delete({ count: "exact" }).lt("inicio", corte);
  // Jobs concluídos também saem depois de 30 dias (os que falharam ficam para análise)
  const { count: jobs } = await db.from("jobs").delete({ count: "exact" }).eq("status", "feito").lt("updated_at", corte);
  return { apagadas: count ?? 0, jobs_apagados: jobs ?? 0 };
}

export const TAREFAS: Record<string, Tarefa> = {
  fila: { aCadaMin: 1, rodar: (db) => processarFila(db, 25) },
  "whatsapp-saude": { aCadaMin: 5, rodar: whatsappSaude },
  "ia-followup": { aCadaMin: 30, rodar: rodarFollowups },
  "tarefas-recorrentes": { aCadaMin: 15, rodar: gerarTarefasRecorrentes },
  "ia-sugerir-faq": { aCadaMin: 1440, rodar: sugerirFaqs },
  "limpar-execucoes": { aCadaMin: 1440, rodar: limparExecucoes },
};
