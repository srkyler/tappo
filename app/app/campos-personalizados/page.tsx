import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerCamposPersonalizados, salvarCampoPersonalizado } from "@/lib/data/crm";

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
        <form action={salvarCampoPersonalizado} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tabela</label>
            <select name="tabela" className="campo w-full">
              <option value="leads">Leads</option>
              <option value="deals">Negócios</option>
              <option value="contas">Contas</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome do campo</label>
            <input name="nome" placeholder="Ex.: Convênio, Cor do imóvel, Nível do curso" className="campo w-full" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tipo</label>
              <select name="tipo" className="campo w-full">
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="data">Data</option>
                <option value="selecao">Seleção (lista)</option>
                <option value="booleano">Sim/Não</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Obrigatório</label>
              <input type="checkbox" name="obrigatorio" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Opções (para seleção, JSON ou lista separada por vírgula)</label>
            <textarea name="opcoes" rows={2} placeholder='["Opção A", "Opção B"] ou Opção A, Opção B' className="campo w-full" />
          </div>
          <button className="btn btn-primario w-full">Criar campo</button>
        </form>
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
