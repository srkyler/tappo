import Link from "next/link";
import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Status, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { AcoesLead } from "@/components/radar/acoes-radar";
import { bancoPronto, lerCampanhas, lerLeads, lerPipeline, usuarioAtual } from "@/lib/data/queries";
import { diasDesde, formatBRL, formatData, hojeISO, isoDiasAtras } from "@/lib/data/format";

export const metadata = { title: "Radar — Tappo" };

const QUENTES = new Set(["Contatado", "Qualificado", "Reunião", "Follow-up"]);
const DIAS_FRIO = 7;
const DIAS_PARADO = 10;

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const desde = isoDiasAtras(90);
  const [leads, { etapas, deals }, campanhas, { data: ativ }] = await Promise.all([
    lerLeads(), lerPipeline(), lerCampanhas(),
    supabase.from("activities").select("lead_id, ocorreu_em").not("lead_id", "is", null).gte("ocorreu_em", desde).order("ocorreu_em", { ascending: false }).limit(5000),
  ]);
  const hoje = hojeISO();

  const ultimo = new Map<string, string>();
  for (const a of ativ ?? []) if (a.lead_id && !ultimo.has(a.lead_id)) ultimo.set(a.lead_id, a.ocorreu_em);

  const atrasados = leads
    .filter((l) => l.status !== "Perdido" && l.proximo_contato_em && l.proximo_contato_em < hoje)
    .sort((a, b) => a.proximo_contato_em!.localeCompare(b.proximo_contato_em!));

  const idsAtrasados = new Set(atrasados.map((l) => l.id));
  const esfriando = leads
    .filter((l) => QUENTES.has(l.status) && !idsAtrasados.has(l.id))
    .map((l) => ({ l, dias: diasDesde(ultimo.get(l.id) ?? l.created_at) }))
    .filter((x) => x.dias >= DIAS_FRIO)
    .sort((a, b) => b.dias - a.dias);

  const abertas = new Map(etapas.filter((e) => e.tipo === "aberto").map((e) => [e.id, e]));
  const parados = deals
    .filter((d) => abertas.has(d.stage_id) && diasDesde(d.etapa_entrada_em) >= DIAS_PARADO)
    .sort((a, b) => b.valor - a.valor);

  const cadencias = campanhas
    .filter((c) => c.status === "Ativa")
    .flatMap((c) => c.leads.filter((cl) => cl.status === "Ativo" && cl.proximo_passo_em && cl.proximo_passo_em < hoje).map((cl) => ({ c, cl })));

  const total = atrasados.length + esfriando.length + parados.length + cadencias.length;
  const emRisco = parados.reduce((s, d) => s + d.valor, 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Contatos atrasados", atrasados.length],
          [`Sem toque há ${DIAS_FRIO}+ dias`, esfriando.length],
          ["Negócios parados", parados.length],
          ["Cadências vencidas", cadencias.length],
        ].map(([r, v]) => (
          <div key={r} className="painel p-4">
            <p className="text-[26px] font-semibold leading-none text-white tabular">{v}</p>
            <p className="mt-2 text-[12px] text-gray-500">{r}</p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="painel"><Vazio titulo="Radar limpo" texto="Nada esfriando agora. Bom trabalho — volte amanhã." /></div>
      ) : (
        <div className="space-y-4">
          {atrasados.length > 0 && (
            <Painel titulo={`Contatos atrasados · ${atrasados.length}`}>
              <ul className="divide-y divide-gray-800">
                {atrasados.slice(0, 30).map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{l.nome} <span className="font-normal text-gray-500">· {l.empresa}</span></p>
                      <p className="text-[12px] text-gray-500">Era para {formatData(l.proximo_contato_em)} · {diasDesde(l.proximo_contato_em!)} dia(s) de atraso · <Status valor={l.status} className="!h-5 align-middle" /></p>
                    </div>
                    <AcoesLead id={l.id} nome={l.nome} />
                  </li>
                ))}
              </ul>
            </Painel>
          )}

          {esfriando.length > 0 && (
            <Painel titulo={`Esfriando · ${esfriando.length}`} acao={<span className="text-[12px] text-gray-500">em andamento e sem atividade</span>}>
              <ul className="divide-y divide-gray-800">
                {esfriando.slice(0, 30).map(({ l, dias }) => (
                  <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{l.nome} <span className="font-normal text-gray-500">· {l.empresa}</span></p>
                      <p className="text-[12px] text-gray-500">{dias} dias sem nenhum toque · {l.status}</p>
                    </div>
                    <AcoesLead id={l.id} nome={l.nome} />
                  </li>
                ))}
              </ul>
            </Painel>
          )}

          {parados.length > 0 && (
            <Painel titulo={`Negócios parados · ${formatBRL(emRisco)} em risco`} acao={<Link href="/app/pipeline" className="text-[12px] text-gray-500 hover:text-white">Pipeline →</Link>}>
              <ul className="divide-y divide-gray-800">
                {parados.slice(0, 30).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{d.titulo} <span className="font-normal text-gray-500">· {d.empresa}</span></p>
                      <p className="text-[12px] text-gray-500">{diasDesde(d.etapa_entrada_em)} dias em “{abertas.get(d.stage_id)?.nome}”</p>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-white tabular">{formatBRL(d.valor)}</span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}

          {cadencias.length > 0 && (
            <Painel titulo={`Cadências vencidas · ${cadencias.length}`} acao={<Link href="/app/campanhas" className="text-[12px] text-gray-500 hover:text-white">Campanhas →</Link>}>
              <ul className="divide-y divide-gray-800">
                {cadencias.slice(0, 30).map(({ c, cl }) => (
                  <li key={cl.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{cl.lead?.nome ?? "Lead"} <span className="font-normal text-gray-500">· {c.nome}</span></p>
                      <p className="text-[12px] text-gray-500">Etapa {cl.etapas_concluidas + 1}: {c.passos[cl.etapas_concluidas]?.acao ?? "—"} · venceu {formatData(cl.proximo_passo_em)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>
      )}
    </>
  );
}

export default function RadarPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Nada morre no silêncio" titulo="Radar" descricao="Tudo que está esfriando: contatos atrasados, leads sem toque, negócios parados e cadências vencidas. Resolva com um clique." />
      <Suspense fallback={<div className="space-y-4"><div className="esqueleto h-24" /><div className="esqueleto h-72" /></div>}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
