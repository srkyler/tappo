import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarErro } from "@/lib/erros";

/*
 * Fila de jobs (tabela jobs). enfileirar() grava; processarFila() pega os vencidos
 * com SKIP LOCKED (dois processos nunca rodam o mesmo), executa e, se falhar, volta
 * para a fila com espera exponencial (30 s, 1 min, 2 min…) até max_tentativas.
 * Quem consome: o agendador (tarefa "fila", a cada minuto) e o webhook, logo depois
 * de enfileirar (para áudio não esperar o próximo minuto).
 */

export type Job = { id: string; tipo: string; org_id: string | null; payload: Record<string, unknown>; tentativas: number; max_tentativas: number };
export type Executor = (db: SupabaseClient, job: Job) => Promise<void>;

const executores = new Map<string, Executor>();

/** Registra quem executa um tipo de job (chamado no carregamento de lib/jobs/tipos.ts). */
export function registrarExecutor(tipo: string, fn: Executor) {
  executores.set(tipo, fn);
}

export async function enfileirar(db: SupabaseClient, j: {
  tipo: string; orgId?: string | null; payload?: Record<string, unknown>;
  /** Idempotência: mesma chave = mesmo trabalho (ignorado se já existe). */
  chave?: string; em?: Date; maxTentativas?: number;
}): Promise<boolean> {
  const { error } = await db.from("jobs").insert({
    tipo: j.tipo, org_id: j.orgId ?? null, payload: j.payload ?? {}, chave: j.chave ?? null,
    executar_em: (j.em ?? new Date()).toISOString(), max_tentativas: j.maxTentativas ?? 5,
  });
  if (error && error.code !== "23505") throw error;
  return !error;
}

export async function processarFila(db: SupabaseClient, limite = 10) {
  const { data, error } = await db.rpc("jobs_pegar", { limite });
  if (error) throw error;
  const resumo = { pegos: (data ?? []).length, feitos: 0, retentar: 0, falharam: 0 };
  for (const job of (data ?? []) as Job[]) {
    const fn = executores.get(job.tipo);
    try {
      if (!fn) throw new Error(`Sem executor para o tipo "${job.tipo}"`);
      await fn(db, job);
      await db.from("jobs").update({ status: "feito", erro: null, updated_at: new Date().toISOString() }).eq("id", job.id);
      resumo.feitos++;
    } catch (e) {
      const erro = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      const desistir = job.tentativas >= job.max_tentativas;
      await db.from("jobs").update({
        status: desistir ? "falhou" : "pendente",
        erro,
        executar_em: new Date(Date.now() + 30_000 * 2 ** Math.max(0, job.tentativas - 1)).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (desistir) { resumo.falharam++; await registrarErro(`job:${job.tipo}`, e, { orgId: job.org_id, detalhe: { job: job.id } }); }
      else resumo.retentar++;
    }
  }
  return resumo;
}
