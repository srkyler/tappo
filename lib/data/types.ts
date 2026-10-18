export type LeadDuplicado = {
  id: string;
  lead_id: string;
  duplicado_de: string;
  resolvido_em: string | null;
  criado_em: string;
  lead: { id: string; nome: string; telefone: string; email: string };
  duplicado_de_lead: { id: string; nome: string; telefone: string; email: string };
};

export type LeadHistorico = {
  id: string;
  lead_id: string;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_em: string;
  alterado_por: string | null;
  usuario: { id: string; nome_completo: string; email: string } | null;
};

export type LeadScore = {
  id: string;
  lead_id: string;
  score: number;
  nivel: string;
  fatores: Record<string, unknown>;
  atualizado_em: string;
};

export type Comissao = {
  id: string;
  user_id: string;
  deal_id: string | null;
  percentual: number;
  valor_comissao: number;
  status: string;
  mes: string;
  criado_em: string;
  usuario: { id: string; nome_completo: string };
};

export type CampoPersonalizado = {
  id: string;
  tabela: string;
  nome: string;
  tipo: string;
  opcoes: Record<string, unknown> | null;
  obrigatorio: boolean;
};

export type Conta = {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  segmento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

export type Pessoa = {
  id: string;
  conta_id: string | null;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  telefone_whatsapp: string | null;
  lider_decision: boolean;
  conta: { id: string; nome: string } | null;
};

export type TarefaRecorrente = {
  id: string;
  titulo: string;
  frequencia: string;
  dia_semana: string | null;
  horario: string | null;
  responsavel_id: string | null;
  proxima_execucao: string | null;
};

export type SlaConfig = {
  id: string;
  tempo_resposta_min: number;
  ativo: boolean;
};
