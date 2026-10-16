"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrar, cadastrar, recuperarSenha, redefinirSenha } from "@/app/auth/actions";
import { Aviso, BotaoEnviar, Campo } from "./auth-ui";

const linkMini = "text-[12px] text-gray-400 hover:text-white hover:underline underline-offset-4";

export function FormLogin({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const [estado, acao] = useActionState(entrar, erroInicial ? { erro: erroInicial } : undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Campo label="E-mail" name="email" type="email" autoComplete="email" placeholder="seu@empresa.com.br" />
      <Campo
        label="Senha" name="senha" type="password" autoComplete="current-password" placeholder="••••••••"
        extra={<Link href="/recuperar-senha" className={linkMini}>Esqueci a senha</Link>}
      />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar texto="Entrar" carregando="Entrando…" />
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao] = useActionState(cadastrar, undefined);
  if (estado?.ok) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Aviso tipo="ok">Enviamos um link de confirmação para {estado.ok}.</Aviso>
        <p className="text-[14px] leading-[1.6] text-gray-400">
          Abra seu e-mail e clique em <strong>Confirmar e-mail</strong> para ativar a conta. Confira também o spam.
        </p>
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-col gap-5">
      <Campo label="Seu nome" name="nome" autoComplete="name" placeholder="Nome completo" />
      <Campo label="Empresa" name="empresa" autoComplete="organization" placeholder="Nome da empresa" required={false} />
      <Campo label="E-mail" name="email" type="email" autoComplete="email" placeholder="seu@empresa.com.br" />
      <Campo label="Senha" name="senha" type="password" autoComplete="new-password" minLength={8} placeholder="mínimo 8 caracteres" />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar texto="Criar conta" carregando="Criando conta…" />
    </form>
  );
}

export function FormRecuperar() {
  const [estado, acao] = useActionState(recuperarSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <Campo label="E-mail da conta" name="email" type="email" autoComplete="email" placeholder="seu@empresa.com.br" />
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <BotaoEnviar texto="Enviar link" carregando="Enviando..." />
    </form>
  );
}

export function FormRedefinir() {
  const [estado, acao] = useActionState(redefinirSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <Campo label="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={8} placeholder="mínimo 8 caracteres" />
      <Campo label="Confirmar senha" name="confirmar" type="password" autoComplete="new-password" minLength={8} placeholder="repita a senha" />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar texto="Salvar nova senha" carregando="Salvando..." />
    </form>
  );
}
