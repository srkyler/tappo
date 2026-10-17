import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";
import { lerPessoas, salvarPessoa } from "@/lib/data/crm";

export const metadata = { title: "Pessoas — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const pessoas = await lerPessoas();

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Contatos" titulo="Pessoas" descricao="Contatos individuais vinculados a contas. Decisores, influenciadores e usuários finais." />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <section className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">Pessoas ({pessoas.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {pessoas.length === 0 ? (
              <Vazio titulo="Sem pessoas" texto="Cadastre seu primeiro contato." />
            ) : (
              <div className="space-y-2">
                {pessoas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">{p.nome}</p>
                      <p className="text-[11px] text-gray-500">{p.cargo || "—"} · {p.conta?.nome || "Sem conta"}</p>
                    </div>
                    <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${p.lider_decision ? "text-emerald-400 border-emerald-500/30" : "text-gray-600 border-gray-800"}`}>
                      {p.lider_decision ? "Decisor" : "Contato"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="painel p-5">
          <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide mb-3">Nova pessoa</h3>
          <form action={salvarPessoa} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Nome</label>
              <input name="nome" placeholder="Ex.: Maria Silva" className="campo w-full" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Conta (empresa)</label>
                <input name="conta_id" placeholder="ID da conta (opcional)" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Cargo</label>
                <input name="cargo" placeholder="Ex.: Gerente, Dentista" className="campo w-full" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Telefone</label>
                <input name="telefone" placeholder="(11) 99999-8888" className="campo w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-gray-300">WhatsApp</label>
                <input name="telefone_whatsapp" placeholder="(11) 99999-8888" className="campo w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-gray-300">E-mail</label>
              <input name="email" type="email" placeholder="maria@empresa.com" className="campo w-full" />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="lider_decision" className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">É decisor / tomador de decisão</span>
                <span className="block text-[12.5px] text-gray-500">Marca esta pessoa como quem decide a compra na conta.</span>
              </span>
            </label>
            <button className="btn btn-primario w-full">Salvar pessoa</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function PessoasPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
