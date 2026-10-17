import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo } from "@/lib/ai/agentes";
import { rodarAgente, type Mensagem } from "@/lib/ai/motor";
import { conversaDo, distribuir, type Conversa } from "@/lib/whatsapp/atendimento";
import { digitandoTelegram, enviarTelegram, tokenDa, type ConexaoTelegram } from "./bot";

/*
 * Mesma regra de negócio do inbox do WhatsApp (lib/whatsapp/atendimento.ts), adaptada
 * pro Telegram. Reaproveita conversaDo()/distribuir() de lá (channel-agnostic) em vez
 * de duplicar — mas envio de mensagem e o laço da IA são próprios daqui, porque o
 * Telegram usa sendMessage/chat_id numérico em vez de sendText/chatId do WAHA, e
 * wa_mensagens.waha_id não se aplica (fica null; a constraint aceita NULL sem colidir).
 */

export const conversaTelegramDo = (db: SupabaseClient, c: ConexaoTelegram, chatId: string, nome: string | null) =>
  conversaDo(db, c, chatId, nome, "telegram");

const resumo = (t: string | null) => (t ?? "").replace(/\s+/g, " ").slice(0, 140);

/** Envia texto pelo Telegram e registra no inbox (zera a fila de espera). */
export async function enviarERegistrarTelegram(
  db: SupabaseClient, c: ConexaoTelegram,
  conversa: Pick<Conversa, "id" | "chat_id" | "aguardando_desde">,
  texto: string, autor: "humano" | "ia", enviadoPor: string | null = null,
) {
  const token = tokenDa(c);
  await enviarTelegram(token, conversa.chat_id, texto);
  const espera = conversa.aguardando_desde ? Math.max(0, Math.round((Date.now() - new Date(conversa.aguardando_desde).getTime()) / 1000)) : null;
  await db.from("wa_mensagens").insert({
    org_id: c.org_id, user_id: enviadoPor ?? c.user_id, conversa_id: conversa.id, canal: "telegram",
    direcao: "saida", autor, corpo: texto, status: "enviada", enviado_por: enviadoPor,
    tempo_resposta_seg: autor === "humano" ? espera : null,
  });
  await db.from("wa_conversas").update({ ultima_mensagem: resumo(texto), ultima_em: new Date().toISOString(), aguardando_desde: null }).eq("id", conversa.id);
}

const MARCA_HUMANO = /\[HUMANO\]/gi;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

/* Mesmo anti-flood do WhatsApp (lib/whatsapp/atendimento.ts), em memória e por conversa
 * — duplicado de propósito em vez de importado: o Map do WhatsApp já conta mensagens por
 * conversa_id, e como lá os ids de conversas são globais (não repetem entre canais),
 * importar de lá funcionaria, mas deixaria o Telegram acoplado ao módulo do WAHA sem
 * necessidade. Mantém os dois canais livres pra evoluir sem um quebrar o outro. */
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

/** IA responde a última mensagem do contato no Telegram (roda depois do webhook responder). */
export async function responderComIATelegram(db: SupabaseClient, c: ConexaoTelegram, conversaId: string, mensagemId: string) {
  await espera(3000); // junta rajadas: só a última mensagem do cliente dispara resposta
  const { data: conversa } = await db.from("wa_conversas").select("*").eq("id", conversaId).single();
  if (!conversa?.ia_ativa) return;
  const { data: ultima } = await db.from("wa_mensagens").select("id").eq("conversa_id", conversaId).order("created_at", { ascending: false }).limit(1).single();
  if (ultima?.id !== mensagemId) return;

  const agente = await agenteAtivo().catch(() => null);
  if (!agente) return;
  if (agente.teto_tokens_mes) {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: usados } = await db.rpc("ai_tokens_usados", { agente: agente.id, desde: inicioMes });
    if (Number(usados ?? 0) >= agente.teto_tokens_mes) return;
  }

  const { data: hist } = await db.from("wa_mensagens").select("direcao, corpo")
    .eq("conversa_id", conversaId).not("corpo", "is", null)
    .order("created_at", { ascending: false }).limit(agente.max_historico);
  const mensagens: Mensagem[] = [];
  for (const m of (hist ?? []).reverse()) {
    const role = m.direcao === "entrada" ? "user" : "assistant";
    const ant = mensagens[mensagens.length - 1];
    if (ant?.role === role) ant.content += `\n${m.corpo}`;
    else mensagens.push({ role, content: m.corpo as string });
  }
  if (mensagens[mensagens.length - 1]?.role !== "user") return;

  const token = tokenDa(c);
  await digitandoTelegram(token, conversa.chat_id);
  let texto = "";
  let falhou = false;
  try {
    const uso = await rodarAgente({
      agente,
      sb: null,
      mensagens,
      nomeUsuario: conversa.nome,
      modo: "atendimento",
      instrucoesExtras: c.ia_instrucoes,
      emitir: (e) => { if (e.t === "texto") texto += e.d; },
    });
    await db.from("ai_uso").insert({
      org_id: c.org_id, agent_id: agente.id, user_id: c.user_id, modelo: agente.modelo,
      tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
    });
  } catch {
    falhou = true; // se a IA falhar, a conversa fica como está — sem resposta travada
  }
  if (falhou) return;

  const passarParaHumano = /\[HUMANO\]/i.test(texto);
  texto = texto.replace(MARCA_HUMANO, "").trim();
  if (texto) {
    if (!podeEnviarIA(conversaId)) {
      await db.from("wa_conversas").update({ status: "pendente", atribuido_a: conversa.atribuido_a ?? (await distribuir(db, c)), aguardando_desde: new Date().toISOString() }).eq("id", conversaId);
    } else {
      await espera(jitter(800, 2500));
      await enviarERegistrarTelegram(db, c, conversa, texto, "ia");
    }
  }
  if (passarParaHumano) {
    const atribuido_a = conversa.atribuido_a ?? (await distribuir(db, c));
    await db.from("wa_conversas").update({ ia_ativa: false, status: "pendente", atribuido_a, aguardando_desde: new Date().toISOString() }).eq("id", conversaId);
  }
}
