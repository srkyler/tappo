import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { EmpresaView, type Convite } from "@/components/empresa/empresa-view";
import { empresaAtual, membrosDaEmpresa, minhasEmpresas } from "@/lib/data/empresa";
import { usuarioAtual } from "@/lib/data/queries";
import { ehGestor } from "@/lib/segmentos";
import { permissoesDaEmpresa } from "@/lib/data/permissoes";
import { PermissoesTelas } from "@/components/empresa/permissoes-telas";

export const metadata = { title: "Empresa e equipe — Tappo" };

async function Conteudo() {
  const empresa = await empresaAtual();
  if (!empresa) return <AvisoBanco />;
  const { supabase, user } = await usuarioAtual();
  const gestor = ehGestor(empresa.papel);
  const [membros, empresas, convites, permissoes] = await Promise.all([
    membrosDaEmpresa(),
    minhasEmpresas(),
    ehGestor(empresa.papel)
      ? supabase.from("org_convites").select("id, email, papel, expira_em, aceito_em").is("aceito_em", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    gestor ? permissoesDaEmpresa(empresa.id) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      <EmpresaView empresa={empresa} membros={membros} empresas={empresas} convites={(convites.data ?? []) as Convite[]} meuId={user!.id} />
      {gestor && <PermissoesTelas inicial={permissoes} />}
    </div>
  );
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
