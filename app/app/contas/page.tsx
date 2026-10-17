import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerContas, salvarConta } from "@/lib/data/crm";

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
              <Vazio titulo="Sem contas" texto="Cadastre sua primeira conta empresa." acao={<button onClick={() => {}} className="btn btn-primario btn-sm">Nova conta</button>} />
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
          <form action={salvarConta} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome da empresa</label>
              <input name="nome" placeholder="Ex.: Clínica Sorriso" className="campo w-full" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">CNPJ / CPF</label>
                <input name="cnpj_cpf" placeholder="00.000.000/0001-00" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Segmento</label>
                <input name="segmento" placeholder="Odontologia, Imobiliária…" className="campo w-full" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Telefone</label>
                <input name="telefone" placeholder="(11) 99999-8888" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">E-mail</label>
                <input name="email" type="email" placeholder="contato@empresa.com" className="campo w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Endereço</label>
              <input name="endereco" placeholder="Rua, número, bairro" className="campo w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Cidade</label>
                <input name="cidade" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Estado</label>
                <input name="estado" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">CEP</label>
                <input name="cep" className="campo w-full" />
              </div>
            </div>
            <button className="btn btn-primario w-full">Salvar conta</button>
          </form>
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
