import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Templates WhatsApp — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const templates = [
    { id: "1", nome: "Boas-vindas", categoria: "marketing", idioma: "pt_BR", status: "aprovado", texto: "Olá {{nome}}! Bem-vindo à {{empresa}}. Como podemos ajudar?" },
    { id: "2", nome: "Follow-up proposta", categoria: "vendas", idioma: "pt_BR", status: "aprovado", texto: "Oi {{nome}}, passando para saber se teve tempo de ver a proposta..." },
    { id: "3", nome: "Lembrete pagamento", categoria: "financeiro", idioma: "pt_BR", status: "pendente", texto: "Oi {{nome}}, sua fatura de {{valor}} vence em {{data}}." },
  ];

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="WhatsApp" titulo="Templates aprovados" descricao="Gerencie templates aprovados pelo WhatsApp Business para uso fora do horário ou em massa." />

      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Templates ({templates.length})</h2>
        </div>
        <div className="px-5 py-3 space-y-2">
          {templates.length === 0 ? (
            <Vazio titulo="Sem templates" texto="Nenhum template aprovado ainda." />
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30 border border-gray-800">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className={`h-2 w-2 rounded-full ${t.status === "aprovado" ? "bg-emerald-400" : t.status === "pendente" ? "bg-amber-400" : "bg-red-400"}`} />
                    <span className="font-medium text-white">{t.nome}</span>
                    <span className="text-[11px] text-gray-500">{t.categoria}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] rounded-full border px-1.5 py-0.5 ${t.status === "aprovado" ? "border-emerald-500 text-emerald-400" : t.status === "pendente" ? "border-amber-500 text-amber-400" : "border-red-500 text-red-400"}`}>
                      {t.status}
                    </span>
                    <button className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="painel p-5">
        <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Novo template</h3>
        <form className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome</label>
              <input name="nome" placeholder="Ex.: Boas-vindas" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Categoria</label>
              <select name="categoria" className="campo w-full">
                <option value="marketing">Marketing</option>
                <option value="vendas">Vendas</option>
                <option value="financeiro">Financeiro</option>
                <option value="suporte">Suporte</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Idioma</label>
              <select name="idioma" className="campo w-full">
                <option value="pt_BR">Português (Brasil)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Texto do template</label>
            <textarea name="texto" rows={4} placeholder="Use variáveis como {{nome}}, {{empresa}}, {{valor}}..." className="campo w-full" required />
          </div>
          <button className="btn btn-primario w-full">Salvar template</button>
        </form>
      </section>
    </div>
  );
}

export default function TemplatesWhatsAppPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
