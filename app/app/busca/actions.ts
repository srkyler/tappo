"use server";

import { createClient } from "@/lib/supabase/server";

/*
 * Busca global da paleta (Ctrl+K): leads, conversas, negócios e contas da empresa
 * atual (RLS). O termo é escapado para o filtro .or() do PostgREST — vírgula,
 * parênteses e curingas viram texto, não sintaxe.
 */

export type ResultadoBusca = { id: string; tipo: "lead" | "conversa" | "negocio" | "conta"; titulo: string; detalhe: string; href: string };

export async function buscarGlobal(bruto: string): Promise<ResultadoBusca[]> {
  const termo = bruto.trim().slice(0, 60);
  if (termo.length < 2) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Curingas e sintaxe do filtro viram espaço (busca por texto simples)
  const seguro = termo.replace(/[%_\\,()"*.:]/g, " ").replace(/\s+/g, " ").trim();
  if (seguro.length < 2) return [];
  const like = `%${seguro}%`;
  const digitos = termo.replace(/\D/g, "");
  const ou = (campos: string[]) => campos.map((c) => `${c}.ilike.${like}`).join(",")
    + (digitos.length >= 4 ? `,telefone.ilike.%${digitos}%` : "");

  const [leads, conversas, negocios, contas] = await Promise.all([
    supabase.from("leads").select("id, nome, empresa, status").or(ou(["nome", "empresa", "email"])).limit(6),
    supabase.from("wa_conversas").select("id, nome, telefone, canal").or(ou(["nome"])).order("ultima_em", { ascending: false }).limit(5),
    supabase.from("deals").select("id, titulo, empresa, valor").or(["titulo", "empresa"].map((c) => `${c}.ilike.${like}`).join(",")).limit(5),
    supabase.from("contas").select("id, nome, cidade").or(ou(["nome", "cnpj_cpf"])).limit(4),
  ]);
  const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  return [
    ...(leads.data ?? []).map((l) => ({ id: `l-${l.id}`, tipo: "lead" as const, titulo: l.nome, detalhe: `${l.empresa} · ${l.status}`, href: `/app/leads/${l.id}` })),
    ...(conversas.data ?? []).map((c) => ({ id: `c-${c.id}`, tipo: "conversa" as const, titulo: c.nome || (c.telefone ? `+${c.telefone}` : "Contato"), detalhe: `Conversa · ${c.canal}`, href: `/app/inbox?c=${c.id}` })),
    ...(negocios.data ?? []).map((d) => ({ id: `d-${d.id}`, tipo: "negocio" as const, titulo: d.titulo, detalhe: `${d.empresa} · ${brl(Number(d.valor))}`, href: "/app/pipeline" })),
    ...(contas.data ?? []).map((c) => ({ id: `a-${c.id}`, tipo: "conta" as const, titulo: c.nome, detalhe: `Conta${c.cidade ? ` · ${c.cidade}` : ""}`, href: "/app/contas" })),
  ];
}
