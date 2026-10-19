"use client";

import { Suspense, useState, useTransition } from "react";
import { Cabecalho, Pagina, Painel, Vazio, Status } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";

export default function PermissoesClient() {
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

  const togglePerm = (papel: string, modulo: string, campo: string) => {
    setPermissoes((prev) =>
      prev.map((p) =>
        p.papel === papel && p.modulo === modulo ? { ...p, [campo]: !p[campo] } : p
      )
    );
  };

  return (
    <div className="space-y-6">
      <Cabecalho
        rotulo="Segurança"
        titulo="Controle de acesso"
        descricao="Defina quais módulos cada papel pode ver, editar ou excluir."
      />

      <div className="grid lg:grid-cols-4 gap-4">
        <section className="painel">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-[12px] font-medium text-gray-300 uppercase tracking-wide">
              Módulos
            </h3>
          </div>
          <div className="px-5 py-3 space-y-2">
            {MODULOS.map((m) => (
              <div key={m.id} className="text-[13px] text-white">{m.nome}</div>
            ))}
          </div>
        </section>

        {PAPEIS.map((papel) => (
          <section key={papel.id} className="painel">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-[12px] font-medium uppercase tracking-wide">
                <span className={papel.cor}>{papel.nome}</span>
              </h3>
            </div>
            <div className="px-5 py-3 space-y-2">
              {MODULOS.map((modulo) => {
                const perm = permissoes.find(
                  (p) => p.papel === papel.id && p.modulo === modulo.id
                );
                return (
                  <div
                    key={modulo.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="text-gray-300">{modulo.nome}</span>
                    <div className="flex items-center gap-2">
                      {["pode_ver", "pode_editar", "pode_excluir"].map((campo) => (
                        <label
                          key={campo}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={perm?.[campo as keyof typeof perm] ?? false}
                            onChange={() => togglePerm(papel.id, modulo.id, campo)}
                            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            {campo.replace("pode_", "").toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
