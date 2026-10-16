import Link from "next/link";
import { Suspense } from "react";
import { Webhook } from "lucide-react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { LeadsView } from "@/components/leads/leads-view";
import { bancoPronto, lerLeads } from "@/lib/data/queries";

export const metadata = { title: "Leads — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const leads = await lerLeads();
  return <LeadsView leads={leads} />;
}

export default function LeadsPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Base" titulo="Leads" descricao="Sua base de prospecção. Clique num lead para editar, mude o status direto na lista ou importe uma planilha."
        acoes={<Link href="/app/captacao" className="btn btn-fantasma btn-sm"><Webhook size={14} /> Captação automática</Link>}
      />
      <Suspense fallback={<div className="space-y-3"><div className="esqueleto h-10 w-80" /><div className="esqueleto h-96" /></div>}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
