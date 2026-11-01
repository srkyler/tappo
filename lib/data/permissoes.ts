import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { empresaAtual } from "@/lib/data/empresa";

/** Telas escondidas para o papel do usuário logado (o dono vê tudo). */
export const telasOcultas = cache(async (): Promise<string[]> => {
  const empresa = await empresaAtual();
  if (!empresa || empresa.papel === "dono") return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("permissao_tela").select("modulo").eq("org_id", empresa.id).eq("papel", empresa.papel).eq("pode_ver", false);
  if (error) return [];
  return (data ?? []).map((r) => r.modulo as string);
});

/** Matriz completa da empresa (tela de configuração). */
export async function permissoesDaEmpresa(orgId: string): Promise<{ papel: string; modulo: string; pode_ver: boolean }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("permissao_tela").select("papel, modulo, pode_ver").eq("org_id", orgId);
  return data ?? [];
}
