import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Cadência Multi-canal — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Prospecção" titulo="Cadência multi-canal" descricao="Configure sequências de WhatsApp, e-mail e ligação para automatizar o follow-up." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Cadências ativas</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            <div className="rounded-lg border border-gray-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-white">Seguimento comercial</span>
                <span className="text-[11px] text-emerald-400">Ativa</span>
              </div>
              <div className="flex gap-1 mb-2">
                <span className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">WhatsApp dia 1</span>
                <span className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">E-mail dia 3</span>
                <span className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Ligação dia 5</span>
                <span className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">WhatsApp dia 7</span>
              </div>
              <p className="text-[11px] text-gray-500">12 leads na fila · 3 respondidos</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primario btn-sm flex-1">Editar</button>
                <button className="btn btn-secundario btn-sm">Pausar</button>
              </div>
            </div>
          </div>
          <button className="mt-3 btn btn-fantasma btn-sm w-full flex items-center justify-center gap-1">
            <span>+</span> Nova cadência
          </button>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Configurar nova cadência</h3>
          <form className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome da cadência</label>
              <input name="nome" placeholder="Ex.: Seguimento pós-feira" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Segmento de leads</label>
              <select name="segmento" className="campo w-full">
                <option value="todos">Todos os segmentos</option>
                <option value="vendas">Vendas</option>
                <option value="marketing">Marketing</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="saude">Saúde</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Etapas da cadência</label>
              <div className="space-y-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900 border border-gray-800">
                  <span className="text-[11px] text-gray-400">Etapa 1</span>
                  <select className="campo text-[11px] bg-transparent border-none focus:ring-0">
                    <option>WhatsApp</option>
                    <option>E-mail</option>
                    <option>Ligação</option>
                  </select>
                  <input type="number" placeholder="Dia 1" className="w-16 campo text-[11px] bg-transparent border-none focus:ring-0" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900 border border-gray-800">
                  <span className="text-[11px] text-gray-400">Etapa 2</span>
                  <select className="campo text-[11px] bg-transparent border-none focus:ring-0">
                    <option>WhatsApp</option>
                    <option>E-mail</option>
                    <option>Ligação</option>
                  </select>
                  <input type="number" placeholder="Dia 3" className="w-16 campo text-[11px] bg-transparent border-none focus:ring-0" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900 border border-gray-800">
                  <span className="text-[11px] text-gray-400">Etapa 3</span>
                  <select className="campo text-[11px] bg-transparent border-none focus:ring-0">
                    <option>WhatsApp</option>
                    <option>E-mail</option>
                    <option>Ligação</option>
                  </select>
                  <input type="number" placeholder="Dia 5" className="w-16 campo text-[11px] bg-transparent border-none focus:ring-0" />
                </div>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3 mt-2">
              <input type="checkbox" name="pausar_se_responder" defaultChecked className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">Pausar se o lead responder</span>
                <span className="block text-[12.5px] text-gray-500">Não envia mais mensagens após resposta.</span>
              </span>
            </label>
            <button className="btn btn-primario w-full">Salvar cadência</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function CadenciaPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}