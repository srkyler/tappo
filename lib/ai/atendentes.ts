import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo, type Agente } from "./agentes";
import type { Atendente, PerfilIA } from "./assistente-tipos";
import type { ColegaIA } from "./ferramentas-atendimento";

/*
 * Vários atendentes de IA por empresa (estilo DeskcommCRM). Quem responde:
 *   1. o atendente para quem a conversa foi passada (wa_conversas.atendente_id);
 *   2. o atendente do canal/número (wa_conexoes.atendente_id, telegram, e-mail);
 *   3. o atendente padrão da empresa;
 *   4. nenhum: o assistente único definido em ia_perfil (comportamento antigo).
 * O modelo vem de ia_atendente_modelo (só o admin da plataforma escreve); sem linha,
 * o agente ativo da plataforma. Service role: sempre filtra org_id.
 */

const CAMPOS = "id, org_id, nome, funcao, saudacao, tom, objetivo, instrucoes, transferir_quando, ativo, padrao";

export async function atendenteQueResponde(
  db: SupabaseClient, orgId: string, ids: (string | null | undefined)[],
): Promise<Atendente | null> {
  const { data, error } = await db.from("ia_atendentes").select(CAMPOS).eq("org_id", orgId).eq("ativo", true);
  if (error || !data?.length) return null; // tabela ainda não criada ou empresa sem atendentes
  const lista = data as Atendente[];
  for (const id of ids) {
    const a = id ? lista.find((x) => x.id === id) : null;
    if (a) return a;
  }
  return lista.find((x) => x.padrao) ?? (lista.length === 1 ? lista[0] : null);
}

/** Outros atendentes ativos (para a ferramenta transferir_para_atendente). */
export async function colegasDe(db: SupabaseClient, orgId: string, atual: Atendente | null): Promise<ColegaIA[]> {
  if (!atual) return [];
  const { data } = await db.from("ia_atendentes").select("id, nome, funcao").eq("org_id", orgId).eq("ativo", true).neq("id", atual.id);
  return (data ?? []) as ColegaIA[];
}

/** Modelo do atendente (definido pelo admin) ou o agente ativo da plataforma. */
export async function agenteDoAtendente(db: SupabaseClient, atendente: Atendente | null): Promise<Agente | null> {
  if (atendente) {
    const { data } = await db.from("ia_atendente_modelo").select("agent_id").eq("atendente_id", atendente.id).maybeSingle();
    if (data?.agent_id) {
      const { data: agente } = await db.from("ai_agents").select("*").eq("id", data.agent_id).maybeSingle();
      if (agente) return agente as Agente;
    }
  }
  return agenteAtivo().catch(() => null);
}

/** O atendente sobrepõe nome, tom, objetivo e regras ao perfil da empresa (o resto é compartilhado). */
export function perfilComAtendente(perfil: PerfilIA, a: Atendente | null, colegas: ColegaIA[]): PerfilIA {
  if (!a) return perfil;
  const regras = [
    a.funcao.trim() && `Sua função nesta empresa: ${a.funcao.trim()}.`,
    a.instrucoes.trim(),
    perfil.regras.trim(),
    colegas.length && `Colegas de IA que também atendem (use transferir_para_atendente quando o assunto for deles):\n${colegas.map((c) => `- ${c.nome}${c.funcao ? `: ${c.funcao}` : ""}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");
  return {
    ...perfil,
    nome_assistente: a.nome,
    tom: a.tom ?? perfil.tom,
    objetivo: a.objetivo ?? perfil.objetivo,
    saudacao: a.saudacao.trim() || perfil.saudacao,
    transferir_quando: a.transferir_quando.trim() || perfil.transferir_quando,
    regras,
  };
}
