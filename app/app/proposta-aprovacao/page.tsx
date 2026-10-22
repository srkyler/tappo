import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Aprovação de Proposta — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Propostas" titulo="Aprovação de proposta" descricao="Envie propostas para aprovação do cliente e acompanhe o status." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova proposta</h3>
        <form className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Lead</label>
              <select name="lead_id" className="campo w-full" required>
                <option value="">Selecione um lead</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Template</label>
              <select name="template_id" className="campo w-full">
                <option value="padrao">Padrão comercial</option>
                <option value="premium">Premium</option>
                <option value="simples">Simples</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Valor total</label>
              <input name="valor" type="number" placeholder="0,00" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Validade (dias)</label>
              <input name="validade_dias" type="number" defaultValue="7" className="campo w-full" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Itens da proposta</label>
            <textarea name="itens" rows={4} placeholder="Descreva os produtos/serviços incluídos..." className="campo w-full" required />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3 mt-2">
            <input type="checkbox" name="enviar_whatsapp" defaultChecked className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Enviar por WhatsApp</span>
              <span className="block text-[12.5px] text-gray-500">Enviar proposta por WhatsApp ao salvar.</span>
            </span>
          </label>
          <button className="btn btn-primario w-full">Criar proposta</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Propostas pendentes</h2>
        </div>
        <Vazio titulo="Sem propostas pendentes" texto="Todas as propostas foram aprovadas, rejeitadas ou expiraram." />
      </section>
    </div>
  );
}

export default function PropostaAprovacaoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
