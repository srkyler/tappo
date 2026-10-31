import { Suspense } from "react";
import { Barra, Cabecalho, Kpi, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { empresaAtual } from "@/lib/data/empresa";
import { usuarioAtual } from "@/lib/data/queries";

export const metadata = { title: "Executivo — Tappo" };

/*
 * Dashboard executivo com números reais: receita ganha, previsão ponderada pela
 * probabilidade da etapa, taxa de ganho, ticket, ciclo de venda, funil aberto e o
 * peso da IA no atendimento. Tudo lido pela sessão (RLS da empresa).
 */

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: n >= 10000 ? 0 : 2 }).format(n);
const int = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIA = 86_400_000;

type Deal = { id: string; valor: number; stage_id: string; created_at: string; fechado_em: string | null; data_fechamento_previsto: string | null };
type Etapa = { id: string; nome: string; ordem: number; probabilidade: number; tipo: "aberto" | "ganho" | "perdido"; pipeline_id: string | null };

async function Conteudo() {
  const empresa = await empresaAtual();
  if (!empresa) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const seisMeses = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const d30 = new Date(Date.now() - 30 * DIA).toISOString();
  const d90 = Date.now() - 90 * DIA;
  const contar = (t: string) => supabase.from(t).select("id", { count: "exact", head: true }).eq("org_id", empresa.id);

  const [{ data: deals }, { data: etapas }, leadsMes, leadsMesAnt, ia, iaTransf, msgIa, msgHumano] = await Promise.all([
    supabase.from("deals").select("id, valor, stage_id, created_at, fechado_em, data_fechamento_previsto").eq("org_id", empresa.id).limit(10000),
    supabase.from("pipeline_stages").select("id, nome, ordem, probabilidade, tipo, pipeline_id").eq("org_id", empresa.id).order("ordem"),
    contar("leads").gte("created_at", inicioMes.toISOString()),
    contar("leads").gte("created_at", inicioMesAnterior.toISOString()).lt("created_at", inicioMes.toISOString()),
    contar("ia_execucoes").eq("teste", false).gte("created_at", d30),
    contar("ia_execucoes").eq("teste", false).eq("transferiu", true).gte("created_at", d30),
    contar("wa_mensagens").eq("direcao", "saida").eq("autor", "ia").gte("created_at", d30),
    contar("wa_mensagens").eq("direcao", "saida").eq("autor", "humano").gte("created_at", d30),
  ]);

  const lista = (deals ?? []) as Deal[];
  const porId = new Map(((etapas ?? []) as Etapa[]).map((e) => [e.id, e]));
  const tipo = (d: Deal) => porId.get(d.stage_id)?.tipo ?? "aberto";
  const fechou = (d: Deal) => (d.fechado_em ? Date.parse(d.fechado_em) : NaN);
  const ganhos = lista.filter((d) => tipo(d) === "ganho");
  const perdidos = lista.filter((d) => tipo(d) === "perdido");
  const abertos = lista.filter((d) => tipo(d) === "aberto");
  const soma = (xs: Deal[]) => xs.reduce((s, d) => s + Number(d.valor), 0);

  const ganhoEntre = (de: Date, ate: Date) => ganhos.filter((d) => fechou(d) >= de.getTime() && fechou(d) < ate.getTime());
  const receitaMes = soma(ganhoEntre(inicioMes, fimMes));
  const receitaAnt = soma(ganhoEntre(inicioMesAnterior, inicioMes));
  const variacao = receitaAnt > 0 ? Math.round(((receitaMes - receitaAnt) / receitaAnt) * 100) : null;

  // Previsão do mês: ganho até agora + abertos com fechamento previsto no mês × probabilidade da etapa
  const fimMesIso = fimMes.toISOString().slice(0, 10);
  const previstoAberto = abertos
    .filter((d) => !d.data_fechamento_previsto || d.data_fechamento_previsto < fimMesIso)
    .reduce((s, d) => s + Number(d.valor) * ((porId.get(d.stage_id)?.probabilidade ?? 0) / 100), 0);

  const ganhos90 = ganhos.filter((d) => fechou(d) >= d90);
  const perdidos90 = perdidos.filter((d) => fechou(d) >= d90);
  const ticket = ganhos90.length ? soma(ganhos90) / ganhos90.length : 0;
  const ciclos = ganhos90.map((d) => (fechou(d) - Date.parse(d.created_at)) / DIA).filter((n) => n >= 0);
  const ciclo = ciclos.length ? Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length) : null;

  const meses = Array.from({ length: 6 }, (_, i) => {
    const de = new Date(seisMeses.getFullYear(), seisMeses.getMonth() + i, 1);
    const ate = new Date(de.getFullYear(), de.getMonth() + 1, 1);
    const g = ganhoEntre(de, ate);
    return { rotulo: `${MESES[de.getMonth()]}/${String(de.getFullYear()).slice(2)}`, valor: soma(g), qtd: g.length };
  });
  const maxMes = Math.max(...meses.map((m) => m.valor), 1);

  const funil = ((etapas ?? []) as Etapa[]).filter((e) => e.tipo === "aberto").map((e) => {
    const ds = abertos.filter((d) => d.stage_id === e.id);
    return { ...e, qtd: ds.length, valor: soma(ds) };
  }).filter((e) => e.qtd > 0);
  const maxFunil = Math.max(...funil.map((e) => e.valor), 1);

  const execucoes = ia.count ?? 0;
  const resolvidasIA = execucoes - (iaTransf.count ?? 0);
  const totalMsgs = (msgIa.count ?? 0) + (msgHumano.count ?? 0);

  if (!lista.length && !execucoes && !(leadsMes.count ?? 0)) {
    return (
      <div className="space-y-6">
        <Cabecalho rotulo="Análise" titulo="Dashboard executivo" descricao="Receita, previsão, conversão e o peso da IA no atendimento." />
        <section className="painel"><Vazio titulo="Ainda sem dados" texto="Cadastre negócios no Pipeline e ligue a IA numa conexão — os números aparecem aqui." /></section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Análise" titulo="Dashboard executivo" descricao="Receita, previsão, conversão e o peso da IA no atendimento." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Receita do mês" valor={brl(receitaMes)}
          detalhe={variacao === null ? `${ganhoEntre(inicioMes, fimMes).length} negócios ganhos` : `${variacao >= 0 ? "+" : ""}${variacao}% vs. mês anterior`} />
        <Kpi rotulo="Previsão do mês" valor={brl(receitaMes + previstoAberto)} detalhe={`${brl(previstoAberto)} ponderado pelas etapas`} />
        <Kpi rotulo="Taxa de ganho (90 dias)" valor={pct(ganhos90.length, ganhos90.length + perdidos90.length)}
          detalhe={`${ganhos90.length} ganhos · ${perdidos90.length} perdidos`} />
        <Kpi rotulo="Ticket médio (90 dias)" valor={ganhos90.length ? brl(ticket) : "—"} detalhe={ciclo !== null ? `Ciclo médio: ${ciclo} dia${ciclo === 1 ? "" : "s"}` : "Sem vendas fechadas"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="painel p-5">
          <h2 className="text-[13px] font-medium text-white">Receita ganha — últimos 6 meses</h2>
          <ul className="mt-4 space-y-3">
            {meses.map((m) => (
              <li key={m.rotulo} className="grid grid-cols-[3.5rem_1fr_7rem] items-center gap-3 text-[12px]">
                <span className="text-gray-500">{m.rotulo}</span>
                <Barra valor={m.valor} max={maxMes} />
                <span className="text-right tabular text-gray-200">{brl(m.valor)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="painel p-5">
          <h2 className="text-[13px] font-medium text-white">Funil aberto</h2>
          {funil.length ? (
            <ul className="mt-4 space-y-3">
              {funil.map((e) => (
                <li key={e.id} className="text-[12px]">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="truncate text-gray-300">{e.nome} <span className="text-gray-500">· {e.qtd} · {e.probabilidade}%</span></span>
                    <span className="tabular text-gray-200">{brl(e.valor)}</span>
                  </div>
                  <Barra valor={e.valor} max={maxFunil} />
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-[13px] text-gray-500">Nenhum negócio aberto.</p>}
          <p className="mt-4 text-[12px] text-gray-500">{abertos.length} negócios abertos · {brl(soma(abertos))} no total</p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Leads novos no mês" valor={int(leadsMes.count ?? 0)} detalhe={`${int(leadsMesAnt.count ?? 0)} no mês anterior`} />
        <Kpi rotulo="Atendimentos da IA (30 dias)" valor={int(execucoes)} detalhe={`${pct(resolvidasIA, execucoes)} sem precisar de humano`} />
        <Kpi rotulo="Transferidas para humano" valor={int(iaTransf.count ?? 0)} detalhe="últimos 30 dias" />
        <Kpi rotulo="Mensagens enviadas pela IA" valor={pct(msgIa.count ?? 0, totalMsgs)} detalhe={`${int(msgIa.count ?? 0)} da IA · ${int(msgHumano.count ?? 0)} da equipe (WhatsApp, 30 dias)`} />
      </div>
    </div>
  );
}

export default function ExecutivoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
