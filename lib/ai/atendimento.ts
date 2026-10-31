import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agente } from "./agentes";
import { agenteDoAtendente, atendenteQueResponde, colegasDe, perfilComAtendente } from "./atendentes";
import { registrarErro } from "@/lib/erros";
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
  telefone: string | null; lead_id: string | null; atribuido_a: string | null; atendente_id?: string | null;
}, canal: CanalIA): ConversaIA {
  return {
    id: c.id, user_id: c.user_id, chat_id: c.chat_id, canal: c.canal ?? canal, nome: c.nome, telefone: c.telefone,
    lead_id: c.lead_id, atribuido_a: c.atribuido_a, atendente_id: c.atendente_id ?? null,
  };
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
/** Áudio e imagem viram texto para a IA: a transcrição/descrição, ou um aviso para ela pedir texto. */
export function conteudoDaMensagem(m: { corpo: string | null; tipo?: string | null; transcricao?: string | null }): string | null {
  const legenda = m.corpo?.trim() || "";
  if (m.tipo === "audio") {
    return m.transcricao?.trim()
      ? `[Áudio do cliente, transcrito] ${m.transcricao.trim()}`
      : "[O cliente mandou um áudio que você não consegue ouvir. Peça, com gentileza, que escreva a mensagem.]";
  }
  if (m.tipo === "imagem") {
    const desc = m.transcricao?.trim()
      ? `[Imagem enviada pelo cliente: ${m.transcricao.trim()}]`
      : "[O cliente mandou uma imagem que você não consegue ver. Se precisar dela, peça que descreva por escrito.]";
    return legenda ? `${desc}\n${legenda}` : desc;
  }
  if (m.tipo && m.tipo !== "texto" && !legenda) return `[O cliente mandou um ${m.tipo} que você não consegue abrir.]`;
  return legenda || null;
}

type LinhaHistorico = { direcao: string; corpo: string | null; tipo?: string | null; transcricao?: string | null };

export async function historicoDaConversa(db: SupabaseClient, conversaId: string, max: number): Promise<Mensagem[]> {
  const ler = (campos: string) => db.from("wa_mensagens").select(campos)
    .eq("conversa_id", conversaId).order("created_at", { ascending: false }).limit(max);
  let { data, error } = await ler("direcao, corpo, tipo, transcricao");
  // Banco sem a coluna transcricao (migration 20261101120000 pendente): lê como antes
  if (error) ({ data, error } = await ler("direcao, corpo, tipo"));
  const mensagens: Mensagem[] = [];
  for (const m of ((data ?? []) as unknown as LinhaHistorico[]).reverse()) {
    // Saída só conta com texto; entrada de mídia vira transcrição ou aviso
    const conteudo = m.direcao === "entrada" ? conteudoDaMensagem(m) : m.corpo?.trim() || null;
    if (!conteudo) continue;
    const role = m.direcao === "entrada" ? "user" : "assistant";
    const ant = mensagens[mensagens.length - 1];
    if (ant?.role === role) ant.content += `\n${conteudo}`;
    else mensagens.push({ role, content: conteudo });
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
  /** Atendente de IA do canal/número (wa_conexoes.atendente_id…). */
  atendenteCanalId?: string | null;
  /** Teste: força um atendente específico. */
  atendenteId?: string | null;
}): Promise<ResultadoIA | null> {
  const teste = !!p.teste;
  const atendente = await atendenteQueResponde(db, p.orgId, [p.atendenteId, p.conversa.atendente_id, p.atendenteCanalId]);
  const agente = await agenteDoAtendente(db, atendente);
  if (!agente) {
    await registrarErro("ia/atendimento", "Nenhum agente de IA ativo no /admin — a IA não responde ninguém.", { orgId: p.orgId });
    if (teste) throw new IABloqueada("Nenhum modelo de IA ativo na plataforma. Fale com o administrador.");
    return null;
  }

  const bloqueio = await motivoBloqueio(db, agente, p.orgId);
  if (bloqueio) {
    if (teste) throw new IABloqueada(bloqueio);
    return null;
  }

  const mensagens = p.mensagens ?? (p.conversa.id ? await historicoDaConversa(db, p.conversa.id, agente.max_historico) : []);
  const ultima = mensagens[mensagens.length - 1];
  if (ultima?.role !== "user") return null;

  const contato = chaveDoContato(p.conversa.telefone, p.conversa.chat_id);
  const [perfilEmpresa, { data: org }, memorias, trechos] = await Promise.all([
    perfilDaEmpresa(db, p.orgId),
    db.from("organizacoes").select("nome, segmento").eq("id", p.orgId).single(),
    memoriasDoContexto(db, p.orgId, teste ? null : contato),
    // RAG proativo: os trechos mais relevantes para a última mensagem já vão no contexto
    buscarConhecimento(db, ultima.content, p.orgId, 3).catch((): Trecho[] => []),
  ]);
  const colegas = await colegasDe(db, p.orgId, atendente);
  const perfil = perfilComAtendente(perfilEmpresa, atendente, colegas);
  const segmento = org?.segmento ?? "geral";
  const qualificacao = perfil.usar_qualificacao ? await perguntasQualificacao(db, p.orgId, segmento) : [];
  const ligadas = { lead: perfil.pode_criar_lead, tarefa: perfil.pode_criar_tarefa, memoria: perfil.aprender_contatos };

  const registro: RegistroExecucao = { ferramentas: [], conhecimento: new Map(trechos.map((t) => [t.conhecimento_id, t.titulo])), transferir: null, outroAtendente: null };
  const ferramentas = ferramentasAtendimento({ db, orgId: p.orgId, conversa: p.conversa, contato, teste, ligadas, registro, colegas });
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
  // Modo simples (sem ferramentas): o mesmo prompt, transferência pela marca [HUMANO]
  const semFerramentas = { ...ferramentas, definicoes: [] };
  const rodar = async (comFerramentas: boolean) => {
    const uso = await rodarAgente({
      agente, sb: null, mensagens, nomeUsuario: p.conversa.nome, sistema, ferramentas: comFerramentas ? ferramentas : semFerramentas, sinal: p.sinal,
      emitir: (e) => { if (e.t === "texto") texto += e.d; p.emitir?.(e); },
    });
    tokens += uso.entrada + uso.saida;
    await db.from("ai_uso").insert({
      org_id: p.orgId, agent_id: agente.id, user_id: p.conversa.user_id, modelo: agente.modelo,
      tokens_entrada: uso.entrada, tokens_cache: uso.cache, tokens_saida: uso.saida, ferramentas: uso.ferramentas,
    });
  };
  try {
    try {
      await rodar(true);
    } catch (e) {
      // Provedor/modelo que não aceita ferramentas (ou falhou no meio do ciclo): responde no modo simples.
      // Um cliente sem resposta é sempre pior que uma resposta sem consulta à base.
      if (p.sinal?.aborted) throw e;
      await registrarErro("ia/atendimento:ferramentas", e, { orgId: p.orgId, detalhe: { agente: agente.nome, modelo: agente.modelo, fallback: "sem ferramentas" } });
      texto = "";
      await rodar(false);
    }
    // Ciclo de ferramentas terminou sem texto (modelo só chamou ferramentas): pede a resposta final
    if (!texto.trim() && !registro.transferir && !registro.outroAtendente) await rodar(false);
  } catch (e) {
    // O gestor vê ia_execucoes: o detalhe do provedor/modelo fica em erros_app, só para o admin da plataforma
    await registrarErro("ia/atendimento", e, { orgId: p.orgId, detalhe: { agente: agente.nome, modelo: agente.modelo, canal: p.canal } });
    erro = "A IA não conseguiu gerar a resposta.";
  }

  const transferir = !!registro.transferir || /\[HUMANO\]/i.test(texto);
  texto = texto.replace(MARCA_HUMANO, "").trim();
  const motivo = registro.transferir?.motivo ?? (transferir ? "A IA pediu um atendente humano." : null);
  const idsConhecimento = [...registro.conhecimento.keys()];

  // Auditoria (best-effort: nunca derruba o atendimento)
  await db.from("ia_execucoes").insert({
    org_id: p.orgId, conversa_id: p.conversa.id, canal: p.canal, teste, agent_id: agente.id, ...(atendente ? { atendente_id: atendente.id } : {}),
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
