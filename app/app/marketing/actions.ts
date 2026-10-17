"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/types";

function falha(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

const STATUS_VALIDOS = ["planejada", "ativa", "concluida", "cancelada"] as const;
const CANAIS_VALIDOS = ["whatsapp", "email", "instagram", "site", "outro"] as const;

export async function salvarPromocao(id: string | null, fd: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const titulo = String(fd.get("titulo") ?? "").trim();
    const data_inicio = String(fd.get("data_inicio") ?? "");
    if (!titulo) return { ok: false, erro: "Título é obrigatório." };
    if (!data_inicio) return { ok: false, erro: "Data de início é obrigatória." };

    const data_fim = String(fd.get("data_fim") ?? "") || null;
    if (data_fim && data_fim < data_inicio) return { ok: false, erro: "Data de fim não pode ser antes da data de início." };

    const canalForm = String(fd.get("canal") ?? "whatsapp");
    const statusForm = String(fd.get("status") ?? "planejada");
    const payload = {
      titulo,
      descricao: String(fd.get("descricao") ?? "").trim() || null,
      oferta: String(fd.get("oferta") ?? "").trim() || null,
      canal: (CANAIS_VALIDOS as readonly string[]).includes(canalForm) ? canalForm : "whatsapp",
      data_inicio,
      data_fim,
      status: (STATUS_VALIDOS as readonly string[]).includes(statusForm) ? statusForm : "planejada",
    };

    const { error } = id
      ? await supabase.from("promocoes").update({ ...payload, atualizado_em: new Date().toISOString() }).eq("id", id)
      : await supabase.from("promocoes").insert(payload);
    if (error) return falha(error);

    revalidatePath("/app/marketing");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function excluirPromocao(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("promocoes").delete().eq("id", id);
    if (error) return falha(error);
    revalidatePath("/app/marketing");
    return { ok: true };
  } catch (e) { return falha(e); }
}
