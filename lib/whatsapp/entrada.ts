import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conversaDo, responderComIA } from "./atendimento";
import type { Conexao } from "./waha";
import { dispararWebhooks } from "@/lib/webhooks/saida";
import { registrarErro } from "@/lib/erros";
import { enfileirar, processarFila } from "@/lib/jobs/fila";
import "@/lib/jobs/tipos";

/*
 * Entrada de uma mensagem do WhatsApp no inbox — igual para WAHA e Cloud API:
 * acha/cria a conversa, grava a mensagem (idempotente pelo id do provedor),
 * atualiza a fila de espera e chama IA / transcrição. Service role, org_id da conexão.
 */

/** ack do WhatsApp → status no Inbox. 4 (áudio reproduzido) conta como lida. */
export const STATUS_DO_ACK: Record<number, string> = { [-1]: "erro", 0: "pendente", 1: "enviada", 2: "entregue", 3: "lida", 4: "lida" };

export type Entrada = {
  id: string;
  chatId: string;
  fromMe: boolean;
  nome: string | null;
  tipo: "texto" | "imagem" | "audio" | "video" | "arquivo";
  corpo: string | null;
  midiaUrl: string | null;
  midiaMime: string | null;
  telefone?: string | null;
  ack?: number | null;
  origem: "waha" | "cloud";
};

/** "ok" = gravada; "duplicado" = retentativa já vista; "erro" = falhou (o provedor deve retentar). */
export async function registrarEntrada(db: SupabaseClient, c: Conexao, e: Entrada): Promise<"ok" | "duplicado" | "erro"> {
  const conversa = await conversaDo(db, c, e.chatId, e.fromMe ? null : e.nome, "whatsapp", e.telefone ?? null);

  const { data: msg, error } = await db.from("wa_mensagens").upsert({
    org_id: c.org_id,
    user_id: c.user_id,
    conversa_id: conversa.id,
    waha_id: e.id,
    direcao: e.fromMe ? "saida" : "entrada",
    autor: e.fromMe ? "celular" : "contato",
    tipo: e.tipo,
    corpo: e.corpo,
    midia_url: e.midiaUrl,
    midia_mime: e.midiaMime,
    ...(e.fromMe && typeof e.ack === "number" && e.ack in STATUS_DO_ACK ? { ack: e.ack, status: STATUS_DO_ACK[e.ack] } : {}),
  }, { onConflict: "org_id,waha_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) {
    console.error(`[${e.origem}]`, error.message);
    return "erro";
  }
  if (!msg) return "duplicado";

  if (!e.fromMe) {
    after(() => dispararWebhooks(db, c.org_id, "mensagem.nova", {
      conversa_id: conversa.id, mensagem_id: msg.id, canal: "whatsapp",
      chat_id: e.chatId, nome: conversa.nome, tipo: e.tipo, corpo: e.corpo,
    }).catch((x) => console.error(`[${e.origem}:webhook]`, x instanceof Error ? x.message : x)));
  }

  const previa = e.corpo ?? `[${e.tipo}]`;
  await db.from("wa_conversas").update({
    ultima_mensagem: previa.replace(/\s+/g, " ").slice(0, 140),
    ultima_em: new Date().toISOString(),
    conexao_id: c.id, // a resposta humana sai pelo número que recebeu
    // Fila: cliente falou e ninguém respondeu ainda → começa a contar o tempo de espera
    ...(e.fromMe
      ? { aguardando_desde: null }
      : {
          nao_lidas: conversa.nao_lidas + 1,
          followups: 0, // cliente voltou a falar: o ciclo de follow-up recomeça
          aguardando_desde: conversa.aguardando_desde ?? new Date().toISOString(),
          ...(conversa.status === "resolvida" ? { status: "aberta" } : {}),
        }),
  }).eq("id", conversa.id);

  const iaAtende = !e.fromMe && c.ia_ativa && conversa.ia_ativa;
  if (iaAtende && e.tipo === "texto" && e.corpo) {
    after(() => responderComIA(db, c, conversa.id, msg.id).catch((x) => registrarErro(`${e.origem}:ia`, x, { orgId: c.org_id })));
  } else if (!e.fromMe && e.tipo !== "texto" && (iaAtende || e.tipo === "audio")) {
    // Áudio/imagem: transcreve ou descreve na fila (com retentativa) e só então a IA responde.
    // Áudio é transcrito mesmo sem IA, para o atendente ler no Inbox.
    after(async () => {
      try {
        await enfileirar(db, {
          tipo: "midia_whatsapp", orgId: c.org_id, chave: `midia:${msg.id}`, maxTentativas: 3,
          payload: { mensagem_id: msg.id, conexao_id: c.id, responder: iaAtende },
        });
        await processarFila(db, 3);
      } catch (x) {
        // Fila indisponível (migration pendente): a IA responde assim mesmo e pede texto
        await registrarErro(`${e.origem}:midia`, x, { orgId: c.org_id });
        if (iaAtende) await responderComIA(db, c, conversa.id, msg.id).catch(() => null);
      }
    });
  }
  return "ok";
}
