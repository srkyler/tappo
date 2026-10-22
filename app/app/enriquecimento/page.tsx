import { Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import EnriquecimentoClient from "./_client";

export const metadata = { title: "Enriquecimento — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  return <EnriquecimentoClient />;
}

export default function EnriquecimentoPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
