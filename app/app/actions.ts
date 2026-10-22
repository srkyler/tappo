"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispararAutomacoes } from "@/lib/automacoes";
import { campo, traduzErro } from "@/lib/data/format";
import {
  CAMPAIGN_STATUS, CANAL, LEAD_ORIGEM, LEAD_STATUS,
  type ActionResult, type CampaignStatus, type Canal, type CampaignStep, type LeadOrigem, type LeadStatus,
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

    // Detectar duplicados antes de inserir
    const duplicados: { campo: "telefone" | "email"; valor: string; lead_id: string; lead_nome: string }[] = [];
    if (dados.telefone) {
      const { data: tel } = await supabase.from("leads").select("id, nome, telefone").eq("telefone", dados.telefone).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
      for (const l of (tel ?? [])) duplicados.push({ campo: "telefone", valor: l.telefone!, lead_id: l.id, lead_nome: l.nome });
    }
    if (dados.email) {
      const { data: em } = await supabase.from("leads").select("id, nome, email").eq("email", dados.email).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
      for (const l of (em ?? [])) duplicados.push({ campo: "email", valor: l.email!, lead_id: l.id, lead_nome: l.nome });
    }

    const { data: resultado, error } = id
      ? await supabase.from("leads").update(dados).eq("id", id).select("id").single()
      : await supabase.from("leads").insert(dados).select("id").single();
    if (error) return falha(error);

    // Registrar duplicados encontrados (org_id tem DEFAULT public.org_atual())
    if (duplicados.length > 0 && resultado?.id) {
      for (const d of duplicados) {
        await supabase.from("lead_duplicados").insert({
          lead_id: resultado.id,
          duplicado_de: d.lead_id,
          campo: d.campo,
          valor: d.valor,
        });
      }
    }

    revalidar("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Detectar duplicados de um lead (telefone ou email) antes de criar. Retorna os duplicados encontrados. */
export async function detectarDuplicadosLead(telefone: string | null, email: string | null): Promise<{ duplicados: { campo: string; valor: string; lead_id: string; lead_nome: string }[] }> {
  const { supabase } = await cliente();
  const duplicados: { campo: string; valor: string; lead_id: string; lead_nome: string }[] = [];
  if (telefone) {
    const { data: tel } = await supabase.from("leads").select("id, nome, telefone").eq("telefone", telefone);
    for (const l of (tel ?? [])) duplicados.push({ campo: "telefone", valor: l.telefone!, lead_id: l.id, lead_nome: l.nome });
  }
  if (email) {
    const { data: em } = await supabase.from("leads").select("id, nome, email").eq("email", email);
    for (const l of (em ?? [])) duplicados.push({ campo: "email", valor: l.email!, lead_id: l.id, lead_nome: l.nome });
  }
  return { duplicados };
}

export async function mudarStatusLead(id: string, status: LeadStatus): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return falha(error);
    await dispararAutomacoes(supabase, "lead_mudou_status", status, { leadId: id });
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
export async function importarLeads(csv: string): Promise<ActionResult & { total?: number; duplicados?: { linha: number; campo: string; valor: string; lead_id: string; lead_nome: string }[] }> {
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

    // Detectar duplicados por telefone e email
    const duplicados: { linha: number; campo: string; valor: string; lead_id: string; lead_nome: string }[] = [];
    const registrosValidos: typeof registros = [];
    for (let i = 0; i < registros.length; i++) {
      const r = registros[i];
      let ehDuplicado = false;
      if (r.telefone) {
        const { data: tel } = await supabase.from("leads").select("id, nome, telefone").eq("telefone", r.telefone);
        if (tel?.length) {
          duplicados.push({ linha: i + 2, campo: "telefone", valor: r.telefone, lead_id: tel[0].id, lead_nome: tel[0].nome });
          ehDuplicado = true;
        }
      }
      if (!ehDuplicado && r.email) {
        const { data: em } = await supabase.from("leads").select("id, nome, email").eq("email", r.email);
        if (em?.length) {
          duplicados.push({ linha: i + 2, campo: "email", valor: r.email, lead_id: em[0].id, lead_nome: em[0].nome });
          ehDuplicado = true;
        }
      }
      if (!ehDuplicado) registrosValidos.push(r);
    }

    // Inserção sequencial em lotes pequenos: o código GAR-xxxx é gerado por trigger
    for (let i = 0; i < registrosValidos.length; i += 100) {
      const { error } = await supabase.from("leads").insert(registrosValidos.slice(i, i + 100));
      if (error) return falha(error);
    }
    await supabase.from("activities").insert({ tipo: "importacao", descricao: `${registrosValidos.length} leads importados via CSV${duplicados.length > 0 ? ` (${duplicados.length} duplicados ignorados)` : ""}` });
    revalidar("/app/leads");
    return { ok: true, total: registrosValidos.length, duplicados };
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
    for (const leadId of leadIds) await dispararAutomacoes(supabase, "lead_entrou_campanha", campaignId, { leadId });
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
    revalidatePath("/app/campanhas");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Cadência multi-canal ---------------- */

export async function executarProximaEtapaCampanha(campaignLeadId: string): Promise<ActionResult & { etapa?: CampaignStep }> {
  try {
    const { supabase } = await cliente();

    // Buscar o próximo passo da campanha para este lead
    const { data: cl, error: e1 } = await supabase
      .from("campaign_leads")
      .select("*, campaign_id, lead_id, etapas_concluidas, status")
      .eq("id", campaignLeadId)
      .single();
    if (e1) return falha(e1);
    if (!cl) return { ok: false, erro: "Campanha-lead não encontrada." };

    const proximaEtapa = cl.etapas_concluidas + 1;

    const { data: passos, error: e2 } = await supabase
      .from("campaign_steps")
      .select("*")
      .eq("campaign_id", cl.campaign_id)
      .eq("ordem", proximaEtapa)
      .single();
    if (e2 || !passos) {
      // Não há mais passos - marcar como concluído
      await supabase.from("campaign_leads").update({ status: "Concluído" }).eq("id", campaignLeadId);
      revalidatePath("/app/campanhas");
      return { ok: true };
    }

    // Buscar dados do lead
    const { data: lead } = await supabase
      .from("leads")
      .select("nome, telefone, email, empresa")
      .eq("id", cl.lead_id)
      .single();

    // Executar a ação baseado no canal
    const corpo = passos.acao
      .replace(/\{\{nome\}\}/g, lead?.nome || "")
      .replace(/\{\{empresa\}\}/g, lead?.empresa || "")
      .replace(/\{\{email\}\}/g, lead?.email || "")
      .replace(/\{\{telefone\}\}/g, lead?.telefone || "");

    if (passos.canal === "WhatsApp") {
      // Enviar mensagem via WhatsApp (inserir em wa_mensagens para o WAHA processar)
      const { data: conversa } = await supabase
        .from("wa_conversas")
        .select("id")
        .eq("lead_id", cl.lead_id)
        .maybeSingle();

      if (conversa) {
        await supabase.from("wa_mensagens").insert({
          org_id: cl.org_id || "",
          conversa_id: conversa.id,
          direcao: "saida",
          autor: "humano",
          tipo: "texto",
          corpo,
          status: "enviado",
          enviado_por: cl.lead_id,
        });
      }
    } else if (passos.canal === "E-mail") {
      // Inserir como atividade de e-mail
      await supabase.from("activities").insert({
        org_id: cl.org_id || "",
        user_id: cl.lead_id,
        tipo: "email",
        descricao: `E-mail enviado: ${corpo}`,
        lead_id: cl.lead_id,
        campanha_id: cl.campaign_id,
        ocorreu_em: new Date().toISOString(),
      });
    } else if (passos.canal === "Ligação") {
      await supabase.from("activities").insert({
        org_id: cl.org_id || "",
        user_id: cl.lead_id,
        tipo: "ligacao",
        descricao: `Ligação feita: ${corpo}`,
        lead_id: cl.lead_id,
        campanha_id: cl.campaign_id,
        ocorreu_em: new Date().toISOString(),
      });
    }

    // Avançar etapa
    const { error: e3 } = await supabase.from("campaign_leads").update({
      etapas_concluidas: proximaEtapa,
      proximo_passo_em: new Date(Date.now() + 86400000).toISOString(), // próximo dia
    }).eq("id", campaignLeadId);
    if (e3) return falha(e3);

    revalidatePath("/app/campanhas");
    return { ok: true, etapa: passos };
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

export async function moverDeal(id: string, stageId: string, motivoPerda?: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { data: antes } = await supabase.from("deals").select("id, valor, user_id, stage_id").eq("id", id).single();
    const { data, error } = await supabase.from("deals").update({
      stage_id: stageId,
      motivo_perda: motivoPerda?.trim() || null,
    }).eq("id", id).select("lead_id, user_id, valor, stage_id").single();
    if (error) return falha(error);
    await dispararAutomacoes(supabase, "deal_mudou_etapa", stageId, { dealId: id, leadId: data?.lead_id ?? null });

    // Calcular comissão automática quando deal vira "ganho"
    const stage = await supabase.from("pipeline_stages").select("tipo").eq("id", stageId).single();
    if (stage.data?.tipo === "ganho" && antes?.user_id && data?.valor) {
      const { data: comissoesConfig } = await supabase.from("org_membros").select("papel").eq("user_id", data.user_id).single();
      const percentual = comissoesConfig?.papel === "vendedor" ? 10 : 5; // padrão: 10% vendedor, 5% outros
      const valor_comissao = Number(data.valor) * (percentual / 100);
      const mes = new Date().toISOString().slice(0, 7) + "-01";
      await supabase.from("comissoes").insert({
        org_id: (await supabase.from("profiles").select("org_atual").eq("id", data.user_id).single()).data?.org_atual,
        user_id: data.user_id,
        deal_id: id,
        percentual,
        valor_comissao,
        status: "pendente",
        mes,
      });
    }

    revalidar("/app/pipeline", "/app/analytics", "/app/comissoes");
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

/* ---------------- Funis (pipelines) ---------------- */

const ETAPAS_PADRAO = [
  { nome: "Prospecção", ordem: 1, probabilidade: 10, tipo: "aberto" },
  { nome: "Qualificado", ordem: 2, probabilidade: 30, tipo: "aberto" },
  { nome: "Reunião", ordem: 3, probabilidade: 50, tipo: "aberto" },
  { nome: "Proposta", ordem: 4, probabilidade: 70, tipo: "aberto" },
  { nome: "Ganho", ordem: 5, probabilidade: 100, tipo: "ganho" },
  { nome: "Perdido", ordem: 6, probabilidade: 0, tipo: "perdido" },
] as const;

export async function criarPipeline(nome: string): Promise<ActionResult & { id?: string }> {
  try {
    const { supabase } = await cliente();
    const n = nome.trim().slice(0, 80);
    if (!n) return { ok: false, erro: "Informe o nome do funil." };
    const { data: pipeline, error } = await supabase.from("pipelines").insert({ nome: n }).select("id").single();
    if (error) return falha(error);
    const { error: e2 } = await supabase.from("pipeline_stages").insert(
      ETAPAS_PADRAO.map((e) => ({ ...e, pipeline_id: pipeline.id })),
    );
    if (e2) return falha(e2);
    revalidar("/app/pipeline");
    return { ok: true, id: pipeline.id };
  } catch (e) { return falha(e); }
}

export async function renomearPipeline(id: string, nome: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const n = nome.trim().slice(0, 80);
    if (!n) return { ok: false, erro: "Informe o nome do funil." };
    const { error } = await supabase.from("pipelines").update({ nome: n }).eq("id", id);
    if (error) return falha(error);
    revalidar("/app/pipeline");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirPipeline(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const { data: pl } = await supabase.from("pipelines").select("padrao").eq("id", id).single();
    if (pl?.padrao) return { ok: false, erro: "O funil padrão não pode ser excluído." };
    const { data: etapas } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", id);
    const idsEtapas = (etapas ?? []).map((e) => e.id);
    if (idsEtapas.length) {
      const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).in("stage_id", idsEtapas);
      if ((count ?? 0) > 0) return { ok: false, erro: "Esse funil tem negócios. Mova-os para outro funil antes de excluir." };
    }
    const { error } = await supabase.from("pipelines").delete().eq("id", id);
    if (error) return falha(error);
    revalidar("/app/pipeline");
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

export async function salvarCorDestaque(cor: string): Promise<ActionResult> {
  try {
    if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) return { ok: false, erro: "Cor inválida." };
    const { supabase, user } = await cliente();
    const { error } = await supabase.from("profiles").update({ cor_destaque: cor }).eq("id", user.id);
    if (error) return falha(error);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function salvarAvatarIcone(icone: string | null): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const { error } = await supabase.from("profiles").update({ avatar_icone: icone }).eq("id", user.id);
    if (error) return falha(error);
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
