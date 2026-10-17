import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";
import { lerTags } from "@/lib/data/tags";
import { lerHistoricoLead, lerScoreLead } from "@/lib/data/crm";
import { toggleTagLead } from "@/app/app/tags/actions";
import { RecalcularScore } from "@/components/leads/recalcular-score";
import { formatBRL, formatData, tempoRelativo } from "@/lib/data/format";

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const { id } = await params;

  const [{ data: lead }, { data: atividades }, { data: deals }, { data: tarefas }, { data: conversas }, historico, score] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase.from("activities").select("*").eq("lead_id", id).order("ocorreu_em", { ascending: false }).limit(50),
    supabase.from("deals").select("*, pipeline_stages(nome, tipo)").eq("lead_id", id),
    supabase.from("tarefas").select("*").eq("lead_id", id).order("vence_em", { ascending: true, nullsFirst: false }),
    supabase.from("wa_conversas").select("*").eq("lead_id", id).order("ultima_em", { ascending: false }),
    lerHistoricoLead(id),
    lerScoreLead(id),
  ]);

  const [tagsDisponiveis, tagsLead] = await Promise.all([
    lerTags(),
    supabase.from("lead_tag_rel").select("tag_id").eq("lead_id", id),
  ]);
  const tagIdsDoLead = new Set((tagsLead.data ?? []).map((t) => t.tag_id));

  type DealView = { id: string; titulo: string; valor: number; pipeline_stages: { nome: string; tipo: string } | null };
  type ConversaView = { id: string; nome: string | null; telefone: string | null; status: string; ultima_mensagem: string | null; ultima_em: string };
  type LinhaTimeline = { id: string; tipoItem: "atividade" | "tarefa"; titulo?: string; descricao?: string; tipo?: string; prioridade?: string; concluida_em: string | null; ocorreu_em: string | null; vence_em: string | null; created_at: string };

  if (!lead) return <div className="text-[14px] text-gray-500">Lead não encontrado.</div>;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contato" titulo={lead.nome} descricao={`${lead.empresa} · ${lead.cod}`} />

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Status</p>
          <Status valor={lead.status} />
        </div>
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Origem</p>
          <p className="text-[14px] text-white">{lead.origem}</p>
        </div>
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Próximo contato</p>
          <p className={`text-[14px] font-medium ${lead.proximo_contato_em && new Date(lead.proximo_contato_em) < new Date() ? "text-red-400" : "text-white"}`}>
            {lead.proximo_contato_em ? formatData(lead.proximo_contato_em) : "—"}
          </p>
        </div>
        <div className="painel p-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Segmento</p>
          <p className="text-[14px] text-white">{lead.segmento ?? "—"}</p>
        </div>
        <RecalcularScore leadId={id} scoreInicial={score?.score ?? null} classificacaoInicial={score?.classificacao ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Negócios</h2>
          </div>
          <div className="px-5 py-3 space-y-3">
            {(deals ?? []).length === 0 ? (
              <Vazio titulo="Sem negócios" texto="Crie um negócio para este contato no pipeline." />
            ) : (
              <ul>
                {(deals as DealView[]).map((d) => (
                  <li key={d.id} className="pb-3 border-b border-gray-800 last:border-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-white">{d.titulo}</span>
                      <span className="text-[11px] text-gray-500 tabular">{formatBRL(d.valor)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] uppercase ${d.pipeline_stages?.tipo === "ganho" ? "text-emerald-400" : d.pipeline_stages?.tipo === "perdido" ? "text-gray-500" : "text-gray-400"}`}>
                        {d.pipeline_stages?.nome ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Conversas WhatsApp</h2>
          </div>
          <div className="px-5 py-3 space-y-3">
            {(conversas ?? []).length === 0 ? (
              <Vazio titulo="Sem conversas" texto="As conversas do WhatsApp aparecem aqui quando houver contato." />
            ) : (
              <ul>
                {(conversas as ConversaView[]).map((c) => (
                  <li key={c.id} className="pb-3 border-b border-gray-800 last:border-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-white">{c.nome || c.telefone || "Contato"}</span>
                      <Status valor={c.status} />
                    </div>
                    <p className="text-[12px] text-gray-500 truncate">{c.ultima_mensagem ?? "—"}</p>
                    <p className="text-[11px] text-gray-600">{tempoRelativo(c.ultima_em)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Atividades e tarefas</h2>
        </div>
        <div className="px-5 py-3 space-y-2">
          {((atividades ?? []).length + (tarefas ?? []).length) === 0 ? (
            <Vazio titulo="Sem atividade" texto="Tudo o que acontecer com este contato aparece nesta linha do tempo." />
          ) : (
            <ul className="space-y-3">
              {[(atividades ?? []).map((a) => ({ ...a, tipoItem: "atividade" as const }) as LinhaTimeline),
                (tarefas ?? []).map((t) => ({ ...t, tipoItem: "tarefa" as const }) as LinhaTimeline)]
                .flat()
                .sort((a, b) => new Date(b.ocorreu_em || b.vence_em || b.created_at).getTime() - new Date(a.ocorreu_em || a.vence_em || a.created_at).getTime())
                .slice(0, 10).map((item) => (
                  <li key={item.id} className="relative flex gap-3 border-l border-gray-800 py-2 pl-4">
                    <span className="absolute -left-[3.5px] top-[17px] h-[6px] w-[6px] rounded-full bg-gray-600" />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-gray-200">
                        {item.tipoItem === "tarefa" ? item.titulo : item.descricao}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {item.tipoItem === "tarefa" ? `Tarefa · ${item.prioridade}` : item.tipo}
                        {item.concluida_em && <span className="text-emerald-500"> · concluída</span>}
                        · {tempoRelativo(item.ocorreu_em || item.vence_em || item.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Notas do lead</h3>
        <p className="text-[13px] text-gray-400">{lead.notas ?? "Sem notas ainda."}</p>
      </section>

      <section className="painel p-5">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3 mb-3">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">Histórico de alterações</h3>
        </div>
        <div className="px-5 py-3 space-y-2">
          {historico.length === 0 ? (
            <p className="text-[12px] text-gray-500">Sem alterações registradas ainda.</p>
          ) : (
            <ul className="space-y-2">
              {historico.map((h) => (
                <li key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-white truncate">{h.campo}</p>
                    <p className="text-[11px] text-gray-500">
                      {h.valor_antigo ?? "—"} → {h.valor_novo ?? "—"}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {h.usuario?.nome_completo || h.usuario?.email || "Sistema"} · {tempoRelativo(h.alterado_em)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="painel p-5">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3 mb-3">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">Tags</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {tagsDisponiveis.map((t) => {
            const ativo = tagIdsDoLead.has(t.id);
            return (
              <form key={t.id} action={async (f) => { await toggleTagLead(id, f.get("tag_id") as string); }} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: ativo ? "#FAFAFA" : "#333" }}>
                <label className="flex items-center gap-1 cursor-pointer select-none text-[12px]">
                  <input type="checkbox" name="tag_id" value={t.id} defaultChecked={ativo} className="w-4 h-4 rounded border-gray-600 text-emerald-500 accent-emerald-500" />
                  <span style={{ color: t.cor }} className="font-bold">{t.nome}</span>
                </label>
                <input type="hidden" name="tag_id" value={t.id} />
              </form>
            );
          })}
          {tagsDisponiveis.length === 0 && <p className="text-[12px] text-gray-500">Nenhuma tag cadastrada. Vá em Configurações &gt; Tags.</p>}
        </div>
      </section>
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
