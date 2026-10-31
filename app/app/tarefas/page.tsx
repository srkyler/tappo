import { Suspense } from "react";
import Link from "next/link";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { TarefasView } from "@/components/tarefas/tarefas-view";
import { bancoPronto } from "@/lib/data/queries";
import { listarTarefas } from "@/app/app/tarefas/actions";

export const metadata = { title: "Tarefas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const inicial = await listarTarefas();
  return <TarefasView inicial={inicial} />;
}

export default function TarefasPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Tarefas" titulo="Tarefas" descricao="Crie, acompanhe e conclua tarefas da equipe. Atrasadas aparecem em destaque no painel do gestor."
        acoes={<div className="flex gap-2"><Link href="/app/calendario" className="btn btn-secundario btn-sm">Calendário</Link><Link href="/app/tarefas-recorrentes" className="btn btn-secundario btn-sm">Recorrentes</Link></div>} />
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
