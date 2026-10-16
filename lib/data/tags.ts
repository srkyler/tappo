import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeadTag, Proposta } from "@/lib/data/types";

export async function lerTags(): Promise<LeadTag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_tags").select("*").order("nome");
  return (data ?? []) as LeadTag[];
}

export async function lerPropostas(): Promise<Proposta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas")
    .select("*")
    .order("criado_em", { ascending: false });
  return (data ?? []) as Proposta[];
}

export async function lerProposta(id: string): Promise<Proposta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("propostas").select("*").eq("id", id).maybeSingle();
  return data ? (data as Proposta) : null;
}
