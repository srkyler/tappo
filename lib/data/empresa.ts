import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { segmentoPorId, type Papel, type Termos } from "@/lib/segmentos";

/* Empresa (organização) atual do usuário logado. */

export type Empresa = {
  id: string;
  nome: string;
  segmento: string;
  plano: string;
  teste_ate: string;
  papel: Papel;
  termos: Termos;
};

export type Membro = { user_id: string; nome: string; email: string | null; avatar_url: string | null; papel: Papel; ativo: boolean };

export const empresaAtual = cache(async (): Promise<Empresa | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("org_atual").eq("id", user.id).maybeSingle();
  if (!perfil?.org_atual) return null;
  const [{ data: org }, { data: m }] = await Promise.all([
    supabase.from("organizacoes").select("id, nome, segmento, plano, teste_ate").eq("id", perfil.org_atual).maybeSingle(),
    supabase.from("org_membros").select("papel").eq("org_id", perfil.org_atual).eq("user_id", user.id).eq("ativo", true).maybeSingle(),
  ]);
  if (!org || !m) return null;
  return { ...org, papel: m.papel as Papel, termos: segmentoPorId(org.segmento).termos };
});

export const minhasEmpresas = cache(async (): Promise<{ id: string; nome: string }[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("organizacoes").select("id, nome").order("nome");
  return data ?? [];
});

export const membrosDaEmpresa = cache(async (): Promise<Membro[]> => {
  const empresa = await empresaAtual();
  if (!empresa) return [];
  const supabase = await createClient();
  const { data: ms } = await supabase.from("org_membros").select("user_id, papel, ativo").eq("org_id", empresa.id);
  const ids = (ms ?? []).map((m) => m.user_id);
  const { data: perfis } = ids.length
    ? await supabase.from("profiles").select("id, nome_completo, email, avatar_url").in("id", ids)
    : { data: [] };
  return (ms ?? []).map((m) => {
    const p = perfis?.find((x) => x.id === m.user_id);
    return { user_id: m.user_id, papel: m.papel as Papel, ativo: m.ativo, nome: p?.nome_completo || p?.email?.split("@")[0] || "Membro", email: p?.email ?? null, avatar_url: p?.avatar_url ?? null };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
});
