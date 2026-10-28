import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Webhooks de SAÍDA do Tappo — o Tappo faz POST assinado (HMAC-SHA256) para
 * URLs configuradas pela empresa. Assinatura no header `x-tappo-assinatura`
 * (hex), evento no `x-tappo-evento`, corpo JSON { evento, dados, enviado_em }.
 * Envio é fire-and-forget: nunca derruba a ação principal; falha vira log.
 */

export const EVENTOS_SAIDA = [
  { id: "lead.criado", rotulo: "Lead criado", dica: "Novo lead entra na base (cadastro, captação, inbox)." },
  { id: "lead.atualizado", rotulo: "Lead atualizado", dica: "Campos do lead alterados." },
  { id: "lead.etapa_mudou", rotulo: "Lead mudou de etapa", dica: "Movido no pipeline." },
  { id: "conversa.nova", rotulo: "Conversa nova", dica: "Primeira mensagem de um contato no inbox." },
  { id: "mensagem.nova", rotulo: "Mensagem recebida", dica: "Mensagem de entrada em qualquer canal." },
] as const;

export type EventoSaida = (typeof EVENTOS_SAIDA)[number]["id"];

type Alvo = { id: string; url: string; secret: string };

/** Assina o corpo com HMAC-SHA256 (mesmo segredo fica no webhook — nunca vai pra tela). */
export function assinarCorpo(corpo: string, secret: string): string {
  return createHmac("sha256", secret).update(corpo, "utf8").digest("hex");
}

/** POST único assinado. Retorna { status, erro } para o log. */
export async function postarWebhook(alvo: { url: string; secret: string }, evento: string, dados: Record<string, unknown>): Promise<{ status: number | null; erro: string | null }> {
  const corpo = JSON.stringify({ evento, dados, enviado_em: new Date().toISOString() });
  try {
    const r = await fetch(alvo.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tappo-evento": evento,
        "x-tappo-assinatura": assinarCorpo(corpo, alvo.secret),
      },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    const texto = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 300);
    return { status: r.status, erro: texto || null };
  } catch (e) {
    return { status: null, erro: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
  }
}

/**
 * Dispara um evento para todos os webhooks ativos da empresa que assinam o evento.
 * `orgId` omitido: resolve via rpc org_atual() (só funciona com client de sessão).
 * Não lança — tudo é capturado e vira linha em webhook_saida_log.
 */
export async function dispararWebhooks(
  db: SupabaseClient,
  orgId: string | null | undefined,
  evento: EventoSaida,
  dados: Record<string, unknown>,
): Promise<void> {
  try {
    let org = orgId ?? null;
    if (!org) {
      const { data } = await db.rpc("org_atual");
      org = (data as string | null) ?? null;
    }
    if (!org) return;

    const { data: alvos } = await db
      .from("webhook_saida")
      .select("id, url, secret")
      .eq("org_id", org)
      .eq("ativo", true)
      .contains("eventos", [evento]);
    if (!alvos?.length) return;

    await Promise.all((alvos as Alvo[]).map(async (a) => {
      const r = await postarWebhook(a, evento, dados);
      await db.from("webhook_saida_log").insert({
        org_id: org,
        webhook_id: a.id,
        evento,
        payload: { evento, dados },
        status: r.status,
        erro: r.erro,
      });
    }));
  } catch (e) {
    console.error("[webhook-saida]", e instanceof Error ? e.message : e);
  }
}
