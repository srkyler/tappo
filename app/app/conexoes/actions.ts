"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "@/lib/ai/cofre";
import type { ActionResult } from "@/lib/data/types";
import { empresaAtual } from "@/lib/data/empresa";
import { ehGestor } from "@/lib/segmentos";

/* Conexões da empresa — Meta Ads e futuras plataformas.
   Credenciais (access token) ficam cifradas no servidor (AI_KEYS_SECRET); nunca voltam para a UI. */

async function gestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const empresa = await empresaAtual();
  if (!empresa || !ehGestor(empresa.papel)) throw new Error("Só o dono ou um gestor pode gerenciar conexões.");
  return { supabase, empresa };
}

export async function salvarMetaAds(f: FormData): Promise<ActionResult> {
  try {
    const { supabase, empresa } = await gestor();
    const conta = String(f.get("conta") ?? "").trim();
    const token = String(f.get("token") ?? "").trim();
    if (!conta || !/^act_\d+$/.test(conta)) return { ok: false, erro: "Informe a conta de anúncios no formato act_123456789." };
    if (!token || token.length < 20) return { ok: false, erro: "Cole o access token do Meta (longo demais para ser esse). Gerenciador de Anúncios → Configurações → Contas de anúncios." };

    const registro = {
      org_id: empresa.id,
      tipo: "meta_ads",
      ativo: true,
      configuracao: { conta, chave_cifrada: cifrar(token) },
      ultimo_sync: new Date().toISOString(),
    };
    const { data: existe } = await supabase.from("integracao").select("id").eq("tipo", "meta_ads").maybeSingle();
    const { error } = existe
      ? await supabase.from("integracao").update(registro).eq("id", existe.id)
      : await supabase.from("integracao").insert(registro);
    if (error) throw error;
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar Meta Ads.";
    return { ok: false, erro: msg.includes("Só o dono") ? msg : "Não foi possível salvar. Tente novamente." };
  }
}

export async function removerMetaAds(): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { error } = await supabase.from("integracao").delete().eq("tipo", "meta_ads");
    if (error) throw error;
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao remover." };
  }
}

export async function alternarMetaAds(ativo: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await gestor();
    const { error } = await supabase.from("integracao").update({ ativo }).eq("tipo", "meta_ads");
    if (error) throw error;
    revalidatePath("/app/conexoes");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao atualizar." };
  }
}

/* ---------------- WhatsApp oficial (Cloud API da Meta) ---------------- */

/**
 * Cria ou edita uma conexão do WhatsApp oficial. Token e app secret ficam
 * cifrados; em edição, campo vazio mantém o que já estava salvo. Valida o
 * número na Graph API antes de marcar como conectado.
 */
export async function salvarConexaoCloud(f: FormData): Promise<ActionResult & { id?: string }> {
  try {
    const { supabase, empresa } = await gestor();
    const { data: { user } } = await supabase.auth.getUser();
    const id = String(f.get("id") ?? "").trim();
    const apelido = String(f.get("apelido") ?? "").trim().slice(0, 80) || "WhatsApp oficial";
    const numeroId = String(f.get("phone_number_id") ?? "").trim();
    const wabaId = String(f.get("waba_id") ?? "").trim();
    const token = String(f.get("token") ?? "").trim();
    const segredo = String(f.get("app_secret") ?? "").trim();
    if (!/^\d{5,25}$/.test(numeroId)) return { ok: false, erro: "ID do número de telefone: só dígitos (WhatsApp Manager › API Setup › Phone number ID)." };
    if (wabaId && !/^\d{5,25}$/.test(wabaId)) return { ok: false, erro: "ID da conta do WhatsApp Business: só dígitos." };
    if (!id && token.length < 30) return { ok: false, erro: "Cole o token de acesso permanente (usuário do sistema no Business Manager)." };
    if (!id && segredo.length < 16) return { ok: false, erro: "Cole o App Secret (Meta for Developers › Configurações do app › Básico)." };
    if (token && token.length < 30) return { ok: false, erro: "Token curto demais." };

    const campos: Record<string, unknown> = {
      apelido, provedor: "cloud", cloud_phone_number_id: numeroId, cloud_waba_id: wabaId || null,
      ia_ativa: f.get("ia_ativa") === "on",
      distribuicao: f.get("distribuicao") === "on" ? "rodizio" : "manual",
      ...(token ? { cloud_token_cifrado: cifrar(token) } : {}),
      ...(segredo ? { cloud_app_secret_cifrado: cifrar(segredo) } : {}),
    };

    let linhaId = id;
    if (id) {
      const { error } = await supabase.from("wa_conexoes").update(campos).eq("id", id).eq("provedor", "cloud");
      if (error) throw error;
    } else {
      const { randomBytes } = await import("node:crypto");
      const { data, error } = await supabase.from("wa_conexoes").insert({
        ...campos, org_id: empresa.id, user_id: user!.id, sessao: `cloud-${numeroId}`.slice(0, 64),
        cloud_verify_token: randomBytes(24).toString("base64url"),
      }).select("id").single();
      if (error) {
        if (error.code === "23505") return { ok: false, erro: "Este número oficial já está ligado a uma conexão." };
        throw error;
      }
      linhaId = data.id;
    }

    // Valida na Meta e grava o status/número
    const { data: c } = await supabase.from("wa_conexoes").select("*").eq("id", linhaId).single();
    const { lerSessaoCloud } = await import("@/lib/whatsapp/cloud");
    const s = await lerSessaoCloud(c);
    await supabase.from("wa_conexoes").update({
      status: s.status, status_em: new Date().toISOString(), ...(s.me?.id ? { numero: s.me.id.split("@")[0] } : {}),
    }).eq("id", linhaId);
    revalidatePath("/app/conexoes");
    revalidatePath("/app/inbox");
    if (s.status !== "WORKING") return { ok: false, id: linhaId, erro: `Salvo, mas a Meta recusou: ${String(s.config?.erro ?? "verifique o ID do número e o token")}` };
    return { ok: true, id: linhaId };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro inesperado." };
  }
}
