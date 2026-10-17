import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  LeadDuplicado, LeadHistorico, LeadScore, Comissao, CampoPersonalizado,
  Conta, Pessoa, TarefaRecorrente, SlaConfig, Lead, Profile,
} from "@/lib/data/types";

/* Leituras (server-only) das telas de Bloco 2. As mutações ficam em
 * app/app/crm/actions.ts ("use server") — componentes de cliente não podem
 * importar nada deste arquivo. */

type LeadResumo = Pick<Lead, "id" | "nome" | "telefone" | "email">;

export type LeadDuplicadoComLeads = LeadDuplicado & {
  lead: LeadResumo | null;
  duplicado_de_lead: LeadResumo | null;
};

export type LeadHistoricoComUsuario = LeadHistorico & {
  usuario: Pick<Profile, "id" | "nome_completo" | "email"> | null;
};

export type ComissaoComUsuario = Comissao & {
  usuario: Pick<Profile, "id" | "nome_completo"> | null;
};

export type PessoaComConta = Pessoa & {
  conta: Pick<Conta, "id" | "nome"> | null;
};

/* ---------- Duplicados ---------- */

export async function lerDuplicados(): Promise<LeadDuplicadoComLeads[]> {
  const supabase = await createClient();
  // Há duas FKs de lead_duplicados pra leads (lead_id e duplicado_de) — as duas
  // precisam de "hint" explícito, senão o PostgREST não sabe qual usar em nenhuma.
  const { data } = await supabase
    .from("lead_duplicados")
    .select("*, lead:leads!lead_duplicados_lead_id_fkey(id, nome, telefone, email), duplicado_de_lead:leads!lead_duplicados_duplicado_de_fkey(id, nome, telefone, email)")
    .order("criado_em", { ascending: false });
  return (data ?? []) as LeadDuplicadoComLeads[];
}

/* ---------- Histórico ---------- */

export async function lerHistoricoLead(leadId: string): Promise<LeadHistoricoComUsuario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_historico")
    .select("*, usuario:profiles(id, nome_completo, email)")
    .eq("lead_id", leadId)
    .order("alterado_em", { ascending: false });
  return (data ?? []) as LeadHistoricoComUsuario[];
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

export async function calcularScoreLead(leadId: string): Promise<LeadScore | null> {
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return null;

  let score = 0;
  const fatores: Record<string, unknown> = {};

  const origemPontos: Record<string, number> = {
    "Indicação": 25, "Site": 20, "LinkedIn": 15, "Evento": 15, "Prospecção": 10, "Outro": 5,
  };
  const ptsOrigem = origemPontos[lead.origem] ?? 5;
  score += ptsOrigem;
  fatores.origem = { pontos: ptsOrigem, origem: lead.origem };

  const temTelefone = !!lead.telefone;
  if (temTelefone) { score += 15; fatores.telefone = { pontos: 15, tem: true }; }
  else { fatores.telefone = { pontos: 0, tem: false }; }

  const temEmail = !!lead.email;
  if (temEmail) { score += 10; fatores.email = { pontos: 10, tem: true }; }
  else { fatores.email = { pontos: 0, tem: false }; }

  const { data: atividades } = await supabase
    .from("activities")
    .select("id, tipo, ocorreu_em")
    .eq("lead_id", leadId)
    .order("ocorreu_em", { ascending: false })
    .limit(20);
  const ptsAtividades = Math.min((atividades?.length ?? 0) * 2, 30);
  score += ptsAtividades;
  fatores.atividades = { pontos: ptsAtividades, total: atividades?.length ?? 0 };

  const { data: tags } = await supabase
    .from("lead_tag_rel")
    .select("tag_id")
    .eq("lead_id", leadId);
  const ptsTags = Math.min((tags?.length ?? 0) * 5, 20);
  score += ptsTags;
  fatores.tags = { pontos: ptsTags, total: tags?.length ?? 0 };

  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("id, concluida_em")
    .eq("lead_id", leadId);
  const tarefasConcluidas = (tarefas ?? []).filter((t: any) => t.concluida_em).length;
  const ptsTarefas = Math.min(tarefasConcluidas * 3, 15);
  score += ptsTarefas;
  fatores.tarefas_concluidas = { pontos: ptsTarefas, total: tarefasConcluidas };

  score = Math.min(100, score);

  let classificacao: "frio" | "morno" | "quente" | "qualificado" = "frio";
  if (score >= 76) classificacao = "qualificado";
  else if (score >= 51) classificacao = "quente";
  else if (score >= 26) classificacao = "morno";

  const { data: existente } = await supabase
    .from("lead_score")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existente) {
    await supabase.from("lead_score")
      .update({ score, classificacao, fatores, calculado_em: new Date().toISOString() })
      .eq("lead_id", leadId);
  } else {
    await supabase.from("lead_score")
      .insert({ org_id: lead.org_id, lead_id: lead.id, score, classificacao, fatores });
  }

  return { id: existente?.id || "", org_id: lead.org_id, lead_id: lead.id, score, classificacao, fatores, calculado_em: new Date().toISOString() };
}

/* ---------- Comissões ---------- */

export async function lerComissoes(): Promise<ComissaoComUsuario[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comissoes")
    .select("*, usuario:profiles(id, nome_completo)")
    .order("mes", { ascending: false });
  return (data ?? []) as ComissaoComUsuario[];
}

/* ---------- Campos Personalizados ---------- */

export async function lerCamposPersonalizados(tabela?: string): Promise<CampoPersonalizado[]> {
  const supabase = await createClient();
  let q = supabase.from("campos_personalizados").select("*").order("nome");
  if (tabela) q = q.eq("tabela", tabela);
  const { data } = await q;
  return (data ?? []) as CampoPersonalizado[];
}

/* ---------- Contas ---------- */

export async function lerContas(): Promise<Conta[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contas").select("*").order("nome");
  return (data ?? []) as Conta[];
}

/* ---------- Pessoas ---------- */

export async function lerPessoas(): Promise<PessoaComConta[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pessoas").select("*, conta:contas(id, nome)").order("nome");
  return (data ?? []) as PessoaComConta[];
}

/* ---------- Tarefas Recorrentes ---------- */

export async function lerTarefasRecorrentes(): Promise<TarefaRecorrente[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tarefas_recorrentes").select("*").order("proxima_execucao");
  return (data ?? []) as TarefaRecorrente[];
}

/* ---------- Tarefas para calendário ---------- */

export async function lerTarefasCalendario(): Promise<TarefaView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select("*, responsavel:profiles(id, nome_completo), lead:leads(id, nome, cod)")
    .order("vence_em", { ascending: true });
  return ((data ?? []) as any[]).map((t: any) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    tipo: t.tipo,
    prioridade: t.prioridade,
    vence_em: t.vence_em,
    concluida_em: t.concluida_em,
    responsavel_nome: t.responsavel?.nome_completo || null,
    lead_nome: t.lead?.nome || null,
    lead_cod: t.lead?.cod || null,
  })) as TarefaView[];
}

export async function lerSlaConfig(): Promise<SlaConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sla_config").select("*").maybeSingle();
  return data ? (data as SlaConfig) : null;
}
