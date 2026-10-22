import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerContas, lerPessoas } from "@/lib/data/crm";
import { FormPessoa } from "@/components/crm/form-pessoa";

export const metadata = { title: "Pessoas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [pessoas, contas] = await Promise.all([lerPessoas(), lerContas()]);

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Pessoas" descricao="Contatos individuais vinculados a contas. Decisores, influenciadores e usuários finais." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Pessoas ({pessoas.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {pessoas.length === 0 ? (
              <Vazio titulo="Sem pessoas" texto="Cadastre o primeiro contato pelo formulário ao lado." />
            ) : (
              <div className="space-y-2">
                {pessoas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{p.nome}</p>
                      <p className="text-[11px] text-gray-500">{p.cargo || "—"} · {p.conta?.nome || "Sem conta"}</p>
                    </div>
                    <span className={`text-[11px] font-bold rounded-full border px-2 py-0.5 ${p.lider_decisao ? "text-emerald-400 border-emerald-500/30" : "text-gray-600 border-gray-800"}`}>
                      {p.lider_decisao ? "Decisor" : "Contato"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova pessoa</h3>
          <FormPessoa contas={contas} />
        </section>
      </div>
    </div>
  );
}

export default function PessoasPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
