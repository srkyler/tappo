import { Suspense } from "react";
import { Cabecalho, Pagina, Painel } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Integrações — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const integracao = [
    {
      nome: "Google Calendar",
      tipo: "google_calendar",
      ativo: false,
      descricao: "Sincronize tarefas e compromissos com o Google Calendar.",
      acao: "Conectar",
    },
    {
      nome: "Google Contacts",
      tipo: "google_contacts",
      ativo: false,
      descricao: "Sincronize contatos e leads com o Google Contacts.",
      acao: "Conectar",
    },
    {
      nome: "Zapier",
      tipo: "zapier",
      ativo: false,
      descricao: "Conecte o Tappo a mais de 3.000 apps via Zapier.",
      acao: "Ver webhook",
    },
    {
      nome: "n8n",
      tipo: "n8n",
      ativo: false,
      descricao: "Automatize fluxos com n8n e webhooks personalizados.",
      acao: "Ver webhook",
    },
    {
      nome: "Make",
      tipo: "make",
      ativo: false,
      descricao: "Crie automações visuais com Make (Integromat).",
      acao: "Ver webhook",
    },
  ];

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Integrações" titulo="Conectar ferramentas" descricao="Integre o Tappo com outras ferramentas que você já usa." />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {integracao.map((i) => (
          <section key={i.tipo} className="painel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${i.ativo ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400" : "bg-gray-800 border border-gray-700 text-gray-500"}`}>
                  {i.ativo ? "✓" : "⊕"}
                </span>
                <h3 className="text-[13px] font-medium text-white">{i.nome}</h3>
              </div>
              <span className={`text-[11px] uppercase rounded-full border px-2 py-0.5 ${i.ativo ? "border-emerald-500 text-emerald-400" : "border-gray-700 text-gray-500"}`}>
                {i.ativo ? "Conectado" : "Desconectado"}
              </span>
            </div>
            <p className="text-[12px] text-gray-400 mb-4">{i.descricao}</p>
            <button className="btn btn-primario btn-sm w-full">{i.ativo ? "Gerenciar" : i.acao}</button>
          </section>
        ))}
      </div>

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Webhooks disponíveis</h2>
        </div>
        <div className="px-5 py-3 space-y-3">
          <div className="rounded-lg border border-gray-800 p-3">
            <p className="text-[12px] font-medium text-white">Captação de leads</p>
            <p className="text-[11px] text-gray-500">POST /api/captura/:token</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value="https://seu-dominio.com/api/captura/abc123"
                readOnly
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-400 font-mono"
              />
              <button className="btn btn-secundario btn-sm">Copiar</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function IntegracaoPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
