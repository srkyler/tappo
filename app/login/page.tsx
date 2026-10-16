import { Suspense } from "react";
import { AuthShell, BotaoGoogle, Divisor, LinkRodape } from "@/components/auth/auth-ui";
import { FormLogin } from "@/components/auth/forms";

export const metadata = { title: "Entrar — Tappo" };

const ERROS: Record<string, string> = {
  google: "Não foi possível conectar com o Google. Tente novamente.",
  callback: "O login não foi concluído. Tente novamente.",
  link: "Link inválido ou expirado. Peça um novo.",
};

type Params = Promise<{ next?: string; erro?: string }>;

async function Conteudo({ searchParams }: { searchParams: Params }) {
  const { next = "/app", erro } = await searchParams;
  return (
    <>
      <BotaoGoogle next={next} />
      <Divisor />
      <FormLogin next={next} erroInicial={erro ? ERROS[erro] : undefined} />
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Params }) {
  return (
    <AuthShell
      rotulo="Entrar"
      rodape={<LinkRodape pergunta="Não tem conta?" href="/signup" texto="Criar conta grátis" />}
    >
      <Suspense fallback={<div className="h-[330px]" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
