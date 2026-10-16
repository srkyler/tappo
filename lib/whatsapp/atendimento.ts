import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo } from "@/lib/ai/agentes";
import { rodarAgente, type Mensagem } from "@/lib/ai/motor";
import { digitando, enviarTexto, idDaMensagem, telefoneDoChat, type Conexao } from "./waha";

/* Regras do inbox: registrar mensagens, achar o lead e responder com a IA. */

export type Conversa = {
  id: string;
  user_id: string;
  chat_id: string;
  nome: string | null;
  telefone: string | null;
  lead_id: string | null;
  status: "aberta" | "pendente" | "resolvida";
  ia_ativa: boolean;
  nao_lidas: number;
};

const so = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Lead do dono cujo telefone bate com o do contato (últimos 8 dígitos). */
async function acharLead(db: SupabaseClient, userId: string, fone: string | null): Promise<string | null> {
  const fim = so(fone).slice(-8);
  if (fim.length < 8) return null;
  const { data } = await db.from("leads").select("id, telefone").eq("user_id", userId).not("telefone", "is", null).limit(5000);
  return data?.find((l) => so(l.telefone).endsWith(fim))?.id ?? null;
}

/** Busca ou cria a conversa do contato. */
export async function conversaDo(db: SupabaseClient, userId: string, chatId: string, nome: string | null): Promise<Conversa> {
  const { data: atual } = await db.from("wa_conversas").select("*").eq("user_id", userId).eq("chat_id", chatId).maybeSingle();
  if (atual) {
    if (nome && !atual.nome) await db.from("wa_conversas").update({ nome }).eq("id", atual.id);
    return atual as Conversa;
  }
  const telefone = telefoneDoChat(chatId);
  const { data, error } = await db.from("wa_conversas")
    .upsert({ user_id: userId, chat_id: chatId, nome, telefone, lead_id: await acharLead(db, userId, telefone) }, { onConflict: "user_id,chat_id" })
    .select("*").single();
  if (error) throw error;
  return data as Conversa;
}

const resumo = (t: string | null) => (t ?? "").replace(/\s+/g, " ").slice(0, 140);

/** Envia texto pelo WhatsApp e registra no inbox. */
export async function enviarERegistrar(db: SupabaseClient, c: Conexao, conversa: Pick<Conversa, "id" | "chat_id">, texto: string, autor: "humano" | "ia") {
  const r = await enviarTexto(c, conversa.chat_id, texto);
  const wahaId = idDaMensagem(r);
  const linha = { user_id: c.user_id, conversa_id: conversa.id, waha_id: wahaId, direcao: "saida", autor, corpo: texto, status: "enviada" };
  // O webhook (message.any) pode ter chegado antes: sobrescreve marcando o autor certo
  await (wahaId ? db.from("wa_mensagens").upsert(linha, { onConflict: "user_id,waha_id" }) : db.from("wa_mensagens").insert(linha));
  await db.from("wa_conversas").update({ ultima_mensagem: resumo(texto), ultima_em: new Date().toISOString() }).eq("id", conversa.id);
}

const MARCA_HUMANO = /\[HUMANO\]/gi;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** IA responde a última mensagem do contato (roda depois do webhook responder). */
export async function responderComIA(db: SupabaseClient, c: Conexao, conversaId: string, mensagemId: string) {
  // Junta rajadas: se o cliente mandar outra mensagem logo depois, só a última dispara resposta
  await espera(3000);
  const { data: conversa } = await db.from("wa_conversas").select("*").eq("id", conversaId).single();
  if (!conversa?.ia_ativa) return;
  const { data: ultima } = await db.from("wa_mensagens").select("id, direcao").eq("conversa_id", conversaId).order("created_at", { ascending: false }).limit(1).single();
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

  await digitando(c, conversa.chat_id, true);
  let texto = "";
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
      agent_id: agente.id, user_id: c.user_id, modelo: agente.modelo,
      tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
    });
  } finally {
    await digitando(c, conversa.chat_id, false);
  }

  const passarParaHumano = /\[HUMANO\]/i.test(texto);
  texto = texto.replace(MARCA_HUMANO, "").trim();
  if (texto) await enviarERegistrar(db, c, conversa, texto, "ia");
  if (passarParaHumano) await db.from("wa_conversas").update({ ia_ativa: false, status: "pendente" }).eq("id", conversaId);
}
