export type Agente = { nome: string; descricao: string | null; ativo: boolean };

const AGENTES: Agente[] = [
  { nome: "Jarvis", descricao: "Assistente de configuração e automação do Tappo", ativo: true },
];

export async function agenteAtivoPublico(): Promise<Agente | null> {
  return AGENTES.find((a) => a.ativo) ?? null;
}

export async function listarAgentes(): Promise<Agente[]> {
  return AGENTES;
}
