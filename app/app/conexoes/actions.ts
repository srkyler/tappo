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
