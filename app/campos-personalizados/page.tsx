import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerCamposPersonalizados } from "@/lib/data/crm";
import { FormCampoPersonalizado } from "@/components/crm/form-campo-personalizado";

export const metadata = { title: "Campos Personalizados — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const campos = await lerCamposPersonalizados();

  const porTabela = {
    leads: campos.filter((c) => c.tabela === "leads"),
    deals: campos.filter((c) => c.tabela === "deals"),
    contas: campos.filter((c) => c.tabela === "contas"),
  };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Configurações" titulo="Campos personalizados" descricao="Crie campos extras para leads, negócios e contas, adaptando o CRM ao seu segmento." />

      <div className="grid gap-6 sm:grid-cols-3">
        {["leads", "deals", "contas"].map((tabela) => (
          <section key={tabela} className="painel">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
              <h3 className="text-[13px] font-medium text-white">{tabela === "leads" ? "Leads" : tabela === "deals" ? "Negócios" : "Contas"}</h3>
              <span className="text-[11px] font-bold text-gray-500">{porTabela[tabela as keyof typeof porTabela].length}</span>
            </div>
            <div className="px-5 py-3 space-y-2">
              {porTabela[tabela as keyof typeof porTabela].length === 0 ? (
                <p className="text-[12px] text-gray-500">Sem campos personalizados.</p>
              ) : (
                <div className="space-y-2">
                  {porTabela[tabela as keyof typeof porTabela].map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                      <span className="text-[12px] text-white truncate flex-1 pr-2">{c.nome}</span>
                      <span className="text-[10px] text-gray-600 uppercase">{c.tipo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Novo campo personalizado</h3>
        <FormCampoPersonalizado />
      </section>
    </div>
  );
}

export default function CamposPersonalizadosPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
