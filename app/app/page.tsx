import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Dashboard — Tappo" };

const MODULOS = [
  { id: "leads", nome: "Leads", icone: "users", descricao: "Base de contatos e qualificação", cor: "text-blue-400" },
  { id: "pipeline", nome: "Pipeline", icone: "kanban", descricao: "Funil de vendas e negócios", cor: "text-emerald-400" },
  { id: "inbox", nome: "Inbox WhatsApp", icone: "message-square", descricao: "Atendimento e conversas", cor: "text-green-400" },
  { id: "tarefas", nome: "Tarefas", icone: "check-square", descricao: "Atividades e follow-ups", cor: "text-purple-400" },
  { id: "contas", nome: "Contas", icone: "building", descricao: "Empresas e organizações", cor: "text-indigo-400" },
  { id: "pessoas", nome: "Pessoas", icone: "user", descricao: "Contatos e decisores", cor: "text-pink-400" },
  { id: "propostas", nome: "Propostas", icone: "file-text", descricao: "Comerciais e assinaturas", cor: "text-orange-400" },
  { id: "comissoes", nome: "Comissões", icone: "dollar-sign", descricao: "Ganhos e pagamentos", cor: "text-amber-400" },
  { id: "executivo", nome: "Dashboard executivo", icone: "bar-chart-3", descricao: "Analytics e métricas", cor: "text-red-400" },
  { id: "jarvis", nome: "Jarvis IA", icone: "bot", descricao: "Assistente de automação", cor: "text-cyan-400" },
  { id: "whatsapp-config", nome: "WhatsApp", icone: "smartphone", descricao: "Instâncias e templates", cor: "text-teal-400" },
  { id: "permissoes", nome: "Permissões", icone: "shield", descricao: "Controle de acesso", cor: "text-slate-400" },
  { id: "cadencia", nome: "Cadências", icone: "send", descricao: "Sequências multi-canal", cor: "text-violet-400" },
  { id: "sla", nome: "SLA", icone: "clock", descricao: "Prazos de atendimento", cor: "text-rose-400" },
];

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Tappo" titulo="Bem-vindo ao seu CRM" descricao="Gerencie leads, pipeline, atendimento e automações em um só lugar." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULOS.map((m) => (
          <a
            key={m.id}
            href={`/app/${m.id}`}
            className="group rounded-lg border border-gray-800 bg-black/30 p-4 hover:border-gray-600 hover:bg-black/50 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/50 mb-3 group-hover:bg-blue-500/10 transition-colors">
              <span className={`text-[18px] ${m.cor}`}>{m.icone}</span>
            </div>
            <h3 className="text-sm font-semibold text-white">{m.nome}</h3>
            <p className="mt-1 text-[12px] text-gray-500">{m.descricao}</p>
          </a>
        ))}
      </div>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Ações rápidas</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <button className="btn btn-primario btn-sm w-full">Novo lead</button>
          <button className="btn btn-primario btn-sm w-full">Nova tarefa</button>
          <button className="btn btn-primario btn-sm w-full">Nova proposta</button>
          <button className="btn btn-secundario btn-sm w-full">Jarvis IA</button>
          <button className="btn btn-secundario btn-sm w-full">Configurar WhatsApp</button>
          <button className="btn btn-secundario btn-sm w-full">Ver pipeline</button>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
