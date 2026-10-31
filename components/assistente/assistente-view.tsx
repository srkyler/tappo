"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, Bot, Brain, Building2, FlaskConical, ShieldCheck } from "lucide-react";
import { Barra, Kpi, cn } from "@/components/ui/base";
import { completudePerfil, type Atendente, type Execucao, type ItemConhecimento, type Memoria, type PerfilIA } from "@/lib/ai/assistente-tipos";
import { FormPerfil } from "./form-perfil";
import { FormRegras } from "./form-regras";
import { Conhecimento } from "./conhecimento";
import { MemoriaIA } from "./memoria";
import { TestarAssistente } from "./testar";
import { Atividade } from "./atividade";
import { Atendentes, type CanalAtendente } from "./atendentes";
import { ImportarSite } from "./importar-site";
import { GoogleAgenda, type AgendaIA } from "./google-agenda";

type Aba = "empresa" | "atendentes" | "conhecimento" | "memoria" | "regras" | "testar" | "atividade";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { notation: n >= 100000 ? "compact" : "standard" }).format(n);

export function AssistenteView(p: {
  gestor: boolean;
  nomeEmpresa: string;
  perfil: PerfilIA;
  conhecimento: ItemConhecimento[];
  memorias: Memoria[];
  execucoes: Execucao[];
  plataformaAtiva: boolean;
  bloqueado: boolean;
  tokensMes: number;
  tetoMes: number | null;
  canaisComIA: number;
  perguntasQualificacao: number;
  atendentes: Atendente[];
  canais: CanalAtendente[];
  agenda: AgendaIA;
}) {
  const [aba, setAba] = useState<Aba>("empresa");
  // Atalho do log de atividade: "Ensinar resposta" abre o cadastro de FAQ já preenchido
  const [ensinar, setEnsinar] = useState<string | null>(null);

  const ativos = p.conhecimento.filter((c) => c.status === "ativo").length;
  const sugeridos = p.conhecimento.filter((c) => c.status === "sugerido").length;
  const completo = completudePerfil(p.perfil, ativos);
  const semResposta = p.execucoes.filter((e) => !e.teste && e.transferiu && !e.conhecimento_ids.length).length;

  const status = p.bloqueado ? "Pausado" : !p.plataformaAtiva ? "Indisponível" : p.canaisComIA ? "Atendendo" : "Pronto";
  const detalheStatus = p.bloqueado
    ? "Pausado pela administração da plataforma."
    : !p.plataformaAtiva
      ? "A IA da plataforma está temporariamente indisponível."
      : p.canaisComIA
        ? `Respondendo em ${p.canaisComIA} ${p.canaisComIA === 1 ? "canal" : "canais"}.`
        : "Ligue a IA numa conexão em Conexões.";

  const abas: { id: Aba; label: string; Icone: typeof Brain; badge?: number; so?: boolean }[] = [
    { id: "empresa", label: "Empresa", Icone: Building2 },
    { id: "atendentes", label: "Atendentes", Icone: Bot, badge: p.atendentes.length || undefined },
    { id: "conhecimento", label: "Conhecimento", Icone: BookOpen, badge: sugeridos || undefined },
    { id: "memoria", label: "Memória", Icone: Brain },
    { id: "regras", label: "Regras e horário", Icone: ShieldCheck },
    { id: "testar", label: "Testar", Icone: FlaskConical, so: true },
    { id: "atividade", label: "Atividade", Icone: Activity, badge: semResposta || undefined, so: true },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi rotulo="Status" valor={status} detalhe={detalheStatus} />
        <Kpi
          rotulo="Perfil preenchido"
          valor={`${completo}%`}
          detalhe={completo < 100 ? "Quanto mais completo, menos o assistente transfere." : "Tudo certo por aqui."}
        />
        <Kpi rotulo="Base de conhecimento" valor={fmt(ativos)} detalhe={sugeridos ? `${sugeridos} sugestão(ões) para revisar` : "FAQs e documentos ativos"} />
        <div className="painel p-5">
          <p className="rotulo">Uso no mês</p>
          <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em] text-white tabular">{fmt(p.tokensMes)}</p>
          {p.tetoMes ? (
            <>
              <Barra valor={p.tokensMes} max={p.tetoMes} className="mt-3" />
              <p className="mt-2 text-[12px] text-gray-500">de {fmt(p.tetoMes)} tokens do seu plano</p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-gray-500">tokens processados</p>
          )}
        </div>
      </div>

      {!p.gestor && (
        <p className="mb-5 rounded-lg border border-gray-800 px-4 py-3 text-[13px] text-gray-400">
          Você está vendo a configuração em modo leitura. Só o dono ou um gestor da empresa pode alterar o assistente.
        </p>
      )}

      <nav role="tablist" aria-label="Seções do assistente" className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-800">
        {abas.filter((a) => !a.so || p.gestor).map(({ id, label, Icone, badge }) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
              aba === id ? "border-white text-white" : "border-transparent text-gray-500 hover:text-gray-200",
            )}
          >
            <Icone size={14} /> {label}
            {badge ? <span className="rounded-full bg-white px-1.5 font-mono text-[10px] font-bold text-black">{badge}</span> : null}
          </button>
        ))}
      </nav>

      {aba === "empresa" && p.gestor && <ImportarSite />}
      {aba === "empresa" && <FormPerfil perfil={p.perfil} nomeEmpresa={p.nomeEmpresa} gestor={p.gestor} />}
      {aba === "atendentes" && <Atendentes atendentes={p.atendentes} canais={p.canais} gestor={p.gestor} />}
      {aba === "conhecimento" && (
        <Conhecimento itens={p.conhecimento} gestor={p.gestor} ensinar={ensinar} aoUsarEnsinar={() => setEnsinar(null)} />
      )}
      {aba === "memoria" && <MemoriaIA memorias={p.memorias} gestor={p.gestor} />}
      {aba === "regras" && <GoogleAgenda agenda={p.agenda} gestor={p.gestor} />}
      {aba === "regras" && (
        <FormRegras perfil={p.perfil} gestor={p.gestor} perguntasQualificacao={p.perguntasQualificacao} />
      )}
      {aba === "testar" && p.gestor && <TestarAssistente nomeAssistente={p.perfil.nome_assistente} atendentes={p.atendentes.filter((a) => a.ativo)} />}
      {aba === "atividade" && p.gestor && (
        <Atividade
          execucoes={p.execucoes}
          aoEnsinar={(pergunta) => { setEnsinar(pergunta); setAba("conhecimento"); }}
        />
      )}

      <p className="mt-10 text-[12px] text-gray-600">
        O modelo de IA, a infraestrutura e os limites de uso são gerenciados pela plataforma Tappo. As conversas em que a IA atende ficam no{" "}
        <Link href="/app/inbox" className="underline hover:text-gray-400">Inbox</Link>.
      </p>
    </div>
  );
}
