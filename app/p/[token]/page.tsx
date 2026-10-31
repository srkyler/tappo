import { notFound } from "next/navigation";
import { propostaPorToken } from "@/lib/propostas/publica";
import { formatBRL } from "@/lib/data/format";
import { RespostaProposta } from "./resposta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposta", robots: { index: false, follow: false } };

const data = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await propostaPorToken(token, true);
  if (!p) notFound();

  const aberta = ["enviado", "visualizado"].includes(p.status) && !p.expirada;

  return (
    <main className="min-h-screen bg-[#070707] px-4 py-10 text-gray-200">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-[12px] uppercase tracking-wide text-gray-500">{p.empresa || "Proposta comercial"}</p>
          <h1 className="mt-1 text-[26px] font-semibold text-white">{p.titulo}</h1>
          {p.cliente && <p className="mt-1 text-[14px] text-gray-400">Para {p.cliente}</p>}
        </header>

        <section className="painel p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] text-gray-500">Valor</p>
              <p className="text-[30px] font-semibold text-white tabular">{formatBRL(p.valor)}</p>
            </div>
            <div className="text-right text-[12px] text-gray-500">
              <p>Enviada em {data(p.enviado_em)}</p>
              {p.link_expira_em && <p>Válida até {data(p.link_expira_em)}</p>}
            </div>
          </div>
          {p.descricao && <div className="mt-5 whitespace-pre-wrap border-t border-gray-800 pt-5 text-[14px] leading-relaxed text-gray-300">{p.descricao}</div>}
          {p.pdf_url && (
            <a href={p.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secundario mt-5 inline-flex">Abrir PDF da proposta</a>
          )}
        </section>

        {aberta ? (
          <RespostaProposta token={token} />
        ) : (
          <section className="painel p-6 text-[14px]">
            {p.status === "aceito" && <p className="text-emerald-400">Proposta aceita{p.resposta_nome ? ` por ${p.resposta_nome}` : ""} em {data(p.respondido_em)}. Obrigado!</p>}
            {p.status === "rejeitado" && <p className="text-gray-400">Proposta recusada{p.resposta_nome ? ` por ${p.resposta_nome}` : ""} em {data(p.respondido_em)}.</p>}
            {!["aceito", "rejeitado"].includes(p.status) && <p className="text-amber-300">Este link expirou. Peça uma nova proposta a quem enviou.</p>}
          </section>
        )}
        <p className="text-center text-[11px] text-gray-600">Enviado pelo Tappo</p>
      </div>
    </main>
  );
}
