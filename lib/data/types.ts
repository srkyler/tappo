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

export type Profile = {
  id: string;
  nome_completo: string | null;
  empresa: string | null;
  cargo: string | null;
  telefone: string | null;
  avatar_url: string | null;
  meta_reunioes_semana: number;
};

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

export type ActionResult = { ok: true } | { ok: false; erro: string };
