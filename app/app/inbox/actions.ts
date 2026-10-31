"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarERegistrar } from "@/lib/whatsapp/atendimento";
import { dispararWebhooks } from "@/lib/webhooks/saida";
import { apagarSessao, chatDoTelefone, codigoDePareamento, desconectar, iniciarSessao, lerQr, lerSessao, marcarLida, type Conexao } from "@/lib/whatsapp/waha";
import type { ActionResult } from "@/lib/data/types";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

/* Inbox do WhatsApp — tudo pelo cliente do usuário (RLS = dono). */

async function cliente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return { supabase, user };
}

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: /fetch failed|ECONNREFUSED|timeout/i.test(msg) ? "Não foi possível falar com o servidor WAHA. Verifique WAHA_BASE_URL/WAHA_API_KEY no .env." : msg };
}

/**
 * Conexão que fala com o contato: a que recebeu a conversa (wa_conversas.conexao_id);
 * sem ela (conversa nova, ou a conexão foi excluída), o primeiro número conectado da empresa.
 * A empresa pode ter vários números — `.maybeSingle()` sem filtro quebrava com 2+.
 */
async function minhaConexao(conexaoId?: string | null): Promise<Conexao> {
  const { supabase } = await cliente();
  if (conexaoId) {
    const { data } = await supabase.from("wa_conexoes").select("*").eq("id", conexaoId).maybeSingle();
    if (data) return data as Conexao;
  }
  const { data } = await supabase.from("wa_conexoes").select("*")
    .order("status", { ascending: false }) // WORKING antes de STOPPED/SCAN_QR_CODE…
    .order("created_at", { ascending: true }).limit(5);
  const conexao = data?.find((c) => c.status === "WORKING") ?? data?.[0];
  if (!conexao) throw new Error("Configure a conexão com o WAHA primeiro.");
  return conexao as Conexao;
}

/* ---------------- Conexão ---------------- */

export async function salvarConexao(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa || !ehGestor(empresa.papel)) return { ok: false, erro: "Só o dono ou um gestor pode configurar o WhatsApp." };
    // URL e API key do WAHA vêm do .env do servidor; a UI não mostra nem pede.
    const base_url = String(f.get("base_url") ?? "").trim().replace(/\/+$/, "");
    if (!base_url && !process.env.WAHA_BASE_URL && !process.env.WAHA_DOMAIN) {
      return { ok: false, erro: "WAHA não configurado no servidor: defina WAHA_BASE_URL (ou WAHA_DOMAIN) e WAHA_API_KEY no .env." };
    }
    const sessao = String(f.get("sessao") ?? "default").trim() || "default";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessao)) return { ok: false, erro: "Nome da sessão: só letras, números, _ e -." };
    const apelido = String(f.get("apelido") ?? "").trim() || "Conexão WhatsApp";
    const campos = {
      apelido,
      distribuicao: f.get("distribuicao") === "rodizio" ? "rodizio" as const : "manual" as const,
      ia_ativa: f.get("ia_ativa") === "on",
      ia_instrucoes: String(f.get("ia_instrucoes") ?? "").slice(0, 6000),
    };
    const id = String(f.get("id") ?? "").trim();
    if (id) {
      // Edição: sessão e URL nunca mudam aqui (sessão viva no WAHA)
      const { error } = await supabase.from("wa_conexoes").update(campos).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("wa_conexoes").insert({
        org_id: empresa.id,
        user_id: user.id,
        ...campos,
        base_url: base_url || null,
        sessao,
      });
      if (error) throw error;
    }
    revalidatePath("/app/inbox");
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export type EstadoWhats = { ok: true; status: string; numero: string | null; qr: string | null } | { ok: false; erro: string };

export async function estadoWhatsApp(conexaoId?: string): Promise<EstadoWhats> {
  try {
    const c = conexaoId ? await conexaoPorId(conexaoId) : await minhaConexao();
    if (!c) return { ok: false, erro: "Conexão não encontrada." };
    const s = await lerSessao(c);
    const numero = s.me?.id?.split("@")[0] ?? null;
    const qr = s.status === "SCAN_QR_CODE" ? await lerQr(c).catch(() => null) : null;
    if (s.status !== c.status || numero !== c.numero) {
      const { supabase } = await cliente();
      await supabase.from("wa_conexoes").update({ status: s.status, numero }).eq("id", c.id);
    }
    return { ok: true, status: s.status, numero, qr };
  } catch (e) {
    const r = falha(e);
    return r.erro.includes("Sessão não encontrada") ? { ok: true, status: "STOPPED", numero: null, qr: null } : r;
  }
}

async function conexaoPorId(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("wa_conexoes").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function conectarWhatsApp(conexaoId?: string): Promise<ActionResult> {
  try {
    const c = conexaoId ? await conexaoPorId(conexaoId) : await minhaConexao();
    if (!c) return { ok: false, erro: "Conexão não encontrada." };
    await iniciarSessao(c);
    return { ok: true };
  } catch (e) { return falha(e); }
}

/** Vincular sem QR: o WhatsApp do celular pede o código de 8 caracteres (Conectar com número de telefone). */
export async function codigoPareamentoWhatsApp(conexaoId: string, telefone: string): Promise<{ ok: true; codigo: string } | { ok: false; erro: string }> {
  try {
    const empresa = await empresaAtual();
    if (!empresa || !ehGestor(empresa.papel)) return { ok: false, erro: "Só o dono ou um gestor pode conectar o WhatsApp." };
    const chat = chatDoTelefone(telefone);
    if (!chat) return { ok: false, erro: "Telefone inválido. Use DDD + número." };
    const c = await conexaoPorId(conexaoId);
    if (!c) return { ok: false, erro: "Conexão não encontrada." };
    const s = await lerSessao(c);
    if (s.status !== "SCAN_QR_CODE") return { ok: false, erro: "Clique em Conectar e espere o QR aparecer; aí peça o código." };
    const codigo = await codigoDePareamento(c, chat.split("@")[0]);
    if (!codigo) return { ok: false, erro: "O WAHA não devolveu o código. Tente o QR." };
    return { ok: true, codigo };
  } catch (e) { return falha(e); }
}

/**
 * Cria a conexão com defaults e já dispara a sessão — "1 clique → QR na tela"
 * (fluxo inspirado no DeskcommCRM: o formulário vem depois, pela edição).
 */
export async function novaConexaoRapida(): Promise<ActionResult & { id?: string }> {
  try {
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa || !ehGestor(empresa.papel)) return { ok: false, erro: "Só o dono ou um gestor pode conectar o WhatsApp." };
    if (!process.env.WAHA_BASE_URL && !process.env.WAHA_DOMAIN) {
      return { ok: false, erro: "WAHA não configurado no servidor: defina WAHA_BASE_URL (ou WAHA_DOMAIN) e WAHA_API_KEY no .env." };
    }
    const sessao = `t${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const { data: nova, error } = await supabase.from("wa_conexoes").insert({
      org_id: empresa.id,
      user_id: user.id,
      apelido: "WhatsApp",
      distribuicao: "manual",
      sessao,
      ia_ativa: true, // padrão: o Jarvis atende assim que o QR for lido
      base_url: null,
    }).select("id").single();
    if (error) throw error;
    // Disparo da sessão é best-effort: a linha já existe e o botão Conectar resolve se o WAHA falhar
    await conectarWhatsApp(nova.id);
    revalidatePath("/app/inbox");
    revalidatePath("/app/conexoes");
    return { ok: true, id: nova.id };
  } catch (e) { return falha(e); }
}

export async function desconectarWhatsApp(conexaoId?: string): Promise<ActionResult> {
  try {
    const c = conexaoId ? await conexaoPorId(conexaoId) : await minhaConexao();
    if (!c) return { ok: false, erro: "Conexão não encontrada." };
    await desconectar(c);
    const { supabase } = await cliente();
    await supabase.from("wa_conexoes").update({ status: "STOPPED", numero: null }).eq("id", c.id);
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirConexao(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const c = await conexaoPorId(id);
    if (!c) return { ok: false, erro: "Conexão não encontrada." };
    // Apaga a sessão no WAHA antes: viva, ela seguiria recebendo mensagens para um token morto.
    // Best-effort: WAHA fora do ar não pode impedir de excluir a linha.
    await apagarSessao(c).catch((e) => console.error("[waha:excluir]", e instanceof Error ? e.message : e));
    const { error } = await supabase.from("wa_conexoes").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/app/inbox");
    return { ok: true };
  } catch (e) { return falha(e); }
}

/* ---------------- Conversas ---------------- */

export async function enviarMensagem(conversaId: string, texto: string): Promise<ActionResult> {
  try {
    const t = texto.trim();
    if (!t) return { ok: false, erro: "Mensagem vazia." };
    if (t.length > 4000) return { ok: false, erro: "Mensagem longa demais (máx. 4000 caracteres)." };
    const { supabase, user } = await cliente();
    const { data: conversa } = await supabase.from("wa_conversas").select("id, chat_id, status, aguardando_desde, atribuido_a, conexao_id").eq("id", conversaId).single();
    if (!conversa) return { ok: false, erro: "Conversa não encontrada." };
    await enviarERegistrar(supabase, await minhaConexao(conversa.conexao_id), conversa, t, "humano", user.id);
    // Quem responde uma conversa sem dono passa a ser o responsável
    const mudanca = { ...(conversa.status === "resolvida" ? { status: "aberta" } : {}), ...(!conversa.atribuido_a ? { atribuido_a: user.id } : {}) };
    if (Object.keys(mudanca).length) await supabase.from("wa_conversas").update(mudanca).eq("id", conversaId);
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function marcarComoLida(conversaId: string): Promise<void> {
  try {
    const { supabase } = await cliente();
    const { data } = await supabase.from("wa_conversas").update({ nao_lidas: 0 }).eq("id", conversaId).select("chat_id, canal, conexao_id").single();
    if (data && (data.canal ?? "whatsapp") === "whatsapp") await marcarLida(await minhaConexao(data.conexao_id), data.chat_id);
  } catch { /* melhor esforço */ }
}

export async function atualizarConversa(conversaId: string, mudanca: { status?: "aberta" | "pendente" | "resolvida"; ia_ativa?: boolean }): Promise<ActionResult> {
  try {
    const { supabase } = await cliente();
    const campos: Record<string, unknown> = {};
    if (mudanca.status && ["aberta", "pendente", "resolvida"].includes(mudanca.status)) campos.status = mudanca.status;
    if (typeof mudanca.ia_ativa === "boolean") campos.ia_ativa = mudanca.ia_ativa;
    const { error } = await supabase.from("wa_conversas").update(campos).eq("id", conversaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function atribuirConversa(conversaId: string, userId: string | null): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    // Vendedor/atendente só pode puxar para si; gestor distribui ou transfere para qualquer um
    if (userId && userId !== user.id && !ehGestor(empresa?.papel)) return { ok: false, erro: "Só gestores podem atribuir conversas a outras pessoas." };
    const { data: antes } = await supabase.from("wa_conversas").select("atribuido_a, lead_id").eq("id", conversaId).maybeSingle();
    if (!antes) return { ok: false, erro: "Conversa não encontrada." };
    const { error } = await supabase.from("wa_conversas").update({ atribuido_a: userId }).eq("id", conversaId);
    if (error) throw error;
    // Auditoria: toda troca de responsável (atribuição ou transferência) vira atividade
    if (antes.atribuido_a !== userId) {
      let rotulo = "ninguém";
      if (userId) {
        const { data: perfil } = await supabase.from("profiles").select("nome_completo, email").eq("id", userId).single();
        rotulo = perfil?.nome_completo || perfil?.email?.split("@")[0] || "alguém";
      }
      const descricao = antes.atribuido_a ? `Conversa transferida para ${rotulo}.` : `Conversa atribuída a ${rotulo}.`;
      await supabase.from("activities").insert({ user_id: user.id, lead_id: antes.lead_id, tipo: "nota", descricao });
    }
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function criarLeadDaConversa(conversaId: string, empresa: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await cliente();
    const { data: c } = await supabase.from("wa_conversas").select("id, nome, telefone, chat_id, lead_id").eq("id", conversaId).single();
    if (!c) return { ok: false, erro: "Conversa não encontrada." };
    if (c.lead_id) return { ok: true };
    const { data: lead, error } = await supabase.from("leads").insert({
      user_id: user.id,
      nome: c.nome || c.telefone || "Contato WhatsApp",
      empresa: empresa.trim() || "Não informada",
      telefone: c.telefone,
      origem: "Outro",
      status: "Contatado",
      notas: "Criado a partir do inbox do WhatsApp.",
    }).select("id").single();
    if (error) throw error;
    await supabase.from("wa_conversas").update({ lead_id: lead.id }).eq("id", conversaId);
    await supabase.from("activities").insert({ user_id: user.id, lead_id: lead.id, tipo: "whatsapp", descricao: "Conversa iniciada no WhatsApp" });
    after(() => dispararWebhooks(supabase, null, "lead.criado", {
      id: lead.id, nome: c.nome || c.telefone || "Contato WhatsApp", telefone: c.telefone,
      origem: "Outro", status: "Contatado",
    }));
    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function novaConversa(telefone: string, texto: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  try {
    const chatId = chatDoTelefone(telefone);
    if (!chatId) return { ok: false, erro: "Telefone inválido. Use DDD + número." };
    const { supabase, user } = await cliente();
    const empresa = await empresaAtual();
    if (!empresa) return { ok: false, erro: "Empresa não encontrada." };
    const { data: conversa, error } = await supabase.from("wa_conversas")
      .upsert({ org_id: empresa.id, user_id: user.id, chat_id: chatId, telefone: chatId.split("@")[0], ia_ativa: false, atribuido_a: user.id }, { onConflict: "org_id,chat_id", ignoreDuplicates: false })
      .select("id, chat_id, aguardando_desde, conexao_id").single();
    if (error) throw error;
    if (texto.trim()) {
      const c = await minhaConexao(conversa.conexao_id);
      if (!conversa.conexao_id) await supabase.from("wa_conversas").update({ conexao_id: c.id }).eq("id", conversa.id);
      await enviarERegistrar(supabase, c, conversa, texto.trim(), "humano", user.id);
    }
    return { ok: true, id: conversa.id };
  } catch (e) { return falha(e); }
}
