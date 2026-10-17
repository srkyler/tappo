"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/data/types";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function receberLead(f: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const nome = String(f.get("nome") ?? "").trim();
    const empresa = String(f.get("empresa") ?? "").trim();
    const email = String(f.get("email") ?? "").trim() || null;
    const telefone = String(f.get("telefone") ?? "").trim() || null;
    const mensagem = String(f.get("mensagem") ?? "").trim() || null;
    const fonte_id = String(f.get("fonte_id") ?? "");

    if (!nome || !empresa) return { ok: false, erro: "Nome e empresa são obrigatórios." };

    // Detectar duplicados antes de inserir
    const duplicados: string[] = [];
    if (telefone) {
      const { data: tel } = await supabase.from("leads").select("id, nome").eq("telefone", telefone);
      if (tel?.length) duplicados.push(`Telefone já cadastrado: ${tel[0].nome}`);
    }
    if (email) {
      const { data: em } = await supabase.from("leads").select("id, nome").eq("email", email);
      if (em?.length) duplicados.push(`E-mail já cadastrado: ${em[0].nome}`);
    }

    const { error } = await supabase.from("leads").insert({
      nome,
      empresa,
      email,
      telefone,
      origem: "Site",
      status: "Nova",
      notas: mensagem ? `Mensagem de captação: ${mensagem}` : null,
    });

    if (error) return falha(error);

    // Registrar duplicados se houver
    if (duplicados.length > 0) {
      const { data: perfil } = await supabase.from("profiles").select("org_atual").eq("id", user.id).single();
      // Nota: lead_duplicados precisa do lead_id do novo lead, que não temos aqui facilmente.
      // Pode ser feito via trigger ou consulta separada.
    }

    revalidatePath("/app/leads");
    return { ok: true };
  } catch (e) { return falha(e); }
}

export async function webhookCaptacao(token: string, body: any): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { data: fonte } = await supabase
      .from("lead_sources")
      .select("id, org_id, status_inicial")
      .eq("token", token)
      .eq("ativo", true)
      .maybeSingle();
    if (!fonte) return { ok: false, erro: "Fonte não encontrada ou inativa." };

    const nome = body.nome || body.name || "";
    const empresa = body.empresa || body.company || "Não informada";
    const email = body.email || null;
    const telefone = body.telefone || body.phone || null;

    if (!nome) return { ok: false, erro: "Nome é obrigatório." };

    const { error } = await supabase.from("leads").insert({
      org_id: fonte.org_id,
      nome,
      empresa,
      email,
      telefone,
      origem: "Site",
      status: fonte.status_inicial,
      notas: body.mensagem || body.message || null,
    });
    if (error) throw error;

    // Atualizar contador de recebidos na fonte
    await supabase.from("lead_sources")
      .update({ recebidos: supabase.sql`recebidos + 1`, ultimo_em: new Date().toISOString() })
      .eq("id", fonte.id);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return { ok: false, erro: msg };
  }
}
