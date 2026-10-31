"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";
import { OBJETIVOS, TONS, type Horario } from "@/lib/ai/assistente-tipos";
import type { ActionResult } from "@/lib/data/types";

/*
 * Assistente de IA da empresa: o cliente configura o que a IA sabe e como atende.
 * Provedor, modelo e chave NÃO passam por aqui — são só do admin da plataforma (/admin).
 */

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
  if (!ehGestor(empresa.papel)) throw new Error("Só o dono ou um gestor pode configurar o assistente.");
  return { supabase, user, empresa };
}

const texto = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const marcado = (f: FormData, k: string) => f.get(k) === "on";
const revalidar = () => revalidatePath("/app/assistente");

async function gravarPerfil(campos: Record<string, unknown>): Promise<ActionResult> {
  const { supabase, user, empresa } = await gestor();
  const { error } = await supabase.from("ia_perfil")
    .upsert({ ...campos, org_id: empresa.id, updated_by: user.id }, { onConflict: "org_id" });
  if (error) throw error;
  revalidar();
  return { ok: true };
}

/* ---------- Perfil do negócio ---------- */

export async function salvarPerfilIA(f: FormData): Promise<ActionResult> {
  try {
    const nome = texto(f, "nome_assistente", 60);
    const tom = texto(f, "tom", 20);
    if (!nome) return { ok: false, erro: "Dê um nome ao assistente." };
    if (!(tom in TONS)) return { ok: false, erro: "Tom de voz inválido." };
    return await gravarPerfil({
      nome_assistente: nome, tom, usar_emojis: marcado(f, "usar_emojis"),
      saudacao: texto(f, "saudacao", 500),
      sobre: texto(f, "sobre", 4000),
      produtos: texto(f, "produtos", 8000),
      publico: texto(f, "publico", 2000),
      diferenciais: texto(f, "diferenciais", 2000),
      politicas: texto(f, "politicas", 4000),
      contato: texto(f, "contato", 2000),
    });
  } catch (e) { return falha(e); }
}

/* ---------- Regras, transferência e horário ---------- */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function salvarRegrasIA(f: FormData): Promise<ActionResult> {
  try {
    const objetivo = texto(f, "objetivo", 20);
    if (!(objetivo in OBJETIVOS)) return { ok: false, erro: "Objetivo inválido." };

    const horario: Horario = {};
    for (let d = 0; d < 7; d++) {
      if (!marcado(f, `dia_${d}`)) continue;
      const abre = texto(f, `abre_${d}`, 5);
      const fecha = texto(f, `fecha_${d}`, 5);
      if (!HORA.test(abre) || !HORA.test(fecha)) return { ok: false, erro: "Use horários no formato HH:MM." };
      if (abre >= fecha) return { ok: false, erro: "O horário de fechamento precisa ser depois da abertura." };
      horario[String(d)] = [abre, fecha];
    }

    return await gravarPerfil({
      objetivo,
      regras: texto(f, "regras", 4000),
      transferir_quando: texto(f, "transferir_quando", 2000),
      horario,
      fora_horario: texto(f, "fora_horario", 500),
      usar_qualificacao: marcado(f, "usar_qualificacao"),
      aprender_contatos: marcado(f, "aprender_contatos"),
      pode_criar_lead: marcado(f, "pode_criar_lead"),
      pode_criar_tarefa: marcado(f, "pode_criar_tarefa"),
    });
  } catch (e) { return falha(e); }
}

/* ---------- Base de conhecimento ---------- */

const Conhecimento = z.object({
  id: z.string().uuid().nullable(),
  tipo: z.enum(["faq", "documento"]),
  titulo: z.string().trim().min(1, "Informe a pergunta ou o título.").max(300),
  conteudo: z.string().trim().min(1, "Escreva o conteúdo.").max(60000, "Conteúdo grande demais (máx. 60 mil caracteres). Divida em mais de um documento."),
});

export async function salvarConhecimento(f: FormData): Promise<ActionResult> {
  try {
    const p = Conhecimento.safeParse({
      id: String(f.get("id") ?? "") || null,
      tipo: String(f.get("tipo") ?? "faq"),
      titulo: String(f.get("titulo") ?? ""),
      conteudo: String(f.get("conteudo") ?? ""),
    });
    if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
    const { supabase, empresa } = await gestor();
    const { id, ...campos } = p.data;
    // Editar uma sugestão = aprovar
    const { error } = id
      ? await supabase.from("ia_conhecimento").update({ ...campos, status: "ativo" }).eq("id", id).eq("org_id", empresa.id)
      : await supabase.from("ia_conhecimento").insert({ ...campos, org_id: empresa.id, origem: f.get("origem") === "conversa" ? "conversa" : "manual" });
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function definirStatusConhecimento(id: string, status: "ativo" | "arquivado"): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const { error } = await supabase.from("ia_conhecimento").update({ status }).eq("id", id).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirConhecimento(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const { error } = await supabase.from("ia_conhecimento").delete().eq("id", id).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------- Memória ---------- */

export async function salvarMemoria(f: FormData): Promise<ActionResult> {
  try {
    const fato = texto(f, "fato", 500);
    const validoAte = texto(f, "valido_ate", 10);
    if (fato.length < 3) return { ok: false, erro: "Escreva o aviso (mínimo 3 caracteres)." };
    if (validoAte && !/^\d{4}-\d{2}-\d{2}$/.test(validoAte)) return { ok: false, erro: "Data de validade inválida." };
    const { supabase, empresa } = await gestor();
    const { error } = await supabase.from("ia_memoria").insert({
      org_id: empresa.id, escopo: "empresa", fato, origem: "humano", valido_ate: validoAte || null,
    });
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirMemoria(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const { error } = await supabase.from("ia_memoria").delete().eq("id", id).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Atendentes de IA (vários por empresa) ---------------- */

const CANAIS_ATENDENTE = { whatsapp: "wa_conexoes", telegram: "telegram_conexoes", email: "email_conexoes" } as const;

export async function salvarAtendente(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const id = texto(f, "id", 40) || null;
    const nome = texto(f, "nome", 60);
    if (!nome) return { ok: false, erro: "Dê um nome ao atendente." };
    const tom = texto(f, "tom", 20);
    const objetivo = texto(f, "objetivo", 20);
    const padrao = marcado(f, "padrao");
    const campos = {
      nome,
      funcao: texto(f, "funcao", 200),
      saudacao: texto(f, "saudacao", 500),
      tom: tom in TONS ? tom : null,
      objetivo: objetivo in OBJETIVOS ? objetivo : null,
      instrucoes: texto(f, "instrucoes", 8000),
      transferir_quando: texto(f, "transferir_quando", 2000),
      ativo: marcado(f, "ativo"),
      padrao,
    };
    // Um padrão por empresa: desmarca o anterior antes (o índice único recusaria)
    if (padrao) {
      let q = supabase.from("ia_atendentes").update({ padrao: false }).eq("org_id", empresa.id).eq("padrao", true);
      if (id) q = q.neq("id", id);
      const { error } = await q;
      if (error) throw error;
    }
    const { error } = id
      ? await supabase.from("ia_atendentes").update(campos).eq("id", id).eq("org_id", empresa.id)
      : await supabase.from("ia_atendentes").insert({ ...campos, org_id: empresa.id });
    if (error) throw error;
    revalidar();
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirAtendente(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const { error } = await supabase.from("ia_atendentes").delete().eq("id", id).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Qual atendente responde em cada número/canal. atendenteId null = o padrão da empresa. */
export async function atribuirAtendenteCanal(
  canal: keyof typeof CANAIS_ATENDENTE, conexaoId: string, atendenteId: string | null,
): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    if (!(canal in CANAIS_ATENDENTE)) return { ok: false, erro: "Canal inválido." };
    if (atendenteId) {
      // O atendente precisa ser desta empresa (a FK não confere a empresa)
      const { data } = await supabase.from("ia_atendentes").select("id").eq("id", atendenteId).eq("org_id", empresa.id).maybeSingle();
      if (!data) return { ok: false, erro: "Atendente não encontrado." };
    }
    const { error } = await supabase.from(CANAIS_ATENDENTE[canal]).update({ atendente_id: atendenteId })
      .eq("id", conexaoId).eq("org_id", empresa.id);
    if (error) throw error;
    revalidar();
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}
