import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerDuplicados } from "@/lib/data/crm";
import { FormMesclarDuplicado } from "@/components/crm/form-mesclar-duplicado";

export const metadata = { title: "Duplicados — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const duplicados = await lerDuplicados();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Leads duplicados" descricao="Revise e mescle leads com mesmo telefone ou e-mail para evitar dados duplicados na base." />

      <div className="painel">
        <div className="px-5 py-3 space-y-2">
          {duplicados.length === 0 ? (
            <Vazio titulo="Sem duplicados" texto="Não há leads duplicados para revisar." />
          ) : (
            <div className="space-y-3">
              {duplicados.map((d) => (
                <div key={d.id} className="p-3 rounded-lg bg-gray-900/30 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">{d.campo}</span>
                    <span className="text-[11px] font-mono text-amber-400">{d.valor}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase">Lead atual</p>
                      <p className="text-[13px] font-medium text-white truncate">{d.lead?.nome || "—"}</p>
                      <p className="text-[11px] text-gray-500">{d.lead?.telefone || d.lead?.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase">Duplicado de</p>
                      <p className="text-[13px] font-medium text-white truncate">{d.duplicado_de_lead?.nome || "—"}</p>
                      <p className="text-[11px] text-gray-500">{d.duplicado_de_lead?.telefone || d.duplicado_de_lead?.email || "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <FormMesclarDuplicado duplicadoId={d.id} leadId={d.lead_id} duplicadoDeId={d.duplicado_de} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DuplicadosPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
