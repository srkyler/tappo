import { Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import FunilEditorClient from "./_client";

export const metadata = { title: "Funil Customizável — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  return <FunilEditorClient />;
}

export default function FunilEditorPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
