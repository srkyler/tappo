import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { RespostasView, type Template } from "@/components/respostas/respostas-view";
import { bancoPronto, lerLeads, usuarioAtual } from "@/lib/data/queries";

export const metadata = { title: "Respostas rápidas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const [{ data, error }, leads] = await Promise.all([
    supabase.from("templates").select("id, titulo, canal, assunto, corpo, usos").order("usos", { ascending: false }),
    lerLeads(),
  ]);
  if (error) return <AvisoBanco />;
  return (
    <RespostasView
      templates={(data ?? []) as Template[]}
      leads={leads.filter((l) => l.status !== "Perdido").map(({ id, nome, empresa, cargo, email, telefone }) => ({ id, nome, empresa, cargo, email, telefone }))}
    />
  );
}

export default function RespostasPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Produtividade" titulo="Respostas rápidas" descricao="Modelos de mensagem com variáveis. Escolha um lead, copie ou envie direto por e-mail e WhatsApp." />
      <Suspense fallback={<div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="esqueleto h-56" />)}</div>}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
