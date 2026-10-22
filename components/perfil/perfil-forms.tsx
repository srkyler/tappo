"use client";

import { useState, useTransition } from "react";
import { Rotulo } from "@/components/ui/base";
import { salvarPerfil, trocarSenha } from "@/app/app/actions";
import type { Profile } from "@/lib/data/types";

function Mensagem({ m }: { m: { ok: boolean; t: string } | null }) {
  if (!m) return null;
  return <p role={m.ok ? "status" : "alert"} className="text-[13px] text-white">{m.ok ? "✓" : "⚠"} {m.t}</p>;
}

export function FormPerfil({ perfil, email }: { perfil: Profile; email: string | null }) {
  const [m, setM] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarPerfil(fd);
        setM(r.ok ? { ok: true, t: "Perfil atualizado." } : { ok: false, t: r.erro });
      })}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2"><Rotulo htmlFor="nome_completo">Nome completo</Rotulo><input id="nome_completo" name="nome_completo" defaultValue={perfil.nome_completo ?? ""} className="campo" autoComplete="name" /></div>
      <div className="sm:col-span-2">
        <Rotulo htmlFor="email-ro">E-mail</Rotulo>
        <input id="email-ro" value={email ?? ""} readOnly disabled className="campo" />
      </div>
      <div><Rotulo htmlFor="empresa">Empresa</Rotulo><input id="empresa" name="empresa" defaultValue={perfil.empresa ?? ""} className="campo" autoComplete="organization" /></div>
      <div><Rotulo htmlFor="cargo">Cargo</Rotulo><input id="cargo" name="cargo" defaultValue={perfil.cargo ?? ""} className="campo" autoComplete="organization-title" /></div>
      <div><Rotulo htmlFor="telefone">Telefone</Rotulo><input id="telefone" name="telefone" type="tel" defaultValue={perfil.telefone ?? ""} className="campo" autoComplete="tel" /></div>
      <div><Rotulo htmlFor="meta">Meta de reuniões por semana</Rotulo><input id="meta" name="meta_reunioes_semana" type="number" min={0} max={200} defaultValue={perfil.meta_reunioes_semana} className="campo tabular" /></div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <Mensagem m={m} />
        <button disabled={pendente} className="btn btn-primario btn-sm ml-auto">{pendente ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </form>
  );
}

export function FormSenha() {
  const [m, setM] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await trocarSenha(fd);
        setM(r.ok ? { ok: true, t: "Senha alterada." } : { ok: false, t: r.erro });
      })}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div><Rotulo htmlFor="senha">Nova senha</Rotulo><input id="senha" name="senha" type="password" minLength={8} required className="campo" autoComplete="new-password" /></div>
      <div><Rotulo htmlFor="confirmar">Confirmar</Rotulo><input id="confirmar" name="confirmar" type="password" minLength={8} required className="campo" autoComplete="new-password" /></div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <Mensagem m={m} />
        <button disabled={pendente} className="btn btn-secundario btn-sm ml-auto">{pendente ? "Salvando…" : "Trocar senha"}</button>
      </div>
    </form>
  );
}
