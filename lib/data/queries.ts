import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Campaign, CampaignLead, CampaignStep, Deal, Lead, PipelineStage, Profile } from "./types";

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
    avatar_url: null, meta_reunioes_semana: 5, email: user.email ?? null,
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

export async function lerPipeline(): Promise<{ etapas: PipelineStage[]; deals: Deal[] }> {
  const { supabase } = await usuarioAtual();
  const [{ data: etapas }, { data: deals }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("ordem"),
    supabase.from("deals").select("*").order("updated_at", { ascending: false }),
  ]);
  return { etapas: (etapas ?? []) as PipelineStage[], deals: (deals ?? []) as Deal[] };
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

/** Erro "tabela não existe" → banco ainda não configurado */
export async function bancoPronto(): Promise<boolean> {
  const { supabase } = await usuarioAtual();
  const { error } = await supabase.from("leads").select("id", { head: true, count: "exact" }).limit(1);
  return !error || !/does not exist|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`);
}
