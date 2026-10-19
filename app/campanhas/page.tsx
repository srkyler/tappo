import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { CampanhasView } from "@/components/campanhas/campanhas-view";
import { bancoPronto, lerCampanhas, lerLeads } from "@/lib/data/queries";

export const metadata = { title: "Campanhas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [campanhas, leads] = await Promise.all([lerCampanhas(), lerLeads()]);
  return <CampanhasView campanhas={campanhas} leads={leads.map(({ id, nome, empresa, status }) => ({ id, nome, empresa, status }))} />;
}

export default function CampanhasPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Cadências" titulo="Campanhas" descricao="Sequências multicanal. Adicione leads e marque cada etapa executada — o Tappo calcula o próximo contato." />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-56" />)}</div>}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
