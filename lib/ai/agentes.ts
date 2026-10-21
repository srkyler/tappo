import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoProvedor } from "./provedores";

/* Configuração dos agentes de IA (tabela ai_agents — só a service role acessa) */

export type Esforco = "low" | "medium" | "high";

export type Agente = {
  id: string;
  nome: string;
  descricao: string | null;
  provedor: TipoProvedor;
  preset: string;
  base_url: string | null;
  modelo: string;
  api_key_cifrada: string | null;
  api_key_final: string | null;
  esforco: Esforco;
  max_tokens: number;
  temperatura: number | null;
  max_historico: number;
  teto_tokens_mes: number | null;
  teto_tokens_usuario_dia: number | null;
  instrucoes: string;
  pode_editar_dados: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

/** Versão sem o segredo — é o que pode ir para a tela do admin. */
export type AgenteSeguro = Omit<Agente, "api_key_cifrada"> & { tem_chave: boolean };

export function semSegredo({ api_key_cifrada, ...a }: Agente): AgenteSeguro {
  return { ...a, temperatura: a.temperatura === null ? null : Number(a.temperatura), tem_chave: !!api_key_cifrada };
}

/** Agente em produção para os membros. Null se nenhum estiver ativo. */
export async function agenteAtivo(): Promise<Agente | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("ai_agents").select("*").eq("ativo", true).maybeSingle();
  return (data as Agente | null) ?? null;
}

/** O que o membro pode ver: só nome e descrição. */
export async function agenteAtivoPublico(): Promise<{ nome: string; descricao: string | null } | null> {
  const a = await agenteAtivo().catch(() => null);
  return a ? { nome: a.nome, descricao: a.descricao } : null;
}
