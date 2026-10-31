"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { limitar } from "@/lib/auth/rate-limit";

/* Mutações das telas de Bloco 2 (contas, pessoas, campos personalizados,
 * comissões, SLA, duplicados) — chamadas direto de componentes de cliente. */

function erro(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

/* ---------- Chatbot de qualificação ---------- */

export async function salvarChatbotQualificacao(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const id = String(f.get("id") ?? "");
    const segmento = String(f.get("segmento") ?? "").trim();
    const pergunta = String(f.get("pergunta") ?? "").trim();
    const ordem = Number(f.get("ordem") ?? 1) || 1;
    const campo_resposta = String(f.get("campo_resposta") ?? "resposta").trim();
    const obrigatoria = f.get("obrigatoria") === "on";
    const ativa = f.get("ativa") === "on";
    if (!segmento || !pergunta) return { ok: false, erro: "Segmento e pergunta são obrigatórios." };

    const payload = { segmento, pergunta, ordem, campo_resposta, obrigatoria, ativa };
    const { error: e } = id
      ? await supabase.from("chatbot_qualificacao").update(payload).eq("id", id)
      : await supabase.from("chatbot_qualificacao").insert(payload);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/chatbot-qualificacao");
    return { ok: true };
  } catch (e) { return erro(e); }
}

export async function excluirChatbotQualificacao(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { error: e } = await supabase.from("chatbot_qualificacao").delete().eq("id", id);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/chatbot-qualificacao");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Duplicados ---------- */

export async function resolverDuplicado(id: string, manterLeadId: string): Promise<{ ok: boolean; erro?: string }> {
  try {
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

    const { error: e } = await supabase.from("leads").delete().eq("id", leadParaRemover);
    if (e) return { ok: false, erro: e.message };

    await supabase.from("lead_duplicados").update({ resolvido_em: new Date().toISOString() }).eq("id", id);

    revalidatePath("/app/duplicados");
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Comissões ---------- */

export async function salvarComissao(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const user_id = String(f.get("user_id") ?? "");
    const deal_id = String(f.get("deal_id") ?? "") || null;
    const percentual = Number(f.get("percentual") ?? 0) || 0;
    const valor_comissao = Number(f.get("valor_comissao") ?? 0) || 0;
    const status = String(f.get("status") ?? "pendente");
    // <input type="month"> manda "AAAA-MM" (sem dia) — a coluna é date, então completa com -01.
    const mesForm = String(f.get("mes") ?? "");
    const mes = /^\d{4}-\d{2}$/.test(mesForm) ? `${mesForm}-01` : mesForm;
    const id = String(f.get("id") ?? "");

    if (!user_id) return { ok: false, erro: "Vendedor obrigatório." };
    if (!/^\d{4}-\d{2}-01$/.test(mes)) return { ok: false, erro: "Mês inválido." };

    const payload = { user_id, deal_id, percentual, valor_comissao, status, mes };
    // org_id tem DEFAULT public.org_atual() — não precisa ser calculado a partir
    // do perfil do vendedor, que pode nem ser quem está logado.
    const { error: e } = id
      ? await supabase.from("comissoes").update(payload).eq("id", id)
      : await supabase.from("comissoes").insert(payload);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/comissoes");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Campos Personalizados ---------- */

export async function salvarCampoPersonalizado(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
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
        try { opcoes = JSON.parse(opcoesStr); } catch { opcoes = { lista: opcoesStr.split(",").map((s) => s.trim()) }; }
      }
    }
    if (!tabela || !nome) return { ok: false, erro: "Tabela e nome são obrigatórios." };

    const payload = { tabela, nome, tipo, opcoes, obrigatorio };
    const { error: e } = id
      ? await supabase.from("campos_personalizados").update(payload).eq("id", id)
      : await supabase.from("campos_personalizados").insert(payload);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/campos-personalizados");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Contas ---------- */

export async function salvarConta(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
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
    const { error: e } = id
      ? await supabase.from("contas").update(payload).eq("id", id)
      : await supabase.from("contas").insert(payload);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/contas");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Pessoas ---------- */

export async function salvarPessoa(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
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
      lider_decisao: f.get("lider_decisao") === "on",
    };
    const { error: e } = id
      ? await supabase.from("pessoas").update(payload).eq("id", id)
      : await supabase.from("pessoas").insert(payload);
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/pessoas");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Lead Score ---------- */

export async function calcularScoreLeadAction(leadId: string): Promise<{ ok: boolean; erro?: string; score?: number; classificacao?: string }> {
  try {
    const score = await (await import("@/lib/data/crm")).calcularScoreLead(leadId);
    if (!score) return { ok: false, erro: "Lead não encontrado." };
    revalidatePath("/app/leads");
    return { ok: true, score: score.score, classificacao: score.classificacao };
  } catch (e) { return erro(e); }
}

/* ---------- SLA ---------- */

/** sla_config é 1 linha por empresa (índice único em org_id) — upsert em vez de rastrear id. */
export async function salvarSlaConfig(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const tempo_resposta_min = Number(f.get("tempo_resposta_min") ?? 15) || 15;
    const ativo = f.get("ativo") === "on";
    if (tempo_resposta_min <= 0) return { ok: false, erro: "Tempo de resposta precisa ser maior que zero." };

    let { error: e } = await supabase.from("sla_config").upsert({ tempo_resposta_min, ativo, alertar_email: f.get("alertar_email") === "on" }, { onConflict: "org_id" });
    // Banco sem a migration 20261103000000: salva o resto
    if (e && /alertar_email/.test(e.message)) ({ error: e } = await supabase.from("sla_config").upsert({ tempo_resposta_min, ativo }, { onConflict: "org_id" }));
    if (e) return { ok: false, erro: e.message };
    revalidatePath("/app/sla");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Tarefas Recorrentes ---------- */

export async function salvarTarefaRecorrente(f: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada." };
    const id = String(f.get("id") ?? "");
    const titulo = String(f.get("titulo") ?? "").trim();
    if (!titulo) return { ok: false, erro: "Título é obrigatório." };
    const bruta = String(f.get("proxima_execucao") ?? "");
    if (!bruta) return { ok: false, erro: "Data da próxima execução é obrigatória." };
    // datetime-local vem sem fuso: é horário de Brasília (UTC-3), não UTC
    const quando = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(bruta) ? bruta : `${bruta.length === 16 ? `${bruta}:00` : bruta}-03:00`);
    if (Number.isNaN(quando.getTime())) return { ok: false, erro: "Data da próxima execução inválida." };
    const proxima_execucao = quando.toISOString();

    const payload = {
      user_id: user.id,
      titulo,
      descricao: String(f.get("descricao") ?? "") || null,
      tipo: String(f.get("tipo") ?? "outro"),
      prioridade: String(f.get("prioridade") ?? "media"),
      recorrencia: String(f.get("recorrencia") ?? "diaria"),
      proxima_execucao,
      ativa: f.get("ativa") === "on",
    };
    const { error } = id
      ? await supabase.from("tarefas_recorrentes").update(payload).eq("id", id)
      : await supabase.from("tarefas_recorrentes").insert(payload);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/app/tarefas-recorrentes"); revalidatePath("/app/tarefas");
    return { ok: true };
  } catch (e) { return erro(e); }
}

export async function excluirTarefaRecorrente(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tarefas_recorrentes").delete().eq("id", id);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/app/tarefas-recorrentes"); revalidatePath("/app/tarefas");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Status do Atendente ---------- */

export async function salvarStatusAtendimento(userId: string, status: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    if (!["disponível","ocupado","ausente","offline"].includes(status)) return { ok: false, erro: "Status inválido." };
    const { error } = await supabase.from("org_membros").update({ status_atendimento: status }).eq("user_id", userId);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/app/empresa");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Prioridade da Conversa ---------- */

export async function salvarPrioridadeConversa(conversaId: string, prioridade: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    if (!["baixa","media","alta","urgente"].includes(prioridade)) return { ok: false, erro: "Prioridade inválida." };
    const { error } = await supabase.from("wa_conversas").update({ prioridade }).eq("id", conversaId);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return erro(e); }
}

export async function alternarTarefaRecorrente(id: string, ativa: boolean): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tarefas_recorrentes").update({ ativa, atualizado_em: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/app/tarefas-recorrentes");
    return { ok: true };
  } catch (e) { return erro(e); }
}

/* ---------- Enriquecimento por CNPJ (BrasilAPI, dados públicos da Receita) ---------- */

export type DadosCnpj = {
  nome: string; fantasia: string | null; segmento: string | null; telefone: string | null; email: string | null;
  endereco: string | null; cidade: string | null; estado: string | null; cep: string | null; situacao: string | null;
};

export async function buscarCnpj(bruto: string): Promise<{ ok: true; dados: DadosCnpj } | { ok: false; erro: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada." };
    const cnpj = bruto.replace(/\D/g, "");
    if (cnpj.length !== 14) return { ok: false, erro: "Digite os 14 números do CNPJ." };
    if (limitar({ acao: "buscar-cnpj", id: user.id }, 30, 3600)) return { ok: false, erro: "Muitas consultas seguidas. Tente mais tarde." };
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (res.status === 404) return { ok: false, erro: "CNPJ não encontrado na Receita." };
    if (!res.ok) return { ok: false, erro: "Consulta indisponível agora. Tente de novo em instantes." };
    const j = (await res.json()) as Record<string, unknown>;
    const t = (k: string) => (typeof j[k] === "string" && (j[k] as string).trim() ? (j[k] as string).trim() : null);
    const tel = t("ddd_telefone_1")?.replace(/\D/g, "") ?? null;
    return {
      ok: true,
      dados: {
        nome: t("razao_social") ?? "", fantasia: t("nome_fantasia"), segmento: t("cnae_fiscal_descricao"),
        telefone: tel && tel.length >= 10 ? tel : null, email: t("email")?.toLowerCase() ?? null,
        endereco: [t("descricao_tipo_de_logradouro"), t("logradouro"), t("numero"), t("complemento"), t("bairro")].filter(Boolean).join(", ") || null,
        cidade: t("municipio"), estado: t("uf"), cep: t("cep"), situacao: t("descricao_situacao_cadastral"),
      },
    };
  } catch (e) { return erro(e); }
}
