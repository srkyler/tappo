"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buscarEmpresas, type EmpresaEncontrada } from "@/lib/prospeccao/google-maps";
import type { ActionResult } from "@/lib/data/types";

function falha(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function buscarEmpresasAction(consulta: string, regiao: string): Promise<{ ok: true; empresas: EmpresaEncontrada[] } | { ok: false; erro: string }> {
  const c = consulta.trim();
  if (!c) return { ok: false, erro: "Descreva o que procurar (ex.: dentista, imobiliária)." };
  return buscarEmpresas(c, regiao.trim() || undefined);
}

/** Importa empresas encontradas como leads. Pula quem já existe (telefone ou site igual). */
export async function importarEmpresasComoLeads(empresas: EmpresaEncontrada[]): Promise<ActionResult & { importados?: number; pulados?: number }> {
  try {
    const supabase = await createClient();
    let importados = 0;
    let pulados = 0;

    for (const e of empresas) {
      const telefone = e.telefone?.replace(/\D/g, "") || null;
      if (telefone) {
        const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("telefone", telefone);
        if ((count ?? 0) > 0) { pulados++; continue; }
      }

      const { error } = await supabase.from("leads").insert({
        nome: e.nome,
        empresa: e.nome,
        telefone,
        origem: "Prospecção",
        status: "Nova",
        notas: [
          e.endereco ? `Endereço: ${e.endereco}` : null,
          e.site ? `Site: ${e.site}` : null,
          e.avaliacao ? `Avaliação Google: ${e.avaliacao} (${e.totalAvaliacoes ?? 0} avaliações)` : null,
          "Importado via busca no Google Maps.",
        ].filter(Boolean).join("\n"),
      });
      if (error) { pulados++; continue; }
      importados++;
    }

    revalidatePath("/app/leads");
    revalidatePath("/app/prospeccao");
    return { ok: true, importados, pulados };
  } catch (e) { return falha(e); }
}
