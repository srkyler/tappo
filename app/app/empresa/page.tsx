import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { EmpresaView, type Convite } from "@/components/empresa/empresa-view";
import { empresaAtual, membrosDaEmpresa, minhasEmpresas } from "@/lib/data/empresa";
import { usuarioAtual } from "@/lib/data/queries";
import { ehGestor } from "@/lib/segmentos";

export const metadata = { title: "Empresa e equipe — Tappo" };

async function Conteudo() {
  const empresa = await empresaAtual();
  if (!empresa) return <AvisoBanco />;
  const { supabase, user } = await usuarioAtual();
  const [membros, empresas, convites] = await Promise.all([
    membrosDaEmpresa(),
    minhasEmpresas(),
    ehGestor(empresa.papel)
      ? supabase.from("org_convites").select("id, email, papel, expira_em, aceito_em").is("aceito_em", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  return <EmpresaView empresa={empresa} membros={membros} empresas={empresas} convites={(convites.data ?? []) as Convite[]} meuId={user!.id} />;
}

export default function EmpresaPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Configurações" titulo="Empresa e equipe" descricao="Segmento, funil, pessoas e permissões. Cada empresa tem seus próprios dados." />
      <Suspense fallback={<div className="esqueleto h-[60vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
