"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { entrar, cadastrar, recuperarSenha, redefinirSenha, reenviarConfirmacao } from "@/app/auth/actions";
import { Aviso, BotaoEnviar, Campo } from "./auth-ui";
import { SEGMENTOS } from "@/lib/segmentos";

const linkMini = "text-[12px] text-gray-400 hover:text-white hover:underline underline-offset-4";

function ReenviarConfirmacao({ pegarEmail }: { pegarEmail: () => string | undefined | null }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const email = (pegarEmail() ?? "").trim();
            if (!email) {
              setMsg({ tipo: "erro", texto: "Informe o e-mail acima." });
              return;
            }
            const r = await reenviarConfirmacao(email);
            setMsg(r.ok ? { tipo: "ok", texto: r.ok } : { tipo: "erro", texto: r.erro ?? "Não foi possível reenviar." });
          })
        }
        className="btn btn-secundario btn-lg w-full"
      >
        {pendente ? "Enviando…" : "Reenviar e-mail de confirmação"}
      </button>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}

export function FormLogin({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const [estado, acao] = useActionState(entrar, erroInicial ? { erro: erroInicial } : undefined);
  const emailNaoConfirmado = estado?.erro?.startsWith("Confirme seu e-mail");
  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Campo label="E-mail" name="email" type="email" autoComplete="email" placeholder="seu@empresa.com.br" />
      <Campo
        label="Senha" name="senha" type="password" autoComplete="current-password" placeholder="••••••••"
        extra={<Link href="/recuperar-senha" className={linkMini}>Esqueci a senha</Link>}
      />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {emailNaoConfirmado && (
        <ReenviarConfirmacao pegarEmail={() => (document.getElementById("email") as HTMLInputElement | null)?.value} />
      )}
      <BotaoEnviar texto="Entrar" carregando="Entrando…" />
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao] = useActionState(cadastrar, undefined);
  if (estado?.ok) {
    return (
      <div className="flex flex-col gap-4 text-center">
        {estado.aviso ? (
          <Aviso tipo="erro">{estado.aviso}</Aviso>
        ) : (
          <Aviso tipo="ok">Enviamos um link de confirmação para {estado.ok}.</Aviso>
        )}
        <p className="text-[14px] leading-[1.6] text-gray-400">
          Abra seu e-mail e clique em <strong>Confirmar e-mail</strong> para ativar a conta. Confira também o spam.
        </p>
        <ReenviarConfirmacao pegarEmail={() => estado.ok} />
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-col gap-5">
      <Campo label="Seu nome" name="nome" autoComplete="name" placeholder="Nome completo" />
      <Campo label="Empresa" name="empresa" autoComplete="organization" placeholder="Nome da empresa" required={false} />
      <div>
        <label htmlFor="cad-seg" className="mb-1.5 block text-[12px] font-medium text-gray-300">Segmento</label>
        <select id="cad-seg" name="segmento" defaultValue="geral" className="campo w-full">
          {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
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
