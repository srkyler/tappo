import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto, lerPromocoes } from "@/lib/data/queries";
import { empresaAtual } from "@/lib/data/empresa";
import { sugestoesPorSegmento } from "@/lib/marketing/sugestoes-promocao";
import { FormPromocao } from "@/components/marketing/form-promocao";
import { ListaPromocoes } from "@/components/marketing/lista-promocoes";

export const metadata = { title: "Calendário de Marketing — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const [promocoes, empresa] = await Promise.all([lerPromocoes(), empresaAtual()]);
  const sugestoes = sugestoesPorSegmento(empresa?.segmento ?? "geral");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="painel">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Promoções ({promocoes.length})</h2>
        </div>
        <div className="px-5 py-3">
          {promocoes.length === 0 ? (
            <Vazio titulo="Nenhuma promoção ainda" texto="Crie a primeira pelo formulário ao lado — temos sugestões prontas pro seu segmento." />
          ) : (
            <ListaPromocoes promocoes={promocoes} />
          )}
        </div>
      </section>
      <section className="painel p-5">
        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-gray-400">Nova promoção</h3>
        <FormPromocao sugestoes={sugestoes} />
      </section>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Pagina className="max-w-none">
      <Cabecalho rotulo="Vendas" titulo="Calendário de Marketing" descricao="Planeje promoções e ofertas — com sugestões prontas pro seu segmento de negócio." />
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
