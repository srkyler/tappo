import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo, type Agente } from "./agentes";
import { rodarAgente, type Evento, type Mensagem } from "./motor";
import {
  buscarConhecimento, chaveDoContato, memoriasDoContexto, perfilDaEmpresa, perguntasQualificacao,
  promptAtendimentoEstavel, promptAtendimentoVolatil, type CanalIA, type Trecho,
} from "./assistente";
import { ferramentasAtendimento, type ConversaIA, type RegistroExecucao } from "./ferramentas-atendimento";

/*
 * Núcleo do atendimento por IA — o mesmo para WhatsApp, Telegram, e-mail e o teste em
 * /app/assistente. Cada canal cuida só de enviar a resposta e aplicar o próprio
 * anti-flood; aqui ficam: cota (plataforma + empresa), contexto da empresa, skills,
 * transferência para humano e registro de uso/execução.
 * Sempre com a service role (webhooks não têm sessão): todo acesso filtra org_id.
 */

const MARCA_HUMANO = /\[HUMANO\]/gi;

/** Bloqueio por limite/admin — a única falha cuja mensagem pode ir para o cliente. */
export class IABloqueada extends Error {}

export type ResultadoIA = { texto: string; transferir: boolean; motivo: string | null; fontes: string[] };

/** Linha de wa_conversas → formato que as ferramentas do atendimento usam. */
export function paraConversaIA(c: {
  id: string; user_id: string; chat_id: string; canal?: string | null; nome: string | null;
  telefone: string | null; lead_id: string | null; atribuido_a: string | null;
}, canal: CanalIA): ConversaIA {
  return { id: c.id, user_id: c.user_id, chat_id: c.chat_id, canal: c.canal ?? canal, nome: c.nome, telefone: c.telefone, lead_id: c.lead_id, atribuido_a: c.atribuido_a };
}

const inicioDoMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };

/** Motivo do bloqueio, ou null se a IA pode responder. Limites são definidos só pelo admin. */
export async function motivoBloqueio(db: SupabaseClient, agente: Agente, orgId: string): Promise<string | null> {
  const desde = inicioDoMes();
  const [{ data: limite }, plataforma] = await Promise.all([
    db.from("ia_limites_org").select("teto_tokens_mes, bloqueado").eq("org_id", orgId).maybeSingle(),
    agente.teto_tokens_mes ? db.rpc("ai_tokens_usados", { agente: agente.id, desde }) : Promise.resolve({ data: 0 }),
  ]);
  if (limite?.bloqueado) return "A IA está desativada para esta empresa pelo administrador da plataforma.";
  if (agente.teto_tokens_mes && Number(plataforma.data ?? 0) >= agente.teto_tokens_mes) return "Limite mensal de uso da IA da plataforma atingido.";
  if (limite?.teto_tokens_mes) {
    const { data: usados } = await db.rpc("ia_tokens_org", { org: orgId, desde });
    if (Number(usados ?? 0) >= limite.teto_tokens_mes) return "Limite mensal de uso da IA desta empresa atingido.";
  }
  return null;
}

/** Últimas mensagens da conversa no formato do motor (agrupa mensagens seguidas do mesmo lado). */
export async function historicoDaConversa(db: SupabaseClient, conversaId: string, max: number): Promise<Mensagem[]> {
  const { data: hist } = await db.from("wa_mensagens").select("direcao, corpo")
    .eq("conversa_id", conversaId).not("corpo", "is", null)
    .order("created_at", { ascending: false }).limit(max);
  const mensagens: Mensagem[] = [];
  for (const m of (hist ?? []).reverse()) {
    const role = m.direcao === "entrada" ? "user" : "assistant";
    const ant = mensagens[mensagens.length - 1];
    if (ant?.role === role) ant.content += `\n${m.corpo}`;
    else mensagens.push({ role, content: m.corpo as string });
  }
  return mensagens;
}

export async function gerarRespostaIA(db: SupabaseClient, p: {
  orgId: string;
  conversa: ConversaIA;
  canal: CanalIA;
  instrucoesCanal?: string | null;
  /** Teste: histórico vem do cliente e as ferramentas não gravam nada. */
  mensagens?: Mensagem[];
  teste?: boolean;
  emitir?: (e: Evento) => void;
  sinal?: AbortSignal;
  /** Chamado depois das validações, logo antes de rodar a IA (ex.: "digitando…"). */
  antesDeRodar?: () => Promise<unknown>;
}): Promise<ResultadoIA | null> {
  const agente = await agenteAtivo().catch(() => null);
  if (!agente) return null;
  const teste = !!p.teste;

  const bloqueio = await motivoBloqueio(db, agente, p.orgId);
  if (bloqueio) {
    if (teste) throw new IABloqueada(bloqueio);
    return null;
  }

  const mensagens = p.mensagens ?? (p.conversa.id ? await historicoDaConversa(db, p.conversa.id, agente.max_historico) : []);
  const ultima = mensagens[mensagens.length - 1];
  if (ultima?.role !== "user") return null;

  const contato = chaveDoContato(p.conversa.telefone, p.conversa.chat_id);
  const [perfil, { data: org }, memorias, trechos] = await Promise.all([
    perfilDaEmpresa(db, p.orgId),
    db.from("organizacoes").select("nome, segmento").eq("id", p.orgId).single(),
    memoriasDoContexto(db, p.orgId, teste ? null : contato),
    // RAG proativo: os trechos mais relevantes para a última mensagem já vão no contexto
    buscarConhecimento(db, ultima.content, p.orgId, 3).catch((): Trecho[] => []),
  ]);
  const segmento = org?.segmento ?? "geral";
  const qualificacao = perfil.usar_qualificacao ? await perguntasQualificacao(db, p.orgId, segmento) : [];
  const ligadas = { lead: perfil.pode_criar_lead, tarefa: perfil.pode_criar_tarefa, memoria: perfil.aprender_contatos };

  const registro: RegistroExecucao = { ferramentas: [], conhecimento: new Map(trechos.map((t) => [t.conhecimento_id, t.titulo])), transferir: null };
  const ferramentas = ferramentasAtendimento({ db, orgId: p.orgId, conversa: p.conversa, contato, teste, ligadas, registro });
  const sistema = {
    estavel: promptAtendimentoEstavel({
      perfil, nomeEmpresa: org?.nome ?? "a empresa", segmento, canal: p.canal, qualificacao,
      instrucoesPlataforma: agente.instrucoes, instrucoesCanal: p.instrucoesCanal, ferramentas: ligadas,
    }),
    volatil: promptAtendimentoVolatil({
      perfil, nomeCliente: p.conversa.nome, clienteCadastrado: !!p.conversa.lead_id, memorias, trechos,
    }),
  };

  await p.antesDeRodar?.();
  const inicio = Date.now();
  let texto = "";
  let erro: string | null = null;
  let tokens = 0;
  try {
    const uso = await rodarAgente({
      agente, sb: null, mensagens, nomeUsuario: p.conversa.nome, sistema, ferramentas, sinal: p.sinal,
      emitir: (e) => { if (e.t === "texto") texto += e.d; p.emitir?.(e); },
    });
    tokens = uso.entrada + uso.saida;
    await db.from("ai_uso").insert({
      org_id: p.orgId, agent_id: agente.id, user_id: p.conversa.user_id, modelo: agente.modelo,
      tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
    });
  } catch (e) {
    // O gestor vê ia_execucoes: detalhe do provedor/modelo fica só no log do servidor
    console.error("[ia/atendimento]", p.orgId, e instanceof Error ? e.message : e);
    erro = "A IA não conseguiu gerar a resposta.";
  }

  const transferir = !!registro.transferir || /\[HUMANO\]/i.test(texto);
  texto = texto.replace(MARCA_HUMANO, "").trim();
  const motivo = registro.transferir?.motivo ?? (transferir ? "A IA pediu um atendente humano." : null);
  const idsConhecimento = [...registro.conhecimento.keys()];

  // Auditoria (best-effort: nunca derruba o atendimento)
  await db.from("ia_execucoes").insert({
    org_id: p.orgId, conversa_id: p.conversa.id, canal: p.canal, teste, agent_id: agente.id,
    pergunta: ultima.content.slice(0, 2000), resposta: texto.slice(0, 4000) || null,
    ferramentas: registro.ferramentas, conhecimento_ids: idsConhecimento,
    transferiu: transferir, motivo, tokens, ms: Date.now() - inicio, erro,
  }).then(() => null, () => null);
  if (!teste && idsConhecimento.length) {
    await db.rpc("ia_registrar_uso_conhecimento", { ids: idsConhecimento }).then(() => null, () => null);
  }

  if (erro) {
    if (teste) throw new Error(erro);
    return null; // a conversa fica como está — sem resposta travada
  }
  const fontes = [...new Set(registro.conhecimento.values())];
  p.emitir?.({ t: "meta", transferiu: transferir, motivo, fontes });
  return { texto, transferir, motivo, fontes };
}
