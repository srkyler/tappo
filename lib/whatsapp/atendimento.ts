import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarRespostaIA, paraConversaIA, type ResultadoIA } from "@/lib/ai/atendimento";
import { digitando, enviarTexto, idDaMensagem, telefoneDoChat, type Conexao } from "./waha";

/* Regras do inbox: registrar mensagens, achar o lead, distribuir e responder com a IA. */

export type Conversa = {
  id: string;
  org_id: string;
  chat_id: string;
  canal?: string;
  nome: string | null;
  telefone: string | null;
  lead_id: string | null;
  status: "aberta" | "pendente" | "resolvida";
  ia_ativa: boolean;
  nao_lidas: number;
  atribuido_a: string | null;
  aguardando_desde: string | null;
};

const so = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Lead da empresa cujo telefone bate com o do contato (últimos 8 dígitos). */
async function acharLead(db: SupabaseClient, orgId: string, fone: string | null): Promise<string | null> {
  const fim = so(fone).slice(-8);
  if (fim.length < 8) return null;
  const { data } = await db.from("leads").select("id, telefone").eq("org_id", orgId).not("telefone", "is", null).limit(5000);
  return data?.find((l) => so(l.telefone).endsWith(fim))?.id ?? null;
}

/** Forma mínima que qualquer canal (WAHA, Telegram…) precisa ter pra usar distribuir()/conversaDo(). */
export type ConexaoInbox = Pick<Conexao, "org_id" | "user_id" | "distribuicao" | "ia_ativa">;

/** Rodízio: atendente com menos conversas abertas. */
export async function distribuir(db: SupabaseClient, c: ConexaoInbox): Promise<string | null> {
  if (c.distribuicao !== "rodizio") return null;
  const { data } = await db.rpc("proximo_atendente", { org: c.org_id });
  return (data as string | null) ?? null;
}

/** Busca ou cria a conversa do contato (service role). canal: 'whatsapp' (default) | 'telegram' | … */
export async function conversaDo(db: SupabaseClient, c: ConexaoInbox, chatId: string, nome: string | null, canal: string = "whatsapp"): Promise<Conversa> {
  const { data: atual } = await db.from("wa_conversas").select("*").eq("org_id", c.org_id).eq("chat_id", chatId).maybeSingle();
  if (atual) {
    if (nome && !atual.nome) await db.from("wa_conversas").update({ nome }).eq("id", atual.id);
    return atual as Conversa;
  }
  const telefone = telefoneDoChat(chatId);
  // Com IA ligada, a conversa só vai para alguém quando a IA passar o bastão
  const atribuido_a = c.ia_ativa ? null : await distribuir(db, c);
  const { data, error } = await db.from("wa_conversas")
    .upsert({ org_id: c.org_id, user_id: c.user_id, chat_id: chatId, canal, nome, telefone, atribuido_a, lead_id: await acharLead(db, c.org_id, telefone) }, { onConflict: "org_id,chat_id" })
    .select("*").single();
  if (error) throw error;
  return data as Conversa;
}

const resumo = (t: string | null) => (t ?? "").replace(/\s+/g, " ").slice(0, 140);

/** Envia texto pelo WhatsApp e registra no inbox (zera a fila de espera). */
export async function enviarERegistrar(
  db: SupabaseClient, c: Conexao,
  conversa: Pick<Conversa, "id" | "chat_id" | "aguardando_desde">,
  texto: string, autor: "humano" | "ia", enviadoPor: string | null = null,
) {
  const r = await enviarTexto(c, conversa.chat_id, texto);
  const wahaId = idDaMensagem(r);
  const espera = conversa.aguardando_desde ? Math.max(0, Math.round((Date.now() - new Date(conversa.aguardando_desde).getTime()) / 1000)) : null;
  const linha = {
    org_id: c.org_id, user_id: enviadoPor ?? c.user_id, conversa_id: conversa.id, waha_id: wahaId,
    direcao: "saida", autor, corpo: texto, status: "enviada", enviado_por: enviadoPor,
    tempo_resposta_seg: autor === "humano" ? espera : null,
  };
  // O webhook (message.any) pode ter chegado antes: sobrescreve marcando o autor certo
  await (wahaId ? db.from("wa_mensagens").upsert(linha, { onConflict: "org_id,waha_id" }) : db.from("wa_mensagens").insert(linha));
  await db.from("wa_conversas").update({ ultima_mensagem: resumo(texto), ultima_em: new Date().toISOString(), aguardando_desde: null }).eq("id", conversa.id);
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Anti-banimento: a IA nunca responde instantaneamente (parece robô disparando) e
 * nunca manda mais de N mensagens automáticas na mesma conversa num intervalo curto
 * (evita flood que o WhatsApp detecta como spam). Em memória: o Tappo roda num único
 * processo por instância; não precisa de Redis para isso. */
const JANELA_RATE_LIMIT_MS = 60_000;
const MAX_MENSAGENS_IA_POR_JANELA = 3;
const historicoEnviosIA = new Map<string, number[]>();

function podeEnviarIA(conversaId: string): boolean {
  const agora = Date.now();
  const recentes = (historicoEnviosIA.get(conversaId) ?? []).filter((t) => agora - t < JANELA_RATE_LIMIT_MS);
  if (recentes.length >= MAX_MENSAGENS_IA_POR_JANELA) { historicoEnviosIA.set(conversaId, recentes); return false; }
  recentes.push(agora);
  historicoEnviosIA.set(conversaId, recentes);
  return true;
}

const jitter = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

/** IA responde a última mensagem do contato (roda depois do webhook responder). */
export async function responderComIA(db: SupabaseClient, c: Conexao, conversaId: string, mensagemId: string) {
  // Junta rajadas: se o cliente mandar outra mensagem logo depois, só a última dispara resposta
  await espera(3000);
  const { data: conversa } = await db.from("wa_conversas").select("*").eq("id", conversaId).single();
  if (!conversa?.ia_ativa) return;
  const { data: ultima } = await db.from("wa_mensagens").select("id").eq("conversa_id", conversaId).order("created_at", { ascending: false }).limit(1).single();
  if (ultima?.id !== mensagemId) return;

  // Perfil, conhecimento, memória, skills, cota e registro ficam no núcleo (lib/ai/atendimento.ts)
  let digitandoLigado = false;
  let r: ResultadoIA | null;
  try {
    r = await gerarRespostaIA(db, {
      orgId: c.org_id, conversa: paraConversaIA(conversa, "whatsapp"), canal: "whatsapp", instrucoesCanal: c.ia_instrucoes,
      antesDeRodar: async () => { digitandoLigado = true; await digitando(c, conversa.chat_id, true); },
    });
  } finally {
    if (digitandoLigado) await digitando(c, conversa.chat_id, false);
  }
  if (!r) return;

  // A IA respondeu: o relógio de espera só volta a correr se ela passar para um humano
  if (r.texto) {
    if (!podeEnviarIA(conversaId)) {
      // Rajada demais nesta conversa: segura e devolve para um humano decidir (evita banimento por flood)
      await db.from("wa_conversas").update({ status: "pendente", atribuido_a: conversa.atribuido_a ?? (await distribuir(db, c)), aguardando_desde: new Date().toISOString() }).eq("id", conversaId);
    } else {
      await espera(jitter(800, 2500)); // não responde instantâneo como robô
      await enviarERegistrar(db, c, conversa, r.texto, "ia");
    }
  }
  if (r.transferir) {
    const atribuido_a = conversa.atribuido_a ?? (await distribuir(db, c));
    await db.from("wa_conversas").update({ ia_ativa: false, status: "pendente", atribuido_a, aguardando_desde: new Date().toISOString() }).eq("id", conversaId);
  }
}
