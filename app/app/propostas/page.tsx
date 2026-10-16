import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerPropostas } from "@/lib/data/tags";
import { salvarProposta, excluirProposta, enviarProposta } from "@/app/app/propostas/actions";
import { formatBRL } from "@/lib/data/format";

export const metadata = { title: "Propostas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const propostas = await lerPropostas();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Vendas" titulo="Propostas" descricao="Crie e acompanhe orçamentos e propostas comerciais." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Propostas ({propostas.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {propostas.length === 0 ? (
              <Vazio titulo="Sem propostas" texto="Crie sua primeira proposta para um lead ou negócio." />
            ) : (
              <div className="space-y-2">
                {propostas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{p.titulo}</p>
                      <p className="text-[11px] text-gray-500">{formatBRL(p.valor)} · {p.status}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <form action={async (f) => { await enviarProposta(f.get("id") as string); }} className="flex" style={{ display: "contents" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button disabled={p.status !== "rascunho"} className={`text-[10px] px-2 py-1 rounded ${p.status === "rascunho" ? "text-emerald-400 hover:bg-emerald-500/10" : "text-gray-600"}`} title="Enviar">Enviar</button>
                      </form>
                      <form action={async (f) => { await excluirProposta(f.get("id") as string); }} className="flex" style={{ display: "contents" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-[10px] text-red-400 hover:bg-red-500/10 px-2 py-1 rounded" title="Excluir">Excluir</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova proposta</h3>
          <form action={async (f) => { await salvarProposta(f); }} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
              <input name="titulo" placeholder="Ex.: Proposta comercial" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Valor (R$)</label>
              <input name="valor" type="number" step="0.01" min="0" placeholder="0,00" className="campo w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Status</label>
              <select name="status" className="campo w-full">
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="visualizado">Visualizado</option>
                <option value="aceito">Aceito</option>
                <option value="rejeitado">Rejeitado</option>
                <option value="expirado">Expirado</option>
              </select>
            </div>
            <button className="btn btn-primario w-full">Criar proposta</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function PropostasPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
