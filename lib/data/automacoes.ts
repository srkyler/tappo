import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Automacao } from "@/lib/data/types";

export async function lerAutomacoes(): Promise<Automacao[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("automacoes").select("*").order("criado_em", { ascending: false });
  return (data ?? []) as Automacao[];
}
