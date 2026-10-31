import { Suspense } from "react";
import { Cabecalho, Pagina, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerPropostas } from "@/lib/data/tags";
import { createClient } from "@/lib/supabase/server";
import { LinhaProposta } from "@/components/propostas/linha-proposta";
import { FormProposta } from "@/components/propostas/form-proposta";
import { formatBRL } from "@/lib/data/format";

export const metadata = { title: "Propostas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const supabase = await createClient();
  const [propostas, { data: leads }] = await Promise.all([
    lerPropostas(),
    supabase.from("leads").select("id, nome, empresa").order("created_at", { ascending: false }).limit(500),
  ]);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const soma = (st: string[]) => propostas.filter((p) => st.includes(p.status)).reduce((a, p) => a + Number(p.valor ?? 0), 0);

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Vendas" titulo="Propostas" descricao="Crie a proposta, gere o link e o cliente aceita ou recusa sem precisar de login. Você é avisado no sino." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[["Em aberto", soma(["enviado", "visualizado"])], ["Aceitas", soma(["aceito"])], ["Recusadas", soma(["rejeitado"])]].map(([r, v]) => (
          <div key={r as string} className="painel p-4"><p className="text-[11px] text-gray-500">{r}</p><p className="text-[18px] font-semibold text-white tabular">{formatBRL(v as number)}</p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Propostas ({propostas.length})</h2>
          </div>
          <div className="space-y-2 px-5 py-3">
            {propostas.length === 0 ? (
              <Vazio titulo="Sem propostas" texto="Crie sua primeira proposta para um lead ou negócio." />
            ) : (
              propostas.map((p) => <LinhaProposta key={p.id} p={p} base={base} />)
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-gray-400">Nova proposta</h3>
          <FormProposta leads={(leads ?? []) as { id: string; nome: string; empresa: string }[]} />
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
