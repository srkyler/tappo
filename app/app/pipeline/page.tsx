import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { bancoPronto, lerLeads, lerPipeline } from "@/lib/data/queries";

export const metadata = { title: "Pipeline — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [{ etapas, deals }, leads] = await Promise.all([lerPipeline(), lerLeads()]);
  return <PipelineView etapas={etapas} deals={deals} leads={leads.map(({ id, nome, empresa }) => ({ id, nome, empresa }))} />;
}

export default function PipelinePage() {
  return (
    <Pagina className="max-w-none">
      <Cabecalho rotulo="Negócios" titulo="Pipeline" descricao="Arraste os cartões entre as etapas. No celular, use o seletor abaixo de cada cartão." />
      <Suspense fallback={<div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-80 w-[280px] shrink-0" />)}</div>}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
