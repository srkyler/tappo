import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Campaign, CampaignLead, CampaignStep, Deal, Lead, Meta, PainelGestor, Pipeline, PipelineStage, Profile, Promocao, Tarefa } from "./types";

/* Tappo — leituras do app (sempre com o cliente do usuário: RLS filtra por dono) */

export async function usuarioAtual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function lerPerfil(): Promise<(Profile & { email: string | null }) | null> {
  const { supabase, user } = await usuarioAtual();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ? { ...data, email: data.email ?? user.email ?? null } : {
    id: user.id, nome_completo: null, empresa: null, cargo: null, telefone: null,
    avatar_url: null, meta_reunioes_semana: 5, email: user.email ?? null, org_atual: null,
  };
}

export async function lerLeads(): Promise<Lead[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(2000);
  return (data ?? []) as Lead[];
}

export type CampanhaCompleta = Campaign & {
  passos: CampaignStep[];
  leads: (CampaignLead & { lead: Pick<Lead, "id" | "nome" | "empresa" | "cod"> | null })[];
};

export async function lerCampanhas(): Promise<CampanhaCompleta[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase
    .from("campaigns")
    .select("*, passos:campaign_steps(*), leads:campaign_leads(*, lead:leads(id, nome, empresa, cod))")
    .order("created_at", { ascending: false });
  return ((data ?? []) as CampanhaCompleta[]).map((c) => ({
    ...c,
    passos: [...(c.passos ?? [])].sort((a, b) => a.ordem - b.ordem),
    leads: c.leads ?? [],
  }));
}

export async function lerPipelines(): Promise<Pipeline[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase.from("pipelines").select("*").eq("ativo", true).order("padrao", { ascending: false }).order("created_at");
  return (data ?? []) as Pipeline[];
}

/** Etapas + negócios de UM funil. Sem `pipelineId`, usa o funil padrão da empresa. */
export async function lerPipeline(pipelineId?: string): Promise<{ pipelineId: string | null; etapas: PipelineStage[]; deals: Deal[] }> {
  const { supabase } = await usuarioAtual();
  let pid = pipelineId;
  if (!pid) {
    const { data: padrao } = await supabase.from("pipelines").select("id").eq("padrao", true).maybeSingle();
    pid = padrao?.id;
  }
  if (!pid) return { pipelineId: null, etapas: [], deals: [] };
  const { data: etapas } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", pid).order("ordem");
  const idsEtapas = (etapas ?? []).map((e) => e.id);
  const { data: deals } = idsEtapas.length
    ? await supabase.from("deals").select("*").in("stage_id", idsEtapas).order("updated_at", { ascending: false })
    : { data: [] as Deal[] };
  return { pipelineId: pid, etapas: (etapas ?? []) as PipelineStage[], deals: (deals ?? []) as Deal[] };
}

export async function lerPromocoes(): Promise<Promocao[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase.from("promocoes").select("*").order("data_inicio", { ascending: true });
  return (data ?? []) as Promocao[];
}

export async function lerAtividades(limite = 12): Promise<Activity[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase.from("activities").select("*").order("ocorreu_em", { ascending: false }).limit(limite);
  return (data ?? []) as Activity[];
}

export type Resumo = {
  leads_periodo: number; leads_anterior: number; leads_total: number;
  contatados_periodo: number; respostas_periodo: number; em_campanha_periodo: number;
  reunioes_periodo: number; reunioes_anterior: number;
  ganhos_periodo: number; valor_ganho_periodo: number; perdidos_periodo: number; pipeline_aberto: number;
  leads_por_status: Record<string, number>;
  leads_por_origem: { origem: string; total: number }[];
  leads_por_semana: { semana: string; total: number }[];
  funil: { etapa: string; tipo: string; total: number; valor: number }[];
  top_campanhas: { nome: string; leads: number; respostas: number; reunioes: number }[];
};

export async function lerResumo(dias = 30): Promise<Resumo | null> {
  const { supabase } = await usuarioAtual();
  const { data, error } = await supabase.rpc("analytics_resumo", { dias });
  if (error) return null;
  return data as Resumo;
}

export async function lerTarefas(): Promise<Tarefa[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .order("vence_em", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as Tarefa[];
}

export async function lerMetas(): Promise<Meta[]> {
  const { supabase } = await usuarioAtual();
  const { data } = await supabase.from("metas").select("*").order("mes", { ascending: false });
  return (data ?? []) as Meta[];
}

export async function lerPainelGestor(dias = 30): Promise<PainelGestor | null> {
  const { supabase } = await usuarioAtual();
  const { data, error } = await supabase.rpc("painel_gestor", { dias });
  if (error) return null;
  return data as PainelGestor;
}

/** Erro "tabela não existe" → banco ainda não configurado */
export async function bancoPronto(): Promise<boolean> {
  const { supabase } = await usuarioAtual();
  const { error } = await supabase.from("leads").select("id", { head: true, count: "exact" }).limit(1);
  return !error || !/does not exist|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`);
}

/** Relatório de conversão por origem para o painel do gestor */
export type ConversaoOrigem = { origem: string; total: number; ganhos: number; taxa_conversao: number };

export async function lerConversaoPorOrigem(): Promise<ConversaoOrigem[]> {
  const { supabase } = await usuarioAtual();
  // "Ganho" não é status de lead (é tipo de etapa do funil) — conversão real é
  // o lead ter algum negócio numa etapa tipo "ganho".
  const { data } = await supabase
    .from("leads")
    .select("origem, deals(pipeline_stages(tipo))");
  const todos = (data ?? []) as unknown as { origem: string; deals: { pipeline_stages: { tipo: string }[] | { tipo: string } | null }[] }[];
  const porOrigem = todos.reduce((acc: Record<string, { total: number; ganhos: number }>, l) => {
    if (!acc[l.origem]) acc[l.origem] = { total: 0, ganhos: 0 };
    acc[l.origem].total++;
    const ganhou = l.deals?.some((d) => {
      const ps = d.pipeline_stages;
      return Array.isArray(ps) ? ps.some((x) => x.tipo === "ganho") : ps?.tipo === "ganho";
    });
    if (ganhou) acc[l.origem].ganhos++;
    return acc;
  }, {});
  return Object.entries(porOrigem).map(([origem, v]) => ({
    origem,
    total: v.total,
    ganhos: v.ganhos,
    taxa_conversao: v.total > 0 ? Math.round((v.ganhos / v.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);
}
