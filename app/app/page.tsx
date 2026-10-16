import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Barra, Cabecalho, Kpi, Pagina, Painel, Status, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, lerAtividades, lerCampanhas, lerLeads, lerPerfil, lerResumo } from "@/lib/data/queries";
import { formatBRL, formatData, formatNum, hojeISO, tempoRelativo } from "@/lib/data/format";

export const metadata = { title: "Início — Tappo" };

function saudacao() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function delta(atual: number, anterior: number) {
  const d = atual - anterior;
  return d === 0 ? "igual ao período anterior" : `${d > 0 ? "+" : ""}${formatNum(d)} vs período anterior`;
}

const SUGESTOES = [
  "Quem devo contatar hoje?",
  "Resuma meu pipeline",
  "Escreva um e-mail de primeiro contato",
];

async function Conteudo() {
  if (!(await bancoPronto())) {
    return <AvisoBanco />;
  }
  const [perfil, resumo, leads, campanhas, atividades] = await Promise.all([
    lerPerfil(), lerResumo(30), lerLeads(), lerCampanhas(), lerAtividades(8),
  ]);
  const hoje = hojeISO();
  const paraHoje = leads
    .filter((l) => l.proximo_contato_em && l.proximo_contato_em <= hoje && l.status !== "Perdido")
    .slice(0, 6);
  const ativas = campanhas.filter((c) => c.status === "Ativa").slice(0, 4);
  const nome = perfil?.nome_completo?.split(" ")[0];

  return (
    <>
      <Cabecalho
        rotulo={new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date())}
        titulo={`${saudacao()}${nome ? `, ${nome}` : ""}.`}
        descricao={paraHoje.length ? `Você tem ${paraHoje.length} contato${paraHoje.length > 1 ? "s" : ""} agendado${paraHoje.length > 1 ? "s" : ""} para hoje.` : "Nenhum contato agendado para hoje."}
        acoes={<Link href="/app/leads?novo=1" className="btn btn-primario btn-sm">Novo lead</Link>}
      />

      {/* Agente */}
      <section className="painel mb-8 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black"><Sparkles size={17} /></span>
            <div>
              <p className="text-[15px] font-medium text-white">Agente Tappo</p>
              <p className="text-[13px] text-gray-500">Peça análises, mensagens ou que ele cadastre e mova registros por você.</p>
            </div>
          </div>
          <form action="/app/agente" className="flex w-full gap-2 sm:max-w-[420px]">
            <input name="q" className="campo" placeholder="Pergunte algo sobre sua base…" aria-label="Pergunta para o agente" />
            <button className="btn btn-primario shrink-0 !px-3" aria-label="Enviar"><ArrowRight size={16} /></button>
          </form>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-gray-800 px-5 py-3 sm:px-6">
          {SUGESTOES.map((s) => (
            <Link key={s} href={`/app/agente?q=${encodeURIComponent(s)}`} className="shrink-0 rounded-full border border-gray-800 px-3 py-1.5 text-[12.5px] text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
              {s}
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Leads na base" valor={formatNum(resumo?.leads_total ?? leads.length)} detalhe={resumo ? `${delta(resumo.leads_periodo, resumo.leads_anterior)}` : undefined} />
        <Kpi rotulo="Reuniões · 30d" valor={formatNum(resumo?.reunioes_periodo ?? 0)} detalhe={resumo ? delta(resumo.reunioes_periodo, resumo.reunioes_anterior) : undefined} />
        <Kpi rotulo="Pipeline aberto" valor={formatBRL(resumo?.pipeline_aberto ?? 0)} detalhe={`${campanhas.filter((c) => c.status === "Ativa").length} campanhas ativas`} />
        <Kpi rotulo="Ganho · 30d" valor={formatBRL(resumo?.valor_ganho_periodo ?? 0)} detalhe={`${resumo?.ganhos_periodo ?? 0} negócios fechados`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Painel titulo="Contatos para hoje" acao={<Link href="/app/leads" className="text-[12px] text-gray-500 hover:text-white">Ver leads →</Link>}>
          {paraHoje.length === 0 ? (
            <Vazio titulo="Agenda livre" texto="Defina “próximo contato” nos leads para eles aparecerem aqui." />
          ) : (
            <ul className="divide-y divide-gray-800">
              {paraHoje.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-white">{l.nome}</p>
                    <p className="truncate text-[12px] text-gray-500">{l.empresa} · {l.proximo_contato_em === hoje ? "hoje" : `atrasado desde ${formatData(l.proximo_contato_em)}`}</p>
                  </div>
                  <Status valor={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel titulo="Campanhas ativas" acao={<Link href="/app/campanhas" className="text-[12px] text-gray-500 hover:text-white">Gerenciar →</Link>}>
          {ativas.length === 0 ? (
            <Vazio titulo="Nenhuma campanha ativa" texto="Crie uma cadência e adicione leads para começar." acao={<Link href="/app/campanhas" className="btn btn-secundario btn-sm">Criar campanha</Link>} />
          ) : (
            <ul className="divide-y divide-gray-800">
              {ativas.map((c) => {
                const total = c.leads.length * Math.max(1, c.passos.length);
                const feitas = c.leads.reduce((s, l) => s + l.etapas_concluidas, 0);
                return (
                  <li key={c.id} className="px-5 py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-[14px] font-medium text-white">{c.nome}</span>
                      <span className="shrink-0 text-[12px] text-gray-500 tabular">{c.leads.length} leads</span>
                    </div>
                    <Barra valor={feitas} max={total} />
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel titulo="Funil" acao={<Link href="/app/pipeline" className="text-[12px] text-gray-500 hover:text-white">Pipeline →</Link>}>
          {(resumo?.funil ?? []).length === 0 ? (
            <Vazio titulo="Sem etapas" />
          ) : (
            <ul className="space-y-3 px-5 py-4">
              {resumo!.funil.map((f) => {
                const max = Math.max(1, ...resumo!.funil.map((x) => x.total));
                return (
                  <li key={f.etapa} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="truncate text-gray-400">{f.etapa}</span>
                    <Barra valor={f.total} max={max} />
                    <span className="w-8 text-right text-white tabular">{f.total}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel titulo="Atividade recente">
          {atividades.length === 0 ? (
            <Vazio titulo="Nada por aqui ainda" texto="Tudo o que você fizer no Tappo aparece nesta linha do tempo." />
          ) : (
            <ul className="px-5 py-2">
              {atividades.map((a) => (
                <li key={a.id} className="relative flex gap-3 border-l border-gray-800 py-2.5 pl-4">
                  <span className="absolute -left-[3.5px] top-[17px] h-[6px] w-[6px] rounded-full bg-white" />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-gray-200">{a.descricao}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{tempoRelativo(a.ocorreu_em)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </>
  );
}

function Carregando() {
  return (
    <div className="space-y-6">
      <div className="esqueleto h-20 w-full" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-[110px]" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((i) => <div key={i} className="esqueleto h-64" />)}</div>
    </div>
  );
}

export default function InicioPage() {
  return (
    <Pagina>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
