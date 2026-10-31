"use server";

import { createClient } from "@/lib/supabase/server";
import type { Pendencia } from "@/lib/notificacoes-tipos";

/*
 * O que precisa de mim agora (sino do topo + /app/notificacoes). Calculado na hora
 * a partir do estado real — não há fila de notificação para ficar dessincronizada:
 *  - conversas minhas com mensagem não lida;
 *  - conversas que a IA passou para humano e ninguém pegou;
 *  - minhas tarefas vencidas ou para hoje.
 */
export async function minhasPendencias(): Promise<Pendencia[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const fimDoDia = new Date(Math.ceil((Date.now() - 3 * 3_600_000) / 86_400_000) * 86_400_000 + 3 * 3_600_000).toISOString(); // meia-noite de Brasília
  const agora = Date.now();

  const [minhas, transferidas, tarefas] = await Promise.all([
    supabase.from("wa_conversas").select("id, nome, telefone, canal, nao_lidas, ultima_em, ultima_mensagem")
      .eq("atribuido_a", user.id).neq("status", "resolvida").gt("nao_lidas", 0).order("ultima_em", { ascending: false }).limit(15),
    supabase.from("wa_conversas").select("id, nome, telefone, canal, ultima_em, aguardando_desde")
      .is("atribuido_a", null).eq("ia_ativa", false).neq("status", "resolvida").not("aguardando_desde", "is", null)
      .order("aguardando_desde").limit(10),
    supabase.from("tarefas").select("id, titulo, vence_em")
      .eq("responsavel_id", user.id).is("concluida_em", null).lt("vence_em", fimDoDia).order("vence_em").limit(15),
  ]);

  const nome = (c: { nome: string | null; telefone: string | null }) => c.nome || (c.telefone ? `+${c.telefone}` : "Contato");
  const itens: Pendencia[] = [
    ...(minhas.data ?? []).map((c) => ({
      id: `m-${c.id}`, tipo: "mensagem" as const, titulo: `${nome(c)} (${c.nao_lidas})`,
      detalhe: (c.ultima_mensagem ?? "Nova mensagem").slice(0, 90), href: `/app/inbox?c=${c.id}`, em: c.ultima_em, urgente: false,
    })),
    ...(transferidas.data ?? []).map((c) => ({
      id: `t-${c.id}`, tipo: "transferida" as const, titulo: `${nome(c)} aguarda um atendente`,
      detalhe: "A IA passou a conversa para a equipe e ninguém assumiu.", href: `/app/inbox?c=${c.id}`, em: c.aguardando_desde!,
      urgente: agora - Date.parse(c.aguardando_desde!) > 15 * 60_000,
    })),
    ...(tarefas.data ?? []).map((t) => {
      const vencida = Date.parse(t.vence_em!) < agora;
      return {
        id: `k-${t.id}`, tipo: "tarefa" as const, titulo: t.titulo, detalhe: vencida ? "Tarefa vencida" : "Vence hoje",
        href: "/app/tarefas", em: t.vence_em!, urgente: vencida,
      };
    }),
  ];
  return itens.sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.em.localeCompare(a.em));
}
