import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Enriquecimento — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const exemplos = [
    {
      lead: "João Silva",
      empresa: "Tech Solutions LTDA",
      cnpj: "12.345.678/0001-90",
      razao: "Tech Solutions Serviços de TI LTDA",
      cnae: "62.01-5-01 - Desenvolvimento de programas de computador sob encomenda",
      porte: "Pequena empresa",
      capital: "R$ 100.000,00",
      cidade: "São Paulo - SP",
      fonte: "Receita Federal",
      status: "enriquecido",
    },
    {
      lead: "Maria Oliveira",
      empresa: "Clínica Bem Estar",
      cnpj: "98.765.432/0001-10",
      razao: "Clínica Bem Estar Médica LTDA",
      cnae: "86.10-1-01 - Atividades hospitalares",
      porte: "Microempresa",
      capital: "R$ 50.000,00",
      cidade: "Rio de Janeiro - RJ",
      fonte: "Receita Federal",
      status: "enriquecido",
    },
    {
      lead: "Carlos Santos",
      empresa: "Importados XYZ",
      cnpj: "11.222.333/0001-44",
      razao: "Importados XYZ Comércio Ltda",
      cnae: "47.91-9-01 - Comércio varejista de qualquer tipo de produto pela Internet",
      porte: "Pequena empresa",
      capital: "R$ 200.000,00",
      cidade: "Belo Horizonte - MG",
      fonte: "Receita Federal",
      status: "pendente",
    },
  ];

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Enriquecimento automático" descricao="Complete automaticamente dados de CNPJ/CPF, endereço, CNAE, porte e capital social dos seus leads." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Leads enriquecidos</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {exemplos.map((e) => (
              <div key={e.cnpj} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30 border border-gray-800/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{e.lead}</p>
                  <p className="text-[11px] text-gray-500">{e.empresa} · {e.cnpj}</p>
                  <p className="text-[11px] text-gray-600">{e.cidade}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Status valor={e.status} />
                  <button className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">Ver detalhes</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Enriquecer lead</h3>
          <form className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">CNPJ / CPF</label>
              <input name="cnpj" placeholder="00.000.000/0001-00" className="campo w-full" required />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primario btn-sm flex-1">Buscar dados</button>
              <button className="btn btn-secundario btn-sm">Usar IA</button>
            </div>
            <div className="rounded-lg border border-gray-800 p-3 mt-4">
              <p className="text-[11px] font-medium text-white mb-2">Dados encontrados:</p>
              <div className="space-y-1 text-[12px] text-gray-400">
                <div className="flex justify-between">
                  <span>Razão social:</span>
                  <span className="text-white">Tech Solutions Serviços de TI LTDA</span>
                </div>
                <div className="flex justify-between">
                  <span>CNAE:</span>
                  <span className="text-white">62.01-5-01</span>
                </div>
                <div className="flex justify-between">
                  <span>Porte:</span>
                  <span className="text-white">Pequena empresa</span>
                </div>
                <div className="flex justify-between">
                  <span>Capital social:</span>
                  <span className="text-white">R$ 100.000,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Município:</span>
                  <span className="text-white">São Paulo - SP</span>
                </div>
              </div>
              <button className="mt-3 btn btn-primario btn-sm w-full">Aplicar ao lead</button>
            </div>
          </form>
        </section>
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">O que é enriquecido automaticamente</h2>
        </div>
        <div className="grid gap-4 px-5 py-3">
          <div className="rounded-lg border border-gray-800 p-4">
            <h4 className="text-[12px] font-bold text-white mb-2">🏢 Dados da empresa</h4>
            <ul className="space-y-1 text-[12px] text-gray-400">
              <li>Razão social e nome fantasia</li>
              <li>CNAE e descrição da atividade</li>
              <li>Porte e capital social</li>
              <li>Data de abertura</li>
              <li>Situação cadastral</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-800 p-4">
            <h4 className="text-[12px] font-bold text-white mb-2">📍 Endereço</h4>
            <ul className="space-y-1 text-[12px] text-gray-400">
              <li>CEP, logradouro e número</li>
              <li>Bairro, município e UF</li>
              <li>Telefone e e-mail cadastrados</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-800 p-4">
            <h4 className="text-[12px] font-bold text-white mb-2">🔗 Fontes</h2>
            <ul className="space-y-1 text-[12px] text-gray-400">
              <li>Receita Federal (CNPJ)</li>
              <li>Sintegra (IE)</li>
              <li>LinkedIn (opcional)</li>
              <li>Google Maps (opcional)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function EnriquecimentoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
