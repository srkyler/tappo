import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Boas-vindas E-mail — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Marketing" titulo="Boas-vindas por e-mail" descricao="Configure mensagens de boas-vindas automáticas para novos leads capturados." />

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Configurar boas-vindas automáticas</h3>
        <form className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="ativado" defaultChecked className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Ativar e-mail de boas-vindas</span>
              <span className="block text-[12.5px] text-gray-500">Enviado automaticamente quando um novo lead é criado.</span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Assunto</label>
              <input name="assunto" defaultValue="Bem-vindo à {{empresa}}" className="campo w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Remetente</label>
              <input name="remetente" defaultValue="contato@suaempresa.com.br" className="campo w-full" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Corpo do e-mail (HTML ou texto)</label>
            <textarea name="corpo" rows={8} defaultValue="<h2>Olá {{nome}}!</h2><p>Bem-vindo à {{empresa}}. Obrigado por se cadastrar, entraremos em contato em breve.</p>" className="campo w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Enviar após (minutos)</label>
              <input name="delay" type="number" defaultValue="5" className="campo w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Canal</label>
              <select name="canal" className="campo w-full">
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primario w-full">Salvar configuração</button>
        </form>
      </section>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Envios recentes</h2>
        </div>
        <Vazio titulo="Sem envios recentes" texto="Os e-mails de boas-vindas aparecerão aqui quando forem enviados." />
      </section>
    </div>
  );
}

export default function BoasVindasEmailPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
