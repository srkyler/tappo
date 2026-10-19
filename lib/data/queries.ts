import { createClient } from "@/lib/supabase/server";

export async function bancoPronto(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function usuarioAtual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function lerResumo(orgId: string) {
  const supabase = await createClient();
  const { data: leads } = await supabase.from("leads").select("status").eq("org_id", orgId);
  const { data: deals } = await supabase.from("deals").select("valor, pipeline_stages(tipo)").eq("org_id", orgId);
  return {
    totalLeads: leads?.length ?? 0,
    novosLeads: leads?.filter((l) => l.status === "Nova").length ?? 0,
    dealsEmAberto: deals?.filter((d) => d.pipeline_stages?.tipo !== "ganho" && d.pipeline_stages?.tipo !== "perdido").length ?? 0,
    valorPipeline: deals?.filter((d) => d.pipeline_stages?.tipo !== "ganho" && d.pipeline_stages?.tipo !== "perdido").reduce((s, d) => s + (d.valor ?? 0), 0) ?? 0,
  };
}

export async function lerPainelGestor(orgId: string) {
  const supabase = await createClient();
  const { data: leads } = await supabase.from("leads").select("id, status, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
  const { data: deals } = await supabase.from("deals").select("id, valor, pipeline_stages(tipo, nome)").eq("org_id", orgId);
  return { leads: leads ?? [], deals: deals ?? [] };
}

export async function lerConversaoPorOrigem(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("origem, status").eq("org_id", orgId);
  const agg: Record<string, { total: number; ganhos: number }> = {};
  data?.forEach((l) => {
    if (!agg[l.origem]) agg[l.origem] = { total: 0, ganhos: 0 };
    agg[l.origem].total++;
    if (l.status === "Ganha") agg[l.origem].ganhos++;
  });
  return Object.entries(agg).map(([origem, v]) => ({ origem, total: v.total, ganhos: v.ganhos, taxa: v.total ? v.ganhos / v.total : 0 }));
}

export async function lerPipeline(orgId: string, pipelineId?: string) {
  const supabase = await createClient();
  let query = supabase.from("pipelines").select("*, stages: pipeline_stages(*)").eq("org_id", orgId);
  if (pipelineId) query = query.eq("id", pipelineId);
  const { data } = await query;
  return data ?? [];
}

export async function lerPipelines(orgId: string) {
  return lerPipeline(orgId);
}

export async function lerCampanhas(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("campanhas").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function lerLeads(orgId: string, filtros?: { status?: string; origem?: string }) {
  const supabase = await createClient();
  let query = supabase.from("leads").select("*").eq("org_id", orgId);
  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.origem) query = query.eq("origem", filtros.origem);
  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function lerPromocoes(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("promocoes").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function lerPerfil(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}

export async function lerAtendimentoAtendente(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data: conversas } = await supabase.from("wa_conversas").select("*").eq("org_id", orgId).eq("atribuido_a", userId).eq("status", "aberta");
  const { data: tarefas } = await supabase.from("tarefas").select("*").eq("org_id", orgId).eq("responsavel_id", userId).eq("concluida_em", null);
  return { conversas: conversas ?? [], tarefas: tarefas ?? [] };
}

export async function lerChatbotQualificacao(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("chatbot_qualificacao").select("*").eq("org_id", orgId).single();
  return data;
}