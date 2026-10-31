import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo } from "@/lib/ai/agentes";
import { segredoHmac, wahaServidorPronto } from "@/lib/whatsapp/waha";

/*
 * Checagem de saúde: o que precisa estar de pé para o Tappo atender. Usada no
 * /admin (detalhada) e em /api/health (só ok/falha, sem detalhe).
 */

export type ItemSaude = { nome: string; estado: "ok" | "aviso" | "falha"; detalhe: string };

/** Tabelas que as últimas migrations criam — faltando = migration não rodou no Supabase. */
const TABELAS = {
  ia_perfil: "20261031000000_assistente_ia_empresa",
  cron_execucoes: "20261031120000_waha_profissional_agendador",
  ia_atendentes: "20261101000000_atendentes_ia",
  jobs: "20261101120000_fila_midia",
};

async function wahaResponde(): Promise<boolean> {
  const base = (process.env.WAHA_BASE_URL || (process.env.WAHA_DOMAIN ? `https://${process.env.WAHA_DOMAIN}` : "")).replace(/\/+$/, "");
  if (!base) return false;
  try {
    const r = await fetch(`${base}/ping`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function verificarSaude(db: SupabaseClient): Promise<ItemSaude[]> {
  const itens: ItemSaude[] = [];

  const { error: erroBanco } = await db.from("organizacoes").select("id", { head: true, count: "exact" });
  itens.push({ nome: "Banco de dados", estado: erroBanco ? "falha" : "ok", detalhe: erroBanco ? erroBanco.message : "Supabase respondendo" });

  const faltando: string[] = [];
  for (const [tabela, migration] of Object.entries(TABELAS)) {
    const { error } = await db.from(tabela).select("*", { head: true, count: "exact" });
    if (error) faltando.push(migration);
  }
  itens.push({
    nome: "Migrations",
    estado: faltando.length ? "falha" : "ok",
    detalhe: faltando.length ? `Rodar no SQL Editor: ${faltando.join(", ")}` : "Todas aplicadas",
  });

  const agente = await agenteAtivo().catch(() => null);
  itens.push({
    nome: "IA da plataforma",
    estado: agente ? "ok" : "falha",
    detalhe: agente ? `Agente ativo: ${agente.nome} (${agente.modelo})` : "Nenhum agente ativo — a IA não responde ninguém",
  });

  if (!wahaServidorPronto()) {
    itens.push({ nome: "WhatsApp (WAHA)", estado: "aviso", detalhe: "WAHA_BASE_URL / WAHA_DOMAIN não definido no .env" });
  } else {
    const vivo = await wahaResponde();
    const { data: conexoes } = await db.from("wa_conexoes").select("status");
    const conectadas = (conexoes ?? []).filter((c) => c.status === "WORKING").length;
    itens.push({
      nome: "WhatsApp (WAHA)",
      estado: !vivo ? "falha" : conectadas < (conexoes?.length ?? 0) ? "aviso" : "ok",
      detalhe: vivo ? `${conectadas} de ${conexoes?.length ?? 0} número(s) conectado(s)` : "WAHA não responde ao /ping",
    });
    itens.push({
      nome: "Assinatura dos webhooks",
      estado: segredoHmac() ? "ok" : "aviso",
      detalhe: segredoHmac() ? "WAHA_HMAC_SECRET definido" : "Defina WAHA_HMAC_SECRET (qualquer um que saiba a URL consegue injetar mensagens)",
    });
  }

  const { data: ultima } = await db.from("cron_execucoes").select("inicio, ok").order("inicio", { ascending: false }).limit(1).maybeSingle();
  const minutos = ultima ? Math.round((Date.now() - new Date(ultima.inicio).getTime()) / 60_000) : null;
  itens.push({
    nome: "Agendador",
    estado: !process.env.CRON_SECRET ? "falha" : minutos === null || minutos > 10 ? "aviso" : "ok",
    detalhe: !process.env.CRON_SECRET
      ? "CRON_SECRET não definido no .env"
      : minutos === null ? "Nunca rodou (serviço agendador do docker-compose está de pé?)" : `Última rodada há ${minutos} min`,
  });

  return itens;
}
