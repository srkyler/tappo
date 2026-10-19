"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/data/types";
import jsPDF from "jspdf";

function falha(e: unknown): { ok: false; erro: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Erro inesperado.";
  return { ok: false, erro: msg };
}

export async function gerarPdfProposta(id: string): Promise<ActionResult & { pdf_url?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");

    const { data: proposta, error: e1 } = await supabase
      .from("propostas")
      .select("*, leads(nome, empresa, telefone, email)")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    if (!proposta) return { ok: false, erro: "Proposta não encontrada." };

    const { data: perfil } = await supabase.from("profiles").select("nome_completo, email").eq("id", user.id).maybeSingle();

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("PROPOSTA COMERCIAL", 20, 20);
    doc.setFontSize(12);
    doc.text(`Título: ${proposta.titulo}`, 20, 40);
    doc.text(`Valor: R$ ${Number(proposta.valor).toFixed(2)}`, 20, 50);
    doc.text(`Status: ${proposta.status}`, 20, 60);
    doc.text(`Lead: ${proposta.leads?.nome || "—"}`, 20, 70);
    doc.text(`Empresa: ${proposta.leads?.empresa || "—"}`, 20, 80);
    doc.text(`Telefone: ${proposta.leads?.telefone || "—"}`, 20, 90);
    doc.text(`E-mail: ${proposta.leads?.email || "—"}`, 20, 100);
    doc.text(`Gerado por: ${perfil?.nome_completo || user.email || "—"}`, 20, 110);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 20, 120);
    doc.text("", 20, 130);
    doc.setFontSize(10);
    doc.text("Este documento foi gerado pelo Tappo CRM.", 20, 140);

    const pdfBase64 = doc.output("datauristring");
    const pdfBytes = pdfBase64.split(",")[1];
    const pdfBuffer = Buffer.from(pdfBytes, "base64");

    const admin = createAdminClient();
    const fileName = `propostas/${id}-${Date.now()}.pdf`;
    const { error: e2 } = await admin.storage.from("propostas").upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (e2) throw e2;

    const { data: urlData } = await admin.storage.from("propostas").getPublicUrl(fileName);

    const { error: e3 } = await supabase.from("propostas").update({
      pdf_url: urlData.publicUrl,
      atualizado_em: new Date().toISOString(),
    }).eq("id", id);
    if (e3) throw e3;

    revalidatePath("/app/propostas");
    return { ok: true, pdf_url: urlData.publicUrl };
  } catch (e) { return falha(e); }
}

export async function assinarProposta(id: string, assinatura: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("propostas").update({
      status: "aceito",
      atualizado_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
    revalidatePath("/app/propostas");
    return { ok: true };
  } catch (e) { return falha(e); }
}
