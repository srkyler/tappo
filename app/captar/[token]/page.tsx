import { Suspense } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { bancoPronto, usuarioAtual } from "@/lib/data/queries";

async function Conteudo({ params }: { params: Promise<{ token: string }> }) {
  if (!(await bancoPronto())) {
    return (
      <Pagina>
        <div className="painel p-10 text-center">
          <h1 className="text-[24px] font-bold text-white mb-4">Tappo — Captação de Leads</h1>
          <p className="text-[14px] text-gray-400">Banco de dados não configurado. Aplique a migração no Supabase.</p>
        </div>
      </Pagina>
    );
  }
  const { supabase } = await usuarioAtual();
  const { token } = await params;

  const [{ data: fonte }] = await Promise.all([
    supabase.from("lead_sources").select("*, organizacoes(nome)").eq("token", token).eq("ativo", true).maybeSingle(),
  ]);

  if (!fonte) {
    return (
      <Pagina>
        <div className="painel p-10 text-center">
          <h1 className="text-[24px] font-bold text-white mb-4">Página não encontrada</h1>
          <p className="text-[14px] text-gray-400">Esta página de captação não existe ou está inativa.</p>
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho rotulo="Captação" titulo={fonte.nome} descricao="Preencha seus dados e entraremos em contato em breve." />
      <div className="painel p-8 max-w-md mx-auto">
        <form className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Seu nome</label>
            <input name="nome" placeholder="Nome completo" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">E-mail</label>
            <input name="email" type="email" placeholder="seu@empresa.com" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Telefone</label>
            <input name="telefone" type="tel" placeholder="(11) 99999-8888" className="campo w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Empresa</label>
            <input name="empresa" placeholder="Nome da empresa" className="campo w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Mensagem</label>
            <textarea name="mensagem" rows={3} placeholder="Como podemos ajudar?" className="campo w-full" />
          </div>
          <button className="btn btn-primario w-full">Enviar</button>
        </form>
      </div>
    </Pagina>
  );
}

export default async function CaptarPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo params={params} />
      </Suspense>
    </Pagina>
  );
}
