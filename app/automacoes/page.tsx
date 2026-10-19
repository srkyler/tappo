import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, lerCampanhas, lerPipeline } from "@/lib/data/queries";
import { lerTags } from "@/lib/data/tags";
import { lerAutomacoes } from "@/lib/data/automacoes";
import { membrosDaEmpresa } from "@/lib/data/empresa";
import { AutomacoesView } from "@/components/automacoes/automacoes-view";

export const metadata = { title: "Automações — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [automacoes, { etapas }, tags, campanhas, membros] = await Promise.all([
    lerAutomacoes(), lerPipeline(), lerTags(), lerCampanhas(), membrosDaEmpresa(),
  ]);

  return (
    <div className="space-y-6">
      <Cabecalho
        rotulo="Ferramentas"
        titulo="Automações"
        descricao="Regras QUANDO/SE/ENTÃO: quando algo muda no CRM, a ação roda sozinha. Toda automação nasce pausada até você revisar e ativar."
      />
      <AutomacoesView automacoes={automacoes} etapas={etapas} tags={tags} campanhas={campanhas} membros={membros} />
    </div>
  );
}

export default function AutomacoesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
