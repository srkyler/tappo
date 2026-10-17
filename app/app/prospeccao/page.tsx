import { Cabecalho, Pagina } from "@/components/ui/base";
import { BuscaMaps } from "@/components/prospeccao/busca-maps";

export const metadata = { title: "Prospecção — Tappo" };

export default function ProspeccaoPage() {
  return (
    <Pagina>
      <Cabecalho
        rotulo="Vendas"
        titulo="Prospecção"
        descricao="Busque empresas pelo Google Maps (API oficial, sem risco de banimento) e importe direto como leads."
      />
      <BuscaMaps />
    </Pagina>
  );
}
