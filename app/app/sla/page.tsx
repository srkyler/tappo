import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerSlaConfig, salvarSlaConfig } from "@/lib/data/crm";

export const metadata = { title: "SLA de Atendimento — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const sla = await lerSlaConfig();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Atendimento" titulo="SLA de resposta" descricao="Tempo máximo aceitável para responder a uma nova conversa no inbox." />

      <section className="painel">
        <div className="px-5 py-3">
          <p className="text-[13px] text-gray-400 mb-4">
            Quando uma conversa fica sem resposta por mais do que o tempo configurado, ela aparece com destaque no inbox e no painel do gestor.
          </p>
          <form action={salvarSlaConfig} className="space-y-3">
            <input type="hidden" name="id" value={sla?.id ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tempo de resposta (minutos)</label>
                <input name="tempo_resposta_min" type="number" min="1" defaultValue={sla?.tempo_resposta_min ?? 15} className="campo w-full" required />
              </div>
              <div>
                <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
                  <input type="checkbox" name="ativo" defaultChecked={sla?.ativo ?? true} className="mt-1" />
                  <span>
                    <span className="block text-[14px] font-medium text-white">SLA ativo</span>
                    <span className="block text-[12.5px] text-gray-500">Quando inativo, não há alertas de tempo de resposta.</span>
                  </span>
                </label>
              </div>
            </div>
            <button className="btn btn-primario w-full">Salvar configuração</button>
          </form>
        </div>
      </section>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Como funciona</h3>
        <ul className="space-y-2 text-[13px] text-gray-400">
          <li>• O SLA é por empresa, aplicável a todos os atendentes.</li>
          <li>• Conversas no canal WhatsApp, Telegram e E-mail contam para o tempo de resposta.</li>
          <li>• O tempo começa a contar quando a primeira mensagem do cliente chega.</li>
          <li>• Quando um atendente responde, o tempo é zerado.</li>
          <li>• No painel do gestor, veja quantas conversas estão acima do SLA (>15 min por padrão).</li>
        </ul>
      </section>
    </div>
  );
}

export default function SlaPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
