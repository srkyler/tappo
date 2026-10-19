export type Agente = { id: string; nome: string; descricao: string | null; ativo: boolean; modelo: string; teto_tokens_mes?: number; max_historico: number };

const AGENTES: Agente[] = [
  { id: "jarvis", nome: "Jarvis", descricao: "Assistente de configuração e automação do Tappo", ativo: true, modelo: "gpt-4o-mini", max_historico: 20 },
];

export async function agenteAtivo(): Promise<Agente | null> {
  return AGENTES.find((a) => a.ativo) ?? null;
}

export async function agenteAtivoPublico(): Promise<Agente | null> {
  return AGENTES.find((a) => a.ativo) ?? null;
}

export async function listarAgentes(): Promise<Agente[]> {
  return AGENTES;
}

export function semSegredo(agente: Agente): Omit<Agente, "id"> {
  const { id, ...resto } = agente;
  return resto;
}