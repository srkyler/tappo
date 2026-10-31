import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarRespostaIA, paraConversaIA } from "@/lib/ai/atendimento";

/*
 * Canal de e-mail do inbox (wa_conversas/wa_mensagens com canal='email').
 * Espelha lib/whatsapp/atendimento.ts, mas sem o anti-ban de WhatsApp (e-mail não
 * tem risco de banimento por flood) — em troca, tem proteção contra loop de
 * autoresposta (dois robôs respondendo um ao outro em cadeia infinita).
 *
 * A chave do Resend é ÚNICA e global do servidor (RESEND_API_KEY no .env) — não é
 * por-organização como a do WAHA. email_conexoes só guarda o endereço de
 * recebimento/envio e as instruções da IA, nunca uma chave de API.
 */

export type EmailConexao = {
  id: string;
  org_id: string;
  endereco_recebe: string | null;
  endereco_envia: string | null;
  webhook_secret: string;
  ia_ativa: boolean;
  ia_instrucoes: string;
};

type ConversaEmail = {
  id: string;
  org_id: string;
  chat_id: string; // e-mail do contato, minúsculo
  nome: string | null;
  lead_id: string | null;
  status: "aberta" | "pendente" | "resolvida";
  ia_ativa: boolean;
  atribuido_a: string | null;
  aguardando_desde: string | null;
  nao_lidas: number;
};

/** Lead da empresa cujo e-mail bate com o do contato. */
async function acharLeadPorEmail(db: SupabaseClient, orgId: string, email: string): Promise<string | null> {
  const { data } = await db.from("leads").select("id").eq("org_id", orgId).ilike("email", email).maybeSingle();
  return data?.id ?? null;
}

/** Busca ou cria a conversa do contato por e-mail (canal='email', service role). */
export async function conversaEmailDe(db: SupabaseClient, econexao: EmailConexao, remetente: string, nome: string | null): Promise<ConversaEmail> {
  const chatId = remetente.trim().toLowerCase();
  const { data: atual } = await db.from("wa_conversas").select("*").eq("org_id", econexao.org_id).eq("canal", "email").eq("chat_id", chatId).maybeSingle();
  if (atual) {
    if (nome && !atual.nome) await db.from("wa_conversas").update({ nome }).eq("id", atual.id);
    return atual as ConversaEmail;
  }
  const { data, error } = await db.from("wa_conversas")
    .upsert({
      org_id: econexao.org_id, canal: "email", chat_id: chatId, nome,
      lead_id: await acharLeadPorEmail(db, econexao.org_id, chatId),
    }, { onConflict: "org_id,chat_id" })
    .select("*").single();
  if (error) throw error;
  return data as ConversaEmail;
}

const resumo = (t: string | null) => (t ?? "").replace(/\s+/g, " ").slice(0, 140);

function assuntoResposta(assuntoOriginal: string | null): string {
  const base = assuntoOriginal?.trim() || "Sua mensagem";
  return /^re:/i.test(base) ? base : `Re: ${base}`;
}

/** Envia um e-mail de resposta da conversa e registra em wa_mensagens. */
export async function enviarEmailERegistrar(
  db: SupabaseClient, econexao: EmailConexao,
  conversa: Pick<ConversaEmail, "id" | "chat_id" | "aguardando_desde">,
  assuntoOriginal: string | null, texto: string, autor: "humano" | "ia", enviadoPor: string | null = null,
) {
  if (!process.env.RESEND_API_KEY) throw new Error("Envio de e-mail não configurado (RESEND_API_KEY ausente no servidor).");
  if (!econexao.endereco_envia) throw new Error("Configure o endereço de envio do e-mail primeiro.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: econexao.endereco_envia,
    to: conversa.chat_id,
    subject: assuntoResposta(assuntoOriginal),
    text: texto,
  });
  if (error) throw new Error(error.message);

  const espera = conversa.aguardando_desde ? Math.max(0, Math.round((Date.now() - new Date(conversa.aguardando_desde).getTime()) / 1000)) : null;
  await db.from("wa_mensagens").insert({
    org_id: econexao.org_id, user_id: enviadoPor, conversa_id: conversa.id, canal: "email",
    direcao: "saida", autor, tipo: "texto", corpo: texto, status: "enviada",
    enviado_por: enviadoPor, tempo_resposta_seg: autor === "humano" ? espera : null,
  });
  await db.from("wa_conversas").update({ ultima_mensagem: resumo(texto), ultima_em: new Date().toISOString(), aguardando_desde: null }).eq("id", conversa.id);
}


// Mesma ideia do rate-limit do WhatsApp, mas isolada aqui: não é sobre banimento,
// é só pra nunca deixar a IA entrar num loop de "Re:" automático sem fim.
const JANELA_MS = 5 * 60_000;
const MAX_RESPOSTAS_IA_NA_JANELA = 3;
const historico = new Map<string, number[]>();
function podeResponderIA(conversaId: string): boolean {
  const agora = Date.now();
  const recentes = (historico.get(conversaId) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= MAX_RESPOSTAS_IA_NA_JANELA) { historico.set(conversaId, recentes); return false; }
  recentes.push(agora);
  historico.set(conversaId, recentes);
  return true;
}

/** IA responde ao último e-mail do contato (roda depois do webhook responder 200). */
export async function responderComIAEmail(db: SupabaseClient, econexao: EmailConexao, conversaId: string, mensagemId: string, assuntoOriginal: string | null) {
  const { data: conversa } = await db.from("wa_conversas").select("*").eq("id", conversaId).single();
  if (!conversa?.ia_ativa) return;
  const { data: ultima } = await db.from("wa_mensagens").select("id").eq("conversa_id", conversaId).order("created_at", { ascending: false }).limit(1).single();
  if (ultima?.id !== mensagemId) return;
  if (!podeResponderIA(conversaId)) return; // guarda contra loop de autoresposta

  const r = await gerarRespostaIA(db, {
    orgId: econexao.org_id, conversa: paraConversaIA(conversa, "email"), canal: "email", instrucoesCanal: econexao.ia_instrucoes,
    atendenteCanalId: (econexao as { atendente_id?: string | null }).atendente_id,
  });
  if (!r) return;
  if (r.texto) await enviarEmailERegistrar(db, econexao, conversa, assuntoOriginal, r.texto, "ia");
  if (r.transferir) {
    await db.from("wa_conversas").update({ ia_ativa: false, status: "pendente", aguardando_desde: new Date().toISOString() }).eq("id", conversaId);
  }
}
