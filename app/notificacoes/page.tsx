import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Notificações — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Sistema" titulo="Notificações" descricao="Gerencie notificações push, e-mail e WhatsApp para leads e equipe." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Configurar notificações</h3>
        <form className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="novo_lead" defaultChecked className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Novo lead capturado</span>
              <span className="block text-[12.5px] text-gray-500">Notificar o responsável quando um lead é criado.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="tarefa_vencendo" defaultChecked className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Tarefa vencendo</span>
              <span className="block text-[12.5px] text-gray-500">Alerta 30 minutos antes do vencimento.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="proposta_visualizada" className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Proposta visualizada</span>
              <span className="block text-[12.5px] text-gray-500">Notificar quando o cliente abrir a proposta.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="sla_estouro" defaultChecked className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">SLA estouro</span>
              <span className="block text-[12.5px] text-gray-500">Alerta quando o prazo de resposta estiver prestes a expirar.</span>
            </span>
          </label>
          <button className="btn btn-primario w-full">Salvar configurações</button>
        </form>
      </section>
    </div>
  );
}

export default function NotificacoesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}