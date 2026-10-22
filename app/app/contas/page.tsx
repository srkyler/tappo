import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerContas } from "@/lib/data/crm";
import { FormConta } from "@/components/crm/form-conta";

export const metadata = { title: "Contas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const contas = await lerContas();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Contas" descricao="Empresas e organizações clientes. Vincule pessoas e leads a cada conta." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Contas ({contas.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {contas.length === 0 ? (
              <Vazio titulo="Sem contas" texto="Cadastre a primeira conta pelo formulário ao lado." />
            ) : (
              <div className="space-y-2">
                {contas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{c.nome}</p>
                      <p className="text-[11px] text-gray-500">{c.cnpj_cpf || "—"} · {c.cidade || "—"}</p>
                    </div>
                    <span className="text-[11px] text-gray-600">{c.segmento || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova conta</h3>
          <FormConta />
        </section>
      </div>
    </div>
  );
}

export default function ContasPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
