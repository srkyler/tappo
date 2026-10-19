import { Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import PermissoesClient from "./_client";

export const metadata = { title: "Permissões — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  return <PermissoesClient />;
}

export default function PermissoesPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}