// Tipos espelhando supabase/migrations/20261016000000_tappo_schema.sql

export const LEAD_STATUS = ["Nova", "Contatado", "Qualificado", "Reunião", "Follow-up", "Perdido"] as const;
export const LEAD_ORIGEM = ["LinkedIn", "Indicação", "Evento", "Prospecção", "Site", "Outro"] as const;
export const CAMPAIGN_STATUS = ["Rascunho", "Ativa", "Pausada", "Concluída"] as const;
export const CANAL = ["E-mail", "LinkedIn", "Telefone", "WhatsApp", "Videoconf", "Outro"] as const;
export const CAMPAIGN_LEAD_STATUS = ["Ativo", "Respondeu", "Reunião", "Concluído", "Removido"] as const;
export const ACTIVITY_TIPO = [
  "ligacao", "email", "whatsapp", "linkedin", "reuniao", "nota",
  "importacao", "movimentacao", "proposta", "campanha", "outro",
] as const;

export type LeadStatus = (typeof LEAD_STATUS)[number];
export type LeadOrigem = (typeof LEAD_ORIGEM)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];
export type Canal = (typeof CANAL)[number];
export type CampaignLeadStatus = (typeof CAMPAIGN_LEAD_STATUS)[number];
export type ActivityTipo = (typeof ACTIVITY_TIPO)[number];
export type StageTipo = "aberto" | "ganho" | "perdido";

export type Lead = {
  id: string;
  cod: string;
  nome: string;
  empresa: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  segmento: string | null;
  origem: LeadOrigem;
  status: LeadStatus;
  notas: string | null;
  proximo_contato_em: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  nome: string;
  descricao: string | null;
  status: CampaignStatus;
  iniciada_em: string | null;
  created_at: string;
};

export type CampaignStep = {
  id: string;
  campaign_id: string;
  ordem: number;
  dia: number;
  canal: Canal;
  acao: string;
};

export type CampaignLead = {
  id: string;
  campaign_id: string;
  lead_id: string;
  etapas_concluidas: number;
  status: CampaignLeadStatus;
  proximo_passo_em: string | null;
};

export type PipelineStage = {
  id: string;
  nome: string;
  ordem: number;
  probabilidade: number;
  tipo: StageTipo;
};

export type Deal = {
  id: string;
  titulo: string;
  empresa: string;
  contato: string | null;
  lead_id: string | null;
  stage_id: string;
  valor: number;
  data_fechamento_previsto: string | null;
  notas: string | null;
  motivo_perda: string | null;
  etapa_entrada_em: string;
  fechado_em: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  tipo: ActivityTipo;
  descricao: string;
  lead_id: string | null;
  deal_id: string | null;
  campaign_id: string | null;
  ocorreu_em: string;
};

export type Profile = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  empresa: string | null;
  cargo: string | null;
  telefone: string | null;
  avatar_url: string | null;
  org_atual: string | null;
  meta_reunioes_semana: number;
};

export type Empresa = {
  id: string;
  nome: string;
  segmento: string;
  plano: string;
  teste_ate: string;
  papel: Papel;
  termos: Termos;
};

export type Membro = {
  user_id: string;
  nome: string;
  email: string | null;
  avatar_url: string | null;
  papel: Papel;
  ativo: boolean;
};

export type Convite = {
  id: string;
  email: string;
  papel: string;
  expira_em: string;
};

export type Tarefa = {
  id: string;
  org_id: string;
  user_id: string;
  responsavel_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
  conversa_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  vence_em: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
};

export type Meta = {
  id: string;
  org_id: string;
  user_id: string;
  mes: string;
  meta_valor: number;
  meta_vendas: number;
  created_at: string;
  updated_at: string;
};

export type PainelGestor = {
  ganho_valor: number;
  ganho_qtd: number;
  perdido_qtd: number;
  aberto_valor: number;
  previsao: number;
  previsao_meses: { mes: string; ponderado: number; bruto: number; qtd: number }[];
  funil: { etapa: string; tipo: string; qtd: number; valor: number }[];
  inbox: {
    abertas: number;
    sem_responsavel: number;
    aguardando: number;
    aguardando_15m: number;
    tempo_medio_seg: number | null;
    novas: number;
  };
  equipe: {
    user_id: string;
    nome: string;
    papel: string;
    avatar_url: string | null;
    ganho_valor: number;
    ganho_qtd: number;
    aberto_valor: number;
    atividades: number;
    tarefas_feitas: number;
    tarefas_atrasadas: number;
    conversas_abertas: number;
    tempo_resposta_seg: number | null;
    meta_valor: number | null;
    ganho_mes: number;
  }[];
};

export type Termos = { lead: string; leads: string; negocio: string; negocios: string };

export type Papel = "dono" | "gestor" | "vendedor" | "atendente";

export type LeadTag = {
  id: string;
  org_id: string;
  nome: string;
  cor: string;
  created_at: string;
};

export type Proposta = {
  id: string;
  org_id: string;
  lead_id: string | null;
  deal_id: string | null;
  titulo: string;
  valor: number;
  status: string;
  pdf_url: string | null;
  enviado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export const GATILHOS_AUTOMACAO = ["lead_mudou_status", "lead_entrou_campanha", "deal_mudou_etapa", "tag_adicionada"] as const;
export const ACOES_AUTOMACAO = ["mover_etapa", "adicionar_tag", "atribuir_responsavel", "criar_tarefa"] as const;
export type GatilhoAutomacao = (typeof GATILHOS_AUTOMACAO)[number];
export type AcaoAutomacao = (typeof ACOES_AUTOMACAO)[number];

export type Automacao = {
  id: string;
  org_id: string;
  nome: string;
  ativo: boolean;
  gatilho: GatilhoAutomacao;
  gatilho_valor: string | null;
  acao: AcaoAutomacao;
  acao_valor: string | null;
  execucoes: number;
  criado_em: string;
  atualizado_em: string;
};

export type ActionResult = { ok: true } | { ok: false; erro: string };
