"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { campo, traduzErro } from "@/lib/data/format";
import {
  CAMPAIGN_STATUS, CANAL, LEAD_ORIGEM, LEAD_STATUS,
  type ActionResult, type CampaignStatus, type Canal, type LeadOrigem, type LeadStatus,
} from "@/lib/data/types";

/* Tappo — mutações do app. Toda escrita passa pelo cliente do usuário (RLS = dono). */

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

function falha(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: traduzErro(msg) };
}

function revalidar(...paths: string[]) {
  for (const p of ["/app", ...paths]) revalidatePath(p);
}

const umDe = <T extends readonly string[]>(lista: T, v: string | null, padrao: T[number]): T[number] =>
  v && (lista as readonly string[]).includes(v) ? (v as T[number]) : padrao;

/* ---------------- Leads ---------------- */

function leadDoForm(fd: FormData) {
  return {
    nome: campo(fd, "nome") ?? "",
    empresa: campo(fd, "empresa") ?? "",
    cargo: campo(fd, "cargo"),
    email: campo(fd, "email"),
    telefone: campo(fd, "telefone"),
    linkedin_url: campo(fd, "linkedin_url"),
    segmento: campo(fd, "segmento"),
    origem: umDe(LEAD_ORIGEM, campo(fd, "origem"), "Prospecção") as LeadOrigem,
    status: umDe(LEAD_STATUS, campo(fd, "status"), "Nova") as LeadStatus,
    notas: campo(fd, "notas"),
    proximo_contato_em: campo(fd, "proximo_contato_em"),
  };
}

export async function salvarLead(id: string | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const dados = leadDoForm(fd);
    if (!dados.nome || !dados.empresa) return { ok: false, erro: "Nome e empresa são obrigatórios." };
    const { error } = id
      ? await supabase.from("leads").update(dados).eq("id", id)
      : await supabase.from("leads").insert(dados);
    if (error) return falha(error);
    revalidar("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function mudarStatusLead(id: string, status: LeadStatus): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirLead(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/leads", "/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Importa CSV simples: cabeçalho com nome,empresa,cargo,email,telefone,segmento */
export async function importarLeads(csv: string): Promise<ActionResult & { total?: number }> {
  try {
    const { supabase } = await cliente();
    const linhas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length < 2) return { ok: false, erro: "O arquivo precisa de cabeçalho e ao menos uma linha." };
    const sep = linhas[0].includes(";") ? ";" : ",";
    const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase().replace(/"/g, ""));
    const idx = (n: string) => cab.indexOf(n);
    if (idx("nome") < 0 || idx("empresa") < 0) return { ok: false, erro: "Cabeçalho precisa ter as colunas nome e empresa." };
    const val = (cols: string[], n: string) => {
      const i = idx(n);
      const v = i >= 0 ? cols[i]?.trim().replace(/^"|"$/g, "") : "";
      return v ? v : null;
    };
    const registros = linhas.slice(1, 1001).map((l) => {
      const cols = l.split(sep);
      return {
        nome: val(cols, "nome") ?? "",
        empresa: val(cols, "empresa") ?? "",
        cargo: val(cols, "cargo"),
        email: val(cols, "email"),
        telefone: val(cols, "telefone"),
        segmento: val(cols, "segmento"),
        origem: "Prospecção" as LeadOrigem,
      };
    }).filter((r) => r.nome && r.empresa);
    if (!registros.length) return { ok: false, erro: "Nenhuma linha válida (nome e empresa são obrigatórios)." };
    // Inserção sequencial em lotes pequenos: o código GAR-xxxx é gerado por trigger
    for (let i = 0; i < registros.length; i += 100) {
      const { error } = await supabase.from("leads").insert(registros.slice(i, i + 100));
      if (error) return falha(error);
    }
    await supabase.from("activities").insert({ tipo: "importacao", descricao: `${registros.length} leads importados via CSV` });
    revalidar("/app/leads");
    return { ok: true, total: registros.length };
  } catch (e) { return falha(e); }
}

export async function registrarAtividade(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const descricao = campo(fd, "descricao");
    if (!descricao) return { ok: false, erro: "Descreva a atividade." };
    const { error } = await supabase.from("activities").insert({
      tipo: campo(fd, "tipo") ?? "nota",
      descricao,
      lead_id: campo(fd, "lead_id"),
      deal_id: campo(fd, "deal_id"),
    });
    if (error) return falha(error);
    revalidar("/app/leads", "/app/pipeline");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Campanhas ---------------- */

export type PassoInput = { dia: number; canal: Canal; acao: string };

export async function salvarCampanha(
  id: string | null,
  dados: { nome: string; descricao: string | null; status: CampaignStatus; passos: PassoInput[] },
): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const nome = dados.nome.trim();
    if (!nome) return { ok: false, erro: "Dê um nome à campanha." };
    const status = umDe(CAMPAIGN_STATUS, dados.status, "Rascunho");
    const passos = dados.passos
      .filter((p) => p.acao.trim())
      .map((p, i) => ({ ordem: i + 1, dia: Math.max(0, Math.round(p.dia)), canal: umDe(CANAL, p.canal, "E-mail"), acao: p.acao.trim() }));

    let campaignId = id;
    if (id) {
      const { error } = await supabase.from("campaigns").update({ nome, descricao: dados.descricao, status }).eq("id", id);
      if (error) return falha(error);
      const { error: e2 } = await supabase.from("campaign_steps").delete().eq("campaign_id", id);
      if (e2) return falha(e2);
    } else {
      const { data, error } = await supabase.from("campaigns").insert({ nome, descricao: dados.descricao, status }).select("id").single();
      if (error) return falha(error);
      campaignId = data.id;
    }
    if (passos.length) {
      const { error } = await supabase.from("campaign_steps").insert(passos.map((p) => ({ ...p, campaign_id: campaignId })));
      if (error) return falha(error);
    }
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function mudarStatusCampanha(id: string, status: CampaignStatus): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirCampanha(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function adicionarLeadsCampanha(campaignId: string, leadIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    if (!leadIds.length) return { ok: false, erro: "Selecione ao menos um lead." };
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("campaign_leads").upsert(
      leadIds.map((lead_id) => ({ campaign_id: campaignId, lead_id, proximo_passo_em: hoje })),
      { onConflict: "campaign_id,lead_id", ignoreDuplicates: true },
    );
    if (error) return falha(error);
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Marca a próxima etapa da cadência como executada para um lead da campanha. */
export async function avancarEtapa(campaignLeadId: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { data: cl, error } = await supabase
      .from("campaign_leads").select("id, campaign_id, etapas_concluidas").eq("id", campaignLeadId).single();
    if (error) return falha(error);
    const { data: passos } = await supabase
      .from("campaign_steps").select("ordem, dia").eq("campaign_id", cl.campaign_id).order("ordem");
    const total = passos?.length ?? 0;
    const feitas = Math.min(total, cl.etapas_concluidas + 1);
    const prox = passos?.[feitas];
    const atual = passos?.[feitas - 1];
    const proximoEm = prox && atual
      ? new Date(Date.now() + Math.max(0, prox.dia - atual.dia) * 86400000).toISOString().slice(0, 10)
      : null;
    const { error: e2 } = await supabase.from("campaign_leads").update({
      etapas_concluidas: feitas,
      proximo_passo_em: proximoEm,
      ...(feitas >= total ? { status: "Concluído" } : {}),
    }).eq("id", campaignLeadId);
    if (e2) return falha(e2);
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function mudarStatusLeadCampanha(campaignLeadId: string, status: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("campaign_leads").update({ status }).eq("id", campaignLeadId);
    if (error) return falha(error);
    revalidar("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Pipeline ---------------- */

export async function salvarDeal(id: string | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const valorTxt = (campo(fd, "valor") ?? "0").replace(/\./g, "").replace(",", ".");
    const dados = {
      titulo: campo(fd, "titulo") ?? "",
      empresa: campo(fd, "empresa") ?? "",
      contato: campo(fd, "contato"),
      lead_id: campo(fd, "lead_id"),
      stage_id: campo(fd, "stage_id") ?? "",
      valor: Math.max(0, Number(valorTxt) || 0),
      data_fechamento_previsto: campo(fd, "data_fechamento_previsto"),
      notas: campo(fd, "notas"),
    };
    if (!dados.titulo || !dados.empresa || !dados.stage_id) return { ok: false, erro: "Título, empresa e etapa são obrigatórios." };
    const { error } = id
      ? await supabase.from("deals").update(dados).eq("id", id)
      : await supabase.from("deals").insert(dados);
    if (error) return falha(error);
    revalidar("/app/pipeline", "/app/analytics");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function moverDeal(id: string, stageId: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("deals").update({ stage_id: stageId }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/pipeline", "/app/analytics");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirDeal(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/pipeline", "/app/analytics");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Perfil ---------------- */

export async function salvarPerfil(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const meta = Number(campo(fd, "meta_reunioes_semana") ?? 5);
    const { error } = await supabase.from("profiles").update({
      nome_completo: campo(fd, "nome_completo"),
      empresa: campo(fd, "empresa"),
      cargo: campo(fd, "cargo"),
      telefone: campo(fd, "telefone"),
      meta_reunioes_semana: Number.isFinite(meta) ? Math.max(0, Math.min(200, Math.round(meta))) : 5,
    }).eq("id", user.id);
    if (error) return falha(error);
    revalidar("/app/perfil");
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function trocarSenha(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const senha = String(fd.get("senha") ?? "");
    if (senha.length < 8) return { ok: false, erro: "A senha deve ter pelo menos 8 caracteres." };
    if (senha !== fd.get("confirmar")) return { ok: false, erro: "As senhas não conferem." };
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return falha(error);
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Captação (webhooks) ---------------- */

export async function salvarFonte(id: string | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const nome = campo(fd, "nome");
    if (!nome) return { ok: false, erro: "Dê um nome à fonte." };
    const dados = {
      nome,
      origem: umDe(LEAD_ORIGEM, campo(fd, "origem"), "Site"),
      status_inicial: umDe(LEAD_STATUS, campo(fd, "status_inicial"), "Nova"),
    };
    const { error } = id
      ? await supabase.from("lead_sources").update(dados).eq("id", id)
      : await supabase.from("lead_sources").insert(dados);
    if (error) return falha(error);
    revalidar("/app/captacao");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function alternarFonte(id: string, ativo: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("lead_sources").update({ ativo }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/captacao");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirFonte(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("lead_sources").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/captacao");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Respostas rápidas ---------------- */

export async function salvarTemplate(id: string | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const titulo = campo(fd, "titulo");
    const corpo = campo(fd, "corpo");
    if (!titulo || !corpo) return { ok: false, erro: "Título e texto são obrigatórios." };
    const dados = { titulo, corpo, assunto: campo(fd, "assunto"), canal: umDe(CANAL, campo(fd, "canal"), "E-mail") };
    const { error } = id
      ? await supabase.from("templates").update(dados).eq("id", id)
      : await supabase.from("templates").insert(dados);
    if (error) return falha(error);
    revalidar("/app/respostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirTemplate(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/respostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function contarUsoTemplate(id: string, usos: number): Promise<void> {
  const { supabase } = await cliente();
  await supabase.from("templates").update({ usos: usos + 1 }).eq("id", id);
}

/* ---------------- Radar ---------------- */

/** Reagenda o próximo contato do lead para daqui a N dias. */
export async function adiarLead(id: string, dias: number): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const data = new Date(Date.now() + Math.max(0, dias) * 86400000);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
    const { error } = await supabase.from("leads").update({ proximo_contato_em: iso }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/radar", "/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Registra que o lead foi contatado agora (vira atividade e tira do radar). */
export async function marcarContato(leadId: string, tipo: "ligacao" | "email" | "whatsapp" | "linkedin", nome: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const rotulo = { ligacao: "Ligação", email: "E-mail", whatsapp: "WhatsApp", linkedin: "LinkedIn" }[tipo];
    const { error } = await supabase.from("activities").insert({ tipo, descricao: `${rotulo} com ${nome}`, lead_id: leadId });
    if (error) return falha(error);
    const em3 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 3 * 86400000));
    await supabase.from("leads").update({ proximo_contato_em: em3 }).eq("id", leadId);
    revalidar("/app/radar", "/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}
