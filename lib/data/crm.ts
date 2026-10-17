import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  LeadDuplicado, LeadHistorico, LeadScore, Comissao, CampoPersonalizado,
  Conta, Pessoa, TarefaRecorrente, SlaConfig,
} from "@/lib/data/types";

/* ---------- Duplicados ---------- */

export async function lerDuplicados(): Promise<LeadDuplicado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_duplicados")
    .select("*, lead:leads(id, nome, telefone, email), duplicado_de_lead:leads!lead_duplicados_duplicado_de_fkey(id, nome, telefone, email)")
    .order("criado_em", { ascending: false });
  return (data ?? []) as LeadDuplicado[];
}

export async function resolverDuplicado(id: string, manterLeadId: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { data: dup } = await supabase
    .from("lead_duplicados")
    .select("lead_id, duplicado_de")
    .eq("id", id)
    .maybeSingle();
  if (!dup) return { ok: false, erro: "Duplicado não encontrado." };

  const leadParaManter = manterLeadId === dup.lead_id ? dup.lead_id : dup.duplicado_de;
  const leadParaRemover = manterLeadId === dup.lead_id ? dup.duplicado_de : dup.lead_id;

  await supabase.from("activities").update({ lead_id: leadParaManter }).eq("lead_id", leadParaRemover);
  await supabase.from("tarefas").update({ lead_id: leadParaManter }).eq("lead_id", leadParaRemover);
  await supabase.from("deals").update({ lead_id: leadParaManter }).eq("lead_id", leadParaRemover);
  await supabase.from("propostas").update({ lead_id: leadParaManter }).eq("lead_id", leadParaRemover);
  await supabase.from("wa_conversas").update({ lead_id: leadParaManter }).eq("lead_id", leadParaRemover);

  const { error } = await supabase.from("leads").delete().eq("id", leadParaRemover);
  if (error) return { ok: false, erro: error.message };

  await supabase.from("lead_duplicados")
    .update({ resolvido_em: new Date().toISOString() })
    .eq("id", id);

  return { ok: true };
}

/* ---------- Histórico ---------- */

export async function lerHistoricoLead(leadId: string): Promise<LeadHistorico[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_historico")
    .select("*, usuario:profiles(id, nome_completo, email)")
    .eq("lead_id", leadId)
    .order("alterado_em", { ascending: false });
  return (data ?? []) as LeadHistorico[];
}

/* ---------- Score ---------- */

export async function lerScoreLead(leadId: string): Promise<LeadScore | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_score")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  return data ? (data as LeadScore) : null;
}

/* ---------- Comissões ---------- */

export async function lerComissoes(): Promise<Comissao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comissoes")
    .select("*, usuario:profiles(id, nome_completo)")
    .order("mes", { ascending: false });
  return (data ?? []) as Comissao[];
}

export async function salvarComissao(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const user_id = String(f.get("user_id") ?? "");
  const deal_id = String(f.get("deal_id") ?? "") || null;
  const percentual = Number(f.get("percentual") ?? 0) || 0;
  const valor_comissao = Number(f.get("valor_comissao") ?? 0) || 0;
  const status = String(f.get("status") ?? "pendente");
  const mes = String(f.get("mes") ?? "");
  const id = String(f.get("id") ?? "");

  if (!user_id) return { ok: false, erro: "Vendedor obrigatório." };
  if (!/^\d{4}-\d{2}-01$/.test(mes)) return { ok: false, erro: "Mês inválido." };

  const payload = { user_id, deal_id, percentual, valor_comissao, status, mes };
  if (!id) {
    const { error } = await supabase.from("comissoes").insert({ ...payload, org_id: (await supabase.from("profiles").select("org_atual").eq("id", user_id).single()).data?.org_atual });
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await supabase.from("comissoes").update(payload).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}

/* ---------- Campos Personalizados ---------- */

export async function lerCamposPersonalizados(tabela?: string): Promise<CampoPersonalizado[]> {
  const supabase = await createClient();
  let q = supabase.from("campos_personalizados").select("*").order("nome");
  if (tabela) q = q.eq("tabela", tabela);
  const { data } = await q;
  return (data ?? []) as CampoPersonalizado[];
}

export async function salvarCampoPersonalizado(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const tabela = String(f.get("tabela") ?? "");
  const nome = String(f.get("nome") ?? "").trim();
  const tipo = String(f.get("tipo") ?? "texto");
  const obrigatorio = f.get("obrigatorio") === "on";
  let opcoes: Record<string, unknown> | null = null;
  if (tipo === "selecao") {
    const opcoesStr = String(f.get("opcoes") ?? "");
    if (opcoesStr) {
      try { opcoes = JSON.parse(opcoesStr); } catch { opcoes = { lista: opcoesStr.split(",").map(s => s.trim()) }; }
    }
  }

  if (!tabela || !nome) return { ok: false, erro: "Tabela e nome são obrigatórios." };

  const payload = { tabela, nome, tipo, opcoes, obrigatorio };
  if (!id) {
    const { error } = await supabase.from("campos_personalizados").insert(payload);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await supabase.from("campos_personalizados").update(payload).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}

/* ---------- Contas ---------- */

export async function lerContas(): Promise<Conta[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contas").select("*").order("nome");
  return (data ?? []) as Conta[];
}

export async function salvarConta(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const nome = String(f.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Nome é obrigatório." };

  const payload = {
    nome,
    cnpj_cpf: String(f.get("cnpj_cpf") ?? "") || null,
    segmento: String(f.get("segmento") ?? "") || null,
    telefone: String(f.get("telefone") ?? "") || null,
    email: String(f.get("email") ?? "") || null,
    endereco: String(f.get("endereco") ?? "") || null,
    cidade: String(f.get("cidade") ?? "") || null,
    estado: String(f.get("estado") ?? "") || null,
    cep: String(f.get("cep") ?? "") || null,
  };

  if (!id) {
    const { error } = await supabase.from("contas").insert(payload);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await supabase.from("contas").update(payload).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}

/* ---------- Pessoas ---------- */

export async function lerPessoas(): Promise<Pessoa[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pessoas").select("*, conta:contas(id, nome)").order("nome");
  return (data ?? []) as Pessoa[];
}

export async function salvarPessoa(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const nome = String(f.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Nome é obrigatório." };

  const payload = {
    conta_id: String(f.get("conta_id") ?? "") || null,
    nome,
    cargo: String(f.get("cargo") ?? "") || null,
    telefone: String(f.get("telefone") ?? "") || null,
    email: String(f.get("email") ?? "") || null,
    telefone_whatsapp: String(f.get("telefone_whatsapp") ?? "") || null,
    lider_decision: f.get("lider_decision") === "on",
  };

  if (!id) {
    const { error } = await supabase.from("pessoas").insert(payload);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await supabase.from("pessoas").update(payload).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}

/* ---------- Tarefas Recorrentes ---------- */

export async function lerTarefasRecorrentes(): Promise<TarefaRecorrente[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tarefas_recorrentes").select("*").order("proxima_execucao");
  return (data ?? []) as TarefaRecorrente[];
}

/* ---------- SLA ---------- */

export async function lerSlaConfig(): Promise<SlaConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sla_config").select("*").maybeSingle();
  return data ? (data as SlaConfig) : null;
}

export async function salvarSlaConfig(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const tempo_resposta_min = Number(f.get("tempo_resposta_min") ?? 15) || 15;
  const ativo = f.get("ativo") === "on";
  const id = String(f.get("id") ?? "");

  const payload = { tempo_resposta_min, ativo };
  if (!id) {
    const { error } = await supabase.from("sla_config").insert(payload);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await supabase.from("sla_config").update(payload).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true };
}
