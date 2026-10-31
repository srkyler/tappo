import { Suspense } from "react";
import Link from "next/link";
import { Brain, CheckSquare, FileText, KanbanSquare, Mail, MessageCircle, Phone, Send, Sparkles, StickyNote, History } from "lucide-react";
import { Cabecalho, Pagina, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { lerTags } from "@/lib/data/tags";
import { lerHistoricoLead, lerScoreLead } from "@/lib/data/crm";
import { RecalcularScore } from "@/components/leads/recalcular-score";
import { TagsLead } from "@/components/leads/tags-lead";
import { formatBRL, formatData, tempoRelativo } from "@/lib/data/format";

/*
 * Ficha 360 do lead (plano 4.1): tudo sobre o cliente numa tela — dados, negócios,
 * propostas, conversas, tarefas, campanhas, o que a IA lembra e UMA linha do tempo
 * com tudo junto (mensagens, atividades, tarefas, negócios, propostas, alterações).
 */

type Evento = { id: string; quando: string; tipo: "mensagem" | "atividade" | "tarefa" | "negocio" | "proposta" | "alteracao"; titulo: string; detalhe?: string; href?: string };
const ICONE = { mensagem: MessageCircle, atividade: StickyNote, tarefa: CheckSquare, negocio: KanbanSquare, proposta: FileText, alteracao: History } as const;
const soDigitos = (t: string | null) => (t ?? "").replace(/\D/g, "");

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const { id } = await params;

  const [{ data: lead }, { data: atividades }, { data: deals }, { data: tarefas }, { data: conversas }, { data: propostas }, { data: campanhas }, historico, score, tagsDisponiveis, tagsLead] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("id, tipo, descricao, ocorreu_em").eq("lead_id", id).order("ocorreu_em", { ascending: false }).limit(50),
    supabase.from("deals").select("id, titulo, valor, created_at, fechado_em, pipeline_stages(nome, tipo)").eq("lead_id", id),
    supabase.from("tarefas").select("id, titulo, prioridade, vence_em, concluida_em, created_at").eq("lead_id", id).order("vence_em", { ascending: true, nullsFirst: false }),
    supabase.from("wa_conversas").select("id, nome, telefone, canal, status, ultima_mensagem, ultima_em, ia_ativa, resumo_ia").eq("lead_id", id).order("ultima_em", { ascending: false }),
    supabase.from("propostas").select("id, titulo, valor, status, criado_em").eq("lead_id", id).order("criado_em", { ascending: false }),
    supabase.from("campaign_leads").select("status, etapas_concluidas, campanha:campaigns(nome)").eq("lead_id", id),
    lerHistoricoLead(id),
    lerScoreLead(id),
    lerTags(),
    supabase.from("lead_tag_rel").select("tag_id").eq("lead_id", id),
  ]);
  if (!lead) return <div className="text-[14px] text-gray-500">Lead não encontrado.</div>;

  const idsConversas = (conversas ?? []).map((c) => c.id);
  const fone = soDigitos(lead.telefone);
  const [{ data: mensagens }, { data: memorias }] = await Promise.all([
    idsConversas.length
      ? supabase.from("wa_mensagens").select("id, conversa_id, direcao, autor, corpo, tipo, created_at").in("conversa_id", idsConversas).order("created_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] as { id: string; conversa_id: string; direcao: string; autor: string; corpo: string | null; tipo: string | null; created_at: string }[] }),
    // O que a IA lembra: por lead ou pelo telefone do contato
    supabase.from("ia_memoria").select("id, fato, created_at").eq("escopo", "contato")
      .or(fone.length >= 8 ? `lead_id.eq.${id},contato.eq.${fone}` : `lead_id.eq.${id}`).order("created_at", { ascending: false }).limit(20),
  ]);

  type DealView = { id: string; titulo: string; valor: number; created_at: string; fechado_em: string | null; pipeline_stages: { nome: string; tipo: string } | null };
  const negocios = (deals ?? []) as unknown as DealView[];
  const ganho = negocios.filter((d) => d.pipeline_stages?.tipo === "ganho").reduce((s, d) => s + Number(d.valor), 0);
  const aberto = negocios.filter((d) => d.pipeline_stages?.tipo === "aberto").reduce((s, d) => s + Number(d.valor), 0);
  const pendentes = (tarefas ?? []).filter((t) => !t.concluida_em);

  const AUTOR: Record<string, string> = { contato: "Cliente", humano: "Equipe", ia: "IA", celular: "Celular" };
  const linha: Evento[] = [
    ...(mensagens ?? []).map((m) => ({
      id: `m${m.id}`, quando: m.created_at, tipo: "mensagem" as const,
      titulo: `${AUTOR[m.autor] ?? m.autor}: ${(m.corpo || (m.tipo ? `[${m.tipo}]` : "")).slice(0, 160)}`, href: `/app/inbox?c=${m.conversa_id}`,
    })),
    ...(atividades ?? []).map((a) => ({ id: `a${a.id}`, quando: a.ocorreu_em, tipo: "atividade" as const, titulo: a.descricao, detalhe: a.tipo })),
    ...(tarefas ?? []).map((t) => ({
      id: `t${t.id}`, quando: t.concluida_em ?? t.created_at, tipo: "tarefa" as const,
      titulo: `${t.concluida_em ? "Concluiu" : "Criou"} tarefa: ${t.titulo}`, detalhe: t.vence_em ? `vence ${formatData(t.vence_em)}` : undefined, href: "/app/tarefas",
    })),
    ...negocios.flatMap((d) => [
      { id: `d${d.id}`, quando: d.created_at, tipo: "negocio" as const, titulo: `Negócio aberto: ${d.titulo} (${formatBRL(Number(d.valor))})`, href: "/app/pipeline" },
      ...(d.fechado_em ? [{ id: `df${d.id}`, quando: d.fechado_em, tipo: "negocio" as const, titulo: `Negócio ${d.pipeline_stages?.tipo === "ganho" ? "ganho" : "fechado"}: ${d.titulo}`, href: "/app/pipeline" }] : []),
    ]),
    ...(propostas ?? []).map((p) => ({ id: `p${p.id}`, quando: p.criado_em, tipo: "proposta" as const, titulo: `Proposta: ${p.titulo} (${formatBRL(Number(p.valor))})`, detalhe: p.status, href: "/app/propostas" })),
    ...historico.map((h) => ({ id: `h${h.id}`, quando: h.alterado_em, tipo: "alteracao" as const, titulo: `${h.campo}: ${h.valor_antigo ?? "—"} → ${h.valor_novo ?? "—"}`, detalhe: h.usuario?.nome_completo || h.usuario?.email || undefined })),
  ].filter((e) => e.quando).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 80);

  const conversaPrincipal = conversas?.[0];
  const ativas = (tagsLead.data ?? []).map((t) => t.tag_id);

  return (
    <div className="space-y-6">
      <Cabecalho
        rotulo="Contato"
        titulo={lead.nome}
        descricao={<>{lead.cargo ? `${lead.cargo} · ` : ""}{lead.empresa} · {lead.cod}</>}
        acoes={
          <div className="flex flex-wrap gap-2">
            {conversaPrincipal && <Link href={`/app/inbox?c=${conversaPrincipal.id}`} className="btn btn-secundario btn-sm"><MessageCircle size={14} /> Conversa</Link>}
            {fone && <a href={`https://wa.me/${fone}`} target="_blank" rel="noopener noreferrer" className="btn btn-secundario btn-sm"><Send size={14} /> WhatsApp</a>}
            <Link href={`/app/agente?q=${encodeURIComponent(`Analise o lead ${lead.nome} (${lead.empresa}) e me diga o próximo passo.`)}`} className="btn btn-primario btn-sm"><Sparkles size={14} /> Perguntar ao agente</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="painel p-5"><p className="rotulo mb-2">Status</p><Status valor={lead.status} /><p className="mt-2 text-[12px] text-gray-500">Origem: {lead.origem}</p></div>
        <div className="painel p-5">
          <p className="rotulo mb-2">Próximo contato</p>
          <p className={`text-[15px] font-medium ${lead.proximo_contato_em && new Date(lead.proximo_contato_em) < new Date() ? "text-red-400" : "text-white"}`}>{lead.proximo_contato_em ? formatData(lead.proximo_contato_em) : "—"}</p>
          <p className="mt-2 text-[12px] text-gray-500">{pendentes.length} tarefa{pendentes.length === 1 ? "" : "s"} aberta{pendentes.length === 1 ? "" : "s"}</p>
        </div>
        <div className="painel p-5"><p className="rotulo mb-2">Em negociação</p><p className="text-[15px] font-medium text-white tabular">{formatBRL(aberto)}</p><p className="mt-2 text-[12px] text-gray-500">Ganho: {formatBRL(ganho)}</p></div>
        <div className="painel p-5">
          <p className="rotulo mb-2">Contato</p>
          {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 truncate text-[13px] text-gray-200 hover:text-white"><Mail size={12} /> {lead.email}</a>}
          {lead.telefone && <a href={`tel:${fone}`} className="mt-1 flex items-center gap-1.5 text-[13px] text-gray-200 hover:text-white"><Phone size={12} /> {lead.telefone}</a>}
          {!lead.email && !lead.telefone && <p className="text-[13px] text-gray-500">—</p>}
        </div>
        <RecalcularScore leadId={id} scoreInicial={score?.score ?? null} classificacaoInicial={score?.classificacao ?? null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="painel">
          <h2 className="border-b border-gray-800 px-5 py-3 text-[13px] font-medium text-white">Linha do tempo</h2>
          {linha.length ? (
            <ul className="px-5 py-3">
              {linha.map((e) => {
                const Icone = ICONE[e.tipo];
                const corpo = (
                  <>
                    <p className="text-[13px] leading-snug text-gray-200">{e.titulo}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{e.detalhe ? `${e.detalhe} · ` : ""}{tempoRelativo(e.quando)}</p>
                  </>
                );
                return (
                  <li key={e.id} className="relative flex gap-3 border-l border-gray-800 py-2 pl-5">
                    <span className="absolute -left-[9px] top-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gray-800 bg-black text-gray-500"><Icone size={10} /></span>
                    <div className="min-w-0">{e.href ? <Link href={e.href} className="block hover:opacity-80">{corpo}</Link> : corpo}</div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-5 py-8 text-center text-[13px] text-gray-500">Tudo o que acontecer com este contato aparece aqui.</p>}
        </section>

        <div className="space-y-4">
          <section className="painel p-5">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-white"><Brain size={14} /> O que a IA sabe</h3>
            {conversaPrincipal?.resumo_ia && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-900/50 p-3 text-[12.5px] text-gray-300">{conversaPrincipal.resumo_ia}</p>}
            {memorias?.length ? (
              <ul className="mt-2 space-y-1 text-[12.5px] text-gray-300">{memorias.map((m) => <li key={m.id}>• {m.fato}</li>)}</ul>
            ) : !conversaPrincipal?.resumo_ia && <p className="mt-2 text-[12.5px] text-gray-500">A IA ainda não guardou nada sobre este cliente.</p>}
          </section>

          <section className="painel p-5">
            <h3 className="text-[13px] font-medium text-white">Negócios ({negocios.length})</h3>
            <ul className="mt-2 space-y-2">
              {negocios.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="min-w-0 truncate text-gray-200">{d.titulo} <span className="text-gray-500">· {d.pipeline_stages?.nome ?? "—"}</span></span>
                  <span className="shrink-0 tabular text-gray-300">{formatBRL(Number(d.valor))}</span>
                </li>
              ))}
              {!negocios.length && <li className="text-[12.5px] text-gray-500">Nenhum. <Link href="/app/pipeline" className="underline">Abrir no pipeline</Link></li>}
            </ul>
          </section>

          {!!propostas?.length && (
            <section className="painel p-5">
              <h3 className="text-[13px] font-medium text-white">Propostas</h3>
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {propostas.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate text-gray-200">{p.titulo}</span><span className="shrink-0 text-gray-500">{p.status}</span></li>)}
              </ul>
            </section>
          )}

          <section className="painel p-5">
            <h3 className="text-[13px] font-medium text-white">Conversas ({conversas?.length ?? 0})</h3>
            <ul className="mt-2 space-y-2">
              {(conversas ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/app/inbox?c=${c.id}`} className="block rounded-lg p-2 -mx-2 hover:bg-gray-900/60">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]"><span className="text-gray-200">{c.canal}{c.ia_ativa ? " · IA" : ""}</span><Status valor={c.status} /></div>
                    <p className="truncate text-[12px] text-gray-500">{c.ultima_mensagem ?? "—"} · {tempoRelativo(c.ultima_em)}</p>
                  </Link>
                </li>
              ))}
              {!conversas?.length && <li className="text-[12.5px] text-gray-500">Sem conversas ainda.</li>}
            </ul>
          </section>

          {!!campanhas?.length && (
            <section className="painel p-5">
              <h3 className="text-[13px] font-medium text-white">Campanhas</h3>
              <ul className="mt-2 space-y-1 text-[12.5px] text-gray-300">
                {(campanhas as unknown as { status: string; etapas_concluidas: number; campanha: { nome: string } | null }[]).map((c, i) => (
                  <li key={i}>• {c.campanha?.nome ?? "—"} <span className="text-gray-500">· {c.status} · {c.etapas_concluidas} etapa(s)</span></li>
                ))}
              </ul>
            </section>
          )}

          <section className="painel p-5">
            <h3 className="mb-3 text-[13px] font-medium text-white">Tags</h3>
            <TagsLead leadId={id} tags={tagsDisponiveis.map((t) => ({ id: t.id, nome: t.nome, cor: t.cor }))} ativas={ativas} />
          </section>

          <section className="painel p-5">
            <h3 className="text-[13px] font-medium text-white">Notas</h3>
            <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-gray-400">{lead.notas || "Sem notas ainda."}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo params={params} />
      </Suspense>
    </Pagina>
  );
}
