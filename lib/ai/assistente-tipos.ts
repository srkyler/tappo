/* Tipos e constantes do Assistente da empresa. Seguro para importar no cliente (sem segredos). */

export const TONS = {
  cordial: "Cordial e acolhedor",
  formal: "Formal e profissional",
  descontraido: "Descontraído e próximo",
  consultivo: "Consultivo e especialista",
} as const;
export type Tom = keyof typeof TONS;

export const OBJETIVOS = {
  qualificar: "Qualificar o contato e passar para o time comercial",
  agendar: "Agendar reunião, avaliação ou visita",
  vender: "Tirar dúvidas e conduzir até a compra",
  suporte: "Dar suporte e resolver dúvidas de clientes",
} as const;
export type Objetivo = keyof typeof OBJETIVOS;

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

/** Chave = dia da semana (0 = domingo) → [abre, fecha] "HH:MM". Dia ausente = fechado. */
export type Horario = Partial<Record<string, [string, string]>>;

export type PerfilIA = {
  org_id: string;
  nome_assistente: string;
  tom: Tom;
  usar_emojis: boolean;
  saudacao: string;
  sobre: string;
  produtos: string;
  publico: string;
  diferenciais: string;
  politicas: string;
  contato: string;
  objetivo: Objetivo;
  regras: string;
  transferir_quando: string;
  horario: Horario;
  fora_horario: string;
  usar_qualificacao: boolean;
  aprender_contatos: boolean;
  pode_criar_lead: boolean;
  pode_criar_tarefa: boolean;
  updated_at: string | null;
};

export function perfilPadrao(orgId: string): PerfilIA {
  return {
    org_id: orgId, nome_assistente: "Assistente", tom: "cordial", usar_emojis: false, saudacao: "",
    sobre: "", produtos: "", publico: "", diferenciais: "", politicas: "", contato: "",
    objetivo: "qualificar", regras: "", transferir_quando: "", horario: {}, fora_horario: "",
    usar_qualificacao: true, aprender_contatos: true, pode_criar_lead: true, pode_criar_tarefa: true, updated_at: null,
  };
}

/** Quanto do perfil está preenchido (0–100) — guia o cliente na configuração. */
export function completudePerfil(p: PerfilIA, itensConhecimento: number): number {
  const checks = [
    p.sobre.trim().length >= 40,
    p.produtos.trim().length >= 20,
    p.publico.trim().length > 0,
    p.politicas.trim().length > 0,
    p.contato.trim().length > 0,
    Object.keys(p.horario).length > 0,
    p.regras.trim().length > 0,
    itensConhecimento >= 3,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export type ItemConhecimento = {
  id: string;
  tipo: "faq" | "documento";
  titulo: string;
  conteudo: string;
  status: "ativo" | "sugerido" | "arquivado";
  origem: "manual" | "conversa";
  usos: number;
  ultimo_uso_em: string | null;
  updated_at: string;
};

export type Memoria = {
  id: string;
  escopo: "empresa" | "contato";
  contato: string | null;
  lead_id: string | null;
  fato: string;
  origem: "humano" | "ia";
  valido_ate: string | null;
  created_at: string;
};

export type Execucao = {
  id: string;
  conversa_id: string | null;
  canal: string;
  teste: boolean;
  pergunta: string | null;
  resposta: string | null;
  ferramentas: string[];
  conhecimento_ids: string[];
  transferiu: boolean;
  motivo: string | null;
  tokens: number;
  ms: number | null;
  erro: string | null;
  created_at: string;
};

/** Atendente de IA da empresa (vários por empresa, estilo DeskcommCRM). O modelo nunca vem aqui. */
export type Atendente = {
  id: string;
  org_id: string;
  nome: string;
  funcao: string;
  saudacao: string;
  tom: Tom | null;         // null = herda do perfil da empresa
  objetivo: Objetivo | null;
  instrucoes: string;
  transferir_quando: string;
  ativo: boolean;
  padrao: boolean;
};
