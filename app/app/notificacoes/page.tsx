import { Suspense } from "react";
import Link from "next/link";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { minhasPendencias } from "./actions";

export const metadata = { title: "Notificações — Tappo" };

const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const GRUPOS = [
  { tipo: "transferida", titulo: "Aguardando atendente" },
  { tipo: "mensagem", titulo: "Mensagens não lidas nas suas conversas" },
  { tipo: "tarefa", titulo: "Suas tarefas vencidas ou para hoje" },
] as const;

async function Conteudo() {
  const itens = await minhasPendencias();
  if (!itens.length) return <section className="painel"><Vazio titulo="Nada pendente" texto="Quando algo precisar de você — mensagem, transferência da IA ou tarefa — aparece aqui e no sino." /></section>;
  return (
    <div className="space-y-6">
      {GRUPOS.map((g) => {
        const lista = itens.filter((i) => i.tipo === g.tipo);
        if (!lista.length) return null;
        return (
          <section key={g.tipo} className="painel">
            <h2 className="border-b border-gray-800 px-5 py-3 text-[13px] font-medium text-white">{g.titulo} ({lista.length})</h2>
            <ul className="divide-y divide-gray-800">
              {lista.map((i) => (
                <li key={i.id}>
                  <Link href={i.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-900/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-white">{i.titulo}</span>
                      <span className={`block truncate text-[12.5px] ${i.urgente ? "text-red-300" : "text-gray-500"}`}>{i.detalhe}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-gray-500">{fmt(i.em)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function NotificacoesPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Sistema" titulo="Notificações" descricao="O que precisa de você agora. O sino no topo mostra o mesmo, atualizado a cada minuto." />
      <Suspense fallback={<div className="esqueleto h-[50vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
