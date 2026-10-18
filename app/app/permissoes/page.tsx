"use client";

import { Suspense, useState, useTransition } from "react";
import { Cabecalho, Pagina, Painel, Vazio } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { bancoPronto } from "@/lib/data/queries";

export const metadata = { title: "Permissões — Tappo" };

const MODULOS = [
  { id: "dashboard", nome: "Dashboard executivo" },
  { id: "gestor", nome: "Painel do gestor" },
  { id: "leads", nome: "Leads" },
  { id: "pipeline", nome: "Pipeline" },
  { id: "inbox", nome: "Inbox WhatsApp" },
  { id: "tarefas", nome: "Tarefas" },
  { id: "empresa", nome: "Empresa e equipe" },
  { id: "comissoes", nome: "Comissões" },
  { id: "propostas", nome: "Propostas" },
  { id: "analytics", nome: "Analytics" },
  { id: "contas", nome: "Contas" },
  { id: "pessoas", nome: "Pessoas" },
];

const PAPEIS = [
  { id: "dono", nome: "Dono", cor: "text-red-400" },
  { id: "gestor", nome: "Gestor", cor: "text-amber-400" },
  { id: "vendedor", nome: "Vendedor", cor: "text-blue-400" },
  { id: "atendente", nome: "Atendente", cor: "text-emerald-400" },
];

async function Conteudo() {
  if (!(await bancoPronto())) return <AvisoBanco />;

  const [permissoes, setPermissoes] = useState(
    PAPEIS.flatMap((p) =>
      MODULOS.map((m) => ({
        papel: p.id,
        modulo: m.id,
        pode_ver: p.id === "dono",
        pode_editar: p.id === "dono",
        pode_excluir: p.id === "dono",
      }))
    )
  );
  const [pendente, iniciar] = useTransition();

  const togglePerm = (papel: string, modulo: string, campo: "pode_ver" | "pode_editar" | "pode_excluir") => {
    setPermissoes((prev) =>
      prev.map((p) =>
        p.papel === papel && p.modulo === modulo ? { ...p, [campo]: !p[campo] } : p
      )
    );
  };

  return (
    <div className="space-y-6">
      <Cabecalho rotulo="Segurança" titulo="Controle de acesso" descricao="Defina quais módulos cada papel pode ver, editar ou excluir." />

      <div className="grid lg:grid-cols-4 gap-4">
        <section className="painel">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-[13px] font-medium text-white">Matriz de permissões</h2>
          </div>
          <div className="overflow-x-auto px-5 py-3">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-[11px] uppercase tracking-[0.1em] text-gray-500 sticky top-0 bg-black">
                  <th className="pb-3 font-medium w-20">Módulo</th>
                  {PAPEIS.map((p) => (
                    <th key={p.id} className="pb-3 font-medium text-center w-20 text-[10px] uppercase" style={{ color: p.cor }}>
                      {p.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {MODULOS.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-900/30">
                    <td className="py-3 pr-2 truncate text-[13px] text-white">{m.nome}</td>
                    {PAPEIS.map((p) => {
                      const perm = permissoes.find((x) => x.papel === p.id && x.modulo === m.id);
                      return (
                        <td key={p.id} className="text-center">
                          <div className="flex justify-center gap-1">
                            {[["pode_ver", "Ver"], ["pode_editar", "Ed"], ["pode_excluir", "Exc"]] as const}.map(([campo, label]) => (
                              <button
                                key={campo}
                                onClick={() => togglePerm(p.id, m.id, campo)}
                                className={`rounded px-1 py-0.5 text-[9px] ${perm?.[campo] ? "bg-white text-black" : "bg-gray-800 text-gray-600 border border-gray-700"}`}
                                title={`${p.nome} - ${m.nome} - ${label}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gray-900/30 border border-gray-800">
          <p className="text-[11px] text-gray-500 mb-2">Legenda:</p>
          <div className="flex gap-3 text-[11px] text-gray-400">
            <span>Ver = ler dados</span>
            <span>Ed = editar</span>
            <span>Exc = excluir</span>
          </div>
        </div>
      </section>

      <section className="painel p-5 lg:col-span-3">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-[13px] font-medium text-white">Resumo por papel</h2>
        </div>
        <div className="px-5 py-3 grid gap-4 md:grid-cols-4">
          {PAPEIS.map((p) => {
            const papelPerms = permissoes.filter((x) => x.papel === p.id);
            const total = papelPerms.length;
            const ver = papelPerms.filter((x) => x.pode_ver).length;
            const editar = papelPerms.filter((x) => x.pode_editar).length;
            const excluir = papelPerms.filter((x) => x.pode_excluir).length;
            return (
              <div key={p.id} className="rounded-lg border border-gray-800 p-4">
                <h4 className="text-[12px] font-bold text-white mb-2">{p.nome}</h4>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Módulos visíveis</span>
                    <span className="text-white">{ver}/{total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pode editar</span>
                    <span className="text-white">{editar}/{total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pode excluir</span>
                    <span className="text-white">{excluir}/{total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function PermissoesPage() {
  return (
    <Pagina>
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
