import { Suspense } from "react";
import { Cabecalho, Pagina, Painel } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { FormPerfil, FormSenha } from "@/components/perfil/perfil-forms";
import { SeletorAvatar } from "@/components/perfil/seletor-avatar";
import { SeletorCor } from "@/components/perfil/seletor-cor";
import { bancoPronto, lerPerfil } from "@/lib/data/queries";

export const metadata = { title: "Conta — Tappo" };

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;
  const perfil = await lerPerfil();
  if (!perfil) return null;
  return (
    <div className="grid max-w-3xl gap-4">
      <Painel titulo="Aparência" corpo="p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <SeletorAvatar iconeAtual={perfil.avatar_icone} />
          <SeletorCor corAtual={perfil.cor_destaque} />
        </div>
      </Painel>
      <Painel titulo="Perfil" corpo="p-5 sm:p-6"><FormPerfil perfil={perfil} email={perfil.email} /></Painel>
      <Painel titulo="Segurança" corpo="p-5 sm:p-6">
        <p className="mb-4 text-[13px] text-gray-500">Entrou com Google? Definir uma senha permite também entrar com e-mail.</p>
        <FormSenha />
      </Painel>
    </div>
  );
}

export default function PerfilPage() {
  return (
    <Pagina>
      <Cabecalho rotulo="Configurações" titulo="Conta" />
      <Suspense fallback={<div className="esqueleto h-96 max-w-3xl" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
