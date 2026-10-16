import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerTags } from "@/lib/data/tags";
import { salvarTag, excluirTag } from "@/app/app/tags/actions";

export const metadata = { title: "Tags — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const tags = await lerTags();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Tags" descricao="Organize leads por tags. Cada empresa tem suas próprias tags." />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Tags ({tags.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {tags.length === 0 ? (
              <p className="text-[12px] text-gray-500">Nenhuma tag ainda.</p>
            ) : (
              <div className="grid gap-2">
                {tags.map((t) => (
                  <form key={t.id} action={async (f) => { await excluirTag(f.get("id") as string); }} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <span className="flex items-center gap-2 text-[13px] text-white truncate flex-1 pr-2">
                      <span className={`h-3 w-3 rounded-full border border-white/30 shrink-0`} style={{ backgroundColor: t.cor }} />
                      {t.nome}
                    </span>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-[11px] text-red-400 hover:bg-red-500/10 px-2 py-1 rounded">Excluir</button>
                  </form>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova tag</h3>
          <form action={async (f) => { await salvarTag(f); }} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome</label>
              <input name="nome" placeholder="Ex.: VIP, Indicação, Frio" className="campo w-full" required />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Cor</label>
              <input name="cor" type="color" defaultValue="#6B7280" className="campo w-full h-10 p-0 bg-transparent border-0 cursor-pointer" />
            </div>
            <button className="btn btn-primario w-full">Criar tag</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function TagsPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
