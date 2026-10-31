import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { empresaAtual } from "@/lib/data/empresa";
import { usuarioAtual } from "@/lib/data/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { configAgenda, eventosEntre, googleConfigurado, type EventoAgenda } from "@/lib/google/agenda";

export const metadata = { title: "Calendário — Tappo" };

/*
 * Calendário mensal: tarefas do CRM (vence_em) + eventos do Google Agenda da empresa,
 * quando conectada em Assistente IA › Regras. Fuso de Brasília (UTC-3 fixo).
 */

const OFFSET = 3 * 3_600_000;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const p2 = (n: number) => String(n).padStart(2, "0");
/** Data (AAAA-MM-DD) e hora (HH:MM) em Brasília. */
const local = (iso: string) => {
  const d = new Date(Date.parse(iso) - OFFSET);
  return { dia: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, hora: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` };
};

type Item = { id: string; titulo: string; hora: string | null; tipo: "tarefa" | "feita" | "google"; href: string | null };

async function Conteudo({ mes }: { mes?: string }) {
  const empresa = await empresaAtual();
  if (!empresa) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();

  const hoje = local(new Date().toISOString()).dia;
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "") ?? /^(\d{4})-(\d{2})/.exec(hoje)!;
  const ano = +m[1], mesIdx = Math.min(11, Math.max(0, +m[2] - 1));
  const inicio = new Date(Date.UTC(ano, mesIdx, 1) + OFFSET);
  const fim = new Date(Date.UTC(ano, mesIdx + 1, 1) + OFFSET);
  const anterior = `${mesIdx === 0 ? ano - 1 : ano}-${p2(mesIdx === 0 ? 12 : mesIdx)}`;
  const proximo = `${mesIdx === 11 ? ano + 1 : ano}-${p2(mesIdx === 11 ? 1 : mesIdx + 2)}`;

  const [{ data: tarefas }, cfg] = await Promise.all([
    supabase.from("tarefas").select("*") // "*": funciona antes e depois da migration da agenda (google_evento_id)
      .eq("org_id", empresa.id).gte("vence_em", inicio.toISOString()).lt("vence_em", fim.toISOString())
      .order("vence_em").limit(500),
    googleConfigurado() ? configAgenda(createAdminClient(), empresa.id).catch(() => null) : Promise.resolve(null),
  ]);
  let eventos: EventoAgenda[] = [];
  let erroGoogle = false;
  if (cfg) {
    try { eventos = await eventosEntre(createAdminClient(), cfg, inicio, fim); } catch { erroGoogle = true; }
  }

  const porDia = new Map<string, Item[]>();
  const add = (dia: string, i: Item) => porDia.set(dia, [...(porDia.get(dia) ?? []), i]);
  const daIA = new Set((tarefas ?? []).map((t) => t.google_evento_id).filter(Boolean));
  for (const t of tarefas ?? []) {
    const l = local(t.vence_em!);
    add(l.dia, { id: t.id, titulo: t.titulo, hora: l.hora === "00:00" ? null : l.hora, tipo: t.concluida_em ? "feita" : "tarefa", href: "/app/tarefas" });
  }
  for (const e of eventos) {
    if (daIA.has(e.id)) continue; // já aparece como tarefa
    const l = local(e.inicio);
    add(l.dia, { id: e.id, titulo: e.titulo, hora: e.diaInteiro ? null : l.hora, tipo: "google", href: e.link });
  }
  for (const lista of porDia.values()) lista.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));

  // Grade: começa no domingo da semana do dia 1
  const primeiroDia = new Date(Date.UTC(ano, mesIdx, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mesIdx + 1, 0)).getUTCDate();
  const celulas: (string | null)[] = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${ano}-${p2(mesIdx + 1)}-${p2(i + 1)}`),
  ];
  while (celulas.length % 7) celulas.push(null);

  const cor = { tarefa: "border-sky-500/40 bg-sky-500/10 text-sky-200", feita: "border-gray-700 bg-gray-800/40 text-gray-500 line-through", google: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Agenda" titulo="Calendário" descricao="Tarefas do CRM e, se conectada, a agenda Google da empresa." />

      <section className="painel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <Link href={`/app/calendario?mes=${anterior}`} className="btn btn-fantasma btn-sm" aria-label="Mês anterior"><ChevronLeft size={14} /></Link>
            <h2 className="min-w-[10rem] text-center text-[14px] font-medium capitalize text-white">{MESES[mesIdx]} de {ano}</h2>
            <Link href={`/app/calendario?mes=${proximo}`} className="btn btn-fantasma btn-sm" aria-label="Próximo mês"><ChevronRight size={14} /></Link>
            <Link href="/app/calendario" className="btn btn-secundario btn-sm">Hoje</Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> Tarefas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Google Agenda</span>
            {!cfg && <Link href="/app/assistente" className="text-gray-300 underline-offset-2 hover:underline">Conectar Google Agenda</Link>}
            {erroGoogle && <span className="text-amber-300">Não consegui ler o Google agora.</span>}
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-800 text-center text-[11px] uppercase tracking-wide text-gray-500">
          {SEMANA.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((dia, i) => {
            const itens = dia ? porDia.get(dia) ?? [] : [];
            return (
              <div key={dia ?? `v${i}`} className={`min-h-[6.5rem] border-b border-r border-gray-800/70 p-1.5 ${dia ? "" : "bg-gray-900/30"}`}>
                {dia && (
                  <>
                    <p className={`mb-1 text-right text-[12px] ${dia === hoje ? "font-semibold text-white" : "text-gray-500"}`}>
                      {dia === hoje ? <span className="rounded-full bg-white px-1.5 text-gray-900">{+dia.slice(8)}</span> : +dia.slice(8)}
                    </p>
                    <ul className="space-y-1">
                      {itens.slice(0, 3).map((it) => {
                        const conteudo = <>{it.hora && <span className="mr-1 opacity-70">{it.hora}</span>}{it.titulo}</>;
                        const cls = `block truncate rounded border px-1.5 py-0.5 text-[11px] ${cor[it.tipo]}`;
                        return (
                          <li key={it.id} title={`${it.hora ?? "dia todo"} — ${it.titulo}`}>
                            {it.href?.startsWith("http")
                              ? <a href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>{conteudo}</a>
                              : it.href ? <Link href={it.href} className={cls}>{conteudo}</Link> : <span className={cls}>{conteudo}</span>}
                          </li>
                        );
                      })}
                      {itens.length > 3 && <li className="px-1.5 text-[11px] text-gray-500">+{itens.length - 3} mais</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  return (
    <Pagina>
      <Suspense key={mes ?? ""} fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo mes={mes} />
      </Suspense>
    </Pagina>
  );
}
