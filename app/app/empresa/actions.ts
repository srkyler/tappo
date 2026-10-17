"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { empresaAtual } from "@/lib/data/empresa";
import { enviarEmail } from "@/lib/email/resend";
import { SEGMENTOS, ehGestor, type Papel } from "@/lib/segmentos";
import type { ActionResult } from "@/lib/data/types";

/* Empresa, equipe e convites. Escritas sensíveis passam pela service role após checar o papel. */

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

async function gestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const empresa = await empresaAtual();
  if (!empresa) throw new Error("Empresa não encontrada.");
  if (!ehGestor(empresa.papel)) throw new Error("Só o dono ou um gestor pode fazer isso.");
  return { supabase, user, empresa };
}

const PAPEIS_CONVITE = ["gestor", "vendedor", "atendente"] as const;
const segmentoValido = (s: string) => SEGMENTOS.some((x) => x.id === s);

function revalidar() {
  revalidatePath("/app", "layout");
}

export async function salvarEmpresa(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const nome = String(f.get("nome") ?? "").trim().slice(0, 120);
    const segmento = String(f.get("segmento") ?? "geral");
    if (!nome) return { ok: false, erro: "Informe o nome da empresa." };
    if (!segmentoValido(segmento)) return { ok: false, erro: "Segmento inválido." };
    const { error } = await supabase.from("organizacoes").update({ nome, segmento }).eq("id", empresa.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Troca as etapas do funil padrão pelas do segmento (só se ainda não houver negócios nele). */
export async function aplicarFunilDoSegmento(): Promise<ActionResult> {
  try {
    const { supabase, user, empresa } = await gestor();
    const { data: padrao, error: ep } = await supabase.from("pipelines").select("id").eq("org_id", empresa.id).eq("padrao", true).single();
    if (ep || !padrao) throw ep ?? new Error("Funil padrão não encontrado.");
    const { data: etapasAtuais } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", padrao.id);
    const idsAtuais = (etapasAtuais ?? []).map((x) => x.id);
    if (idsAtuais.length) {
      const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).in("stage_id", idsAtuais);
      if ((count ?? 0) > 0) return { ok: false, erro: "Já existem negócios no funil. Edite as etapas manualmente no Pipeline." };
    }
    const { data: etapas, error: e1 } = await supabase.rpc("etapas_do_segmento", { seg: empresa.segmento });
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("pipeline_stages").delete().eq("pipeline_id", padrao.id);
    if (e2) throw e2;
    const { error: e3 } = await supabase.from("pipeline_stages").insert(
      (etapas as { nome: string; ordem: number; probabilidade: number; tipo: string }[]).map((x) => ({ ...x, org_id: empresa.id, user_id: user.id, pipeline_id: padrao.id })),
    );
    if (e3) throw e3;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function convidar(email: string, papel: string): Promise<{ ok: true; link: string; direto: boolean } | { ok: false; erro: string }> {
  try {
    const { user, empresa } = await gestor();
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, erro: "E-mail inválido." };
    if (!(PAPEIS_CONVITE as readonly string[]).includes(papel)) return { ok: false, erro: "Papel inválido." };
    if (papel === "gestor" && empresa.papel !== "dono") return { ok: false, erro: "Só o dono pode convidar gestores." };

    const admin = createAdminClient();
    const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

    // Já tem conta: entra direto na equipe
    const { data: perfil } = await admin.from("profiles").select("id, org_atual").ilike("email", e).maybeSingle();
    if (perfil) {
      const { error } = await admin.from("org_membros").upsert({ org_id: empresa.id, user_id: perfil.id, papel, ativo: true }, { onConflict: "org_id,user_id" });
      if (error) throw error;
      if (!perfil.org_atual) await admin.from("profiles").update({ org_atual: empresa.id }).eq("id", perfil.id);
      revalidar();
      return { ok: true, link: `${app}/app`, direto: true };
    }

    const { data: conv, error } = await admin.from("org_convites")
      .insert({ org_id: empresa.id, email: e, papel, convidado_por: user.id })
      .select("token").single();
    if (error) throw error;
    const link = `${app}/convite/${conv.token}`;
    await enviarEmail("convite", e, { nome: empresa.nome, url: link, userId: user.id }).catch(() => null);
    revalidar();
    return { ok: true, link, direto: false };
  } catch (e) { return falha(e); }
}

export async function cancelarConvite(id: string): Promise<ActionResult> {
  try {
    const { empresa } = await gestor();
    const { error } = await createAdminClient().from("org_convites").delete().eq("id", id).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function mudarPapel(userId: string, papel: Papel): Promise<ActionResult> {
  try {
    const { user, empresa } = await gestor();
    if (!["dono", "gestor", "vendedor", "atendente"].includes(papel)) return { ok: false, erro: "Papel inválido." };
    const admin = createAdminClient();
    const { data: alvo } = await admin.from("org_membros").select("papel").eq("org_id", empresa.id).eq("user_id", userId).maybeSingle();
    if (!alvo) return { ok: false, erro: "Membro não encontrado." };
    if ((alvo.papel === "dono" || papel === "dono" || papel === "gestor") && empresa.papel !== "dono") return { ok: false, erro: "Só o dono pode mudar donos e gestores." };
    if (alvo.papel === "dono" && papel !== "dono") {
      const { count } = await admin.from("org_membros").select("user_id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("papel", "dono").eq("ativo", true);
      if ((count ?? 0) <= 1) return { ok: false, erro: "A empresa precisa de pelo menos um dono." };
    }
    if (userId === user.id && papel !== "dono" && empresa.papel === "dono") {
      const { count } = await admin.from("org_membros").select("user_id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("papel", "dono").eq("ativo", true);
      if ((count ?? 0) <= 1) return { ok: false, erro: "Você é o único dono. Promova outra pessoa antes." };
    }
    const { error } = await admin.from("org_membros").update({ papel }).eq("org_id", empresa.id).eq("user_id", userId);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function definirAtivo(userId: string, ativo: boolean): Promise<ActionResult> {
  try {
    const { user, empresa } = await gestor();
    if (userId === user.id) return { ok: false, erro: "Você não pode remover a si mesmo." };
    const admin = createAdminClient();
    const { data: alvo } = await admin.from("org_membros").select("papel").eq("org_id", empresa.id).eq("user_id", userId).maybeSingle();
    if (!alvo) return { ok: false, erro: "Membro não encontrado." };
    if (alvo.papel === "dono" && empresa.papel !== "dono") return { ok: false, erro: "Só o dono pode remover outro dono." };
    const { error } = await admin.from("org_membros").update({ ativo }).eq("org_id", empresa.id).eq("user_id", userId);
    if (error) throw error;
    // Conversas e tarefas abertas da pessoa voltam para a fila
    if (!ativo) {
      await admin.from("wa_conversas").update({ atribuido_a: null }).eq("org_id", empresa.id).eq("atribuido_a", userId).neq("status", "resolvida");
    }
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function trocarEmpresa(orgId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const { error } = await supabase.from("profiles").update({ org_atual: orgId }).eq("id", user.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Nova empresa com o usuário como dono (ex.: agência que atende vários clientes). */
export async function criarEmpresa(nome: string, segmento: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    const n = nome.trim().slice(0, 120);
    if (!n) return { ok: false, erro: "Informe o nome." };
    if (!segmentoValido(segmento)) return { ok: false, erro: "Segmento inválido." };
    const admin = createAdminClient();
    const { data: org, error } = await admin.from("organizacoes").insert({ nome: n, segmento }).select("id").single();
    if (error) throw error;
    await admin.from("org_membros").insert({ org_id: org.id, user_id: user.id, papel: "dono" });
    const { data: pipeline } = await admin.from("pipelines").insert({ org_id: org.id, nome: "Principal", padrao: true }).select("id").single();
    const { data: etapas } = await admin.rpc("etapas_do_segmento", { seg: segmento });
    await admin.from("pipeline_stages").insert(
      ((etapas ?? []) as { nome: string; ordem: number; probabilidade: number; tipo: string }[]).map((x) => ({ ...x, org_id: org.id, user_id: user.id, pipeline_id: pipeline?.id })),
    );
    await admin.from("profiles").update({ org_atual: org.id }).eq("id", user.id);
    await admin.rpc("templates_padrao", { uid: user.id });
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function salvarMeta(userId: string, mes: string, metaValor: number, metaVendas: number): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    if (!/^\d{4}-\d{2}-01$/.test(mes)) return { ok: false, erro: "Mês inválido." };
    const { error } = await supabase.from("metas").upsert(
      { org_id: empresa.id, user_id: userId, mes, meta_valor: Math.max(0, metaValor || 0), meta_vendas: Math.max(0, Math.round(metaVendas || 0)) },
      { onConflict: "org_id,user_id,mes" },
    );
    if (error) throw error;
    revalidatePath("/app/gestor");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function salvarMetas(f: FormData): Promise<ActionResult> {
  try {
    const { empresa } = await gestor();
    const mes = String(f.get("mes") ?? "");
    if (!/^\d{4}-\d{2}-01$/.test(mes)) return { ok: false, erro: "Mês inválido." };
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const userIds = (f.getAll("user_id") as string[]);
    const metaValores = (f.getAll("meta_valor") as string[]);
    const metaVendases = (f.getAll("meta_vendas") as string[]);
    for (let i = 0; i < userIds.length; i++) {
      const { error } = await admin.from("metas").upsert(
        { org_id: empresa.id, user_id: userIds[i], mes, meta_valor: Math.max(0, Number(metaValores[i]) || 0), meta_vendas: Math.max(0, Math.round(Number(metaVendases[i]) || 0)) },
        { onConflict: "org_id,user_id,mes" },
      );
      if (error) throw error;
    }
    revalidatePath("/app/gestor");
    return { ok: true };
  } catch (e) { return falha(e); }
}
