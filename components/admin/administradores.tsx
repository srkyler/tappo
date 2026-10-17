"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { Vazio, cn } from "@/components/ui/base";
import { definirAdmin } from "@/app/admin/actions";

export type MembroPlataforma = { id: string; email: string | null; nome_completo: string | null; papel: string };

export function Administradores({ membros, euId }: { membros: MembroPlataforma[]; euId: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [alvoId, setAlvoId] = useState<string | null>(null);

  function alternar(m: MembroPlataforma) {
    setErro(null);
    setAlvoId(m.id);
    iniciar(async () => {
      const r = await definirAdmin(m.id, m.papel !== "admin");
      if (!r.ok) setErro(r.erro);
      setAlvoId(null);
    });
  }

  return (
    <div className="painel p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserCog size={16} className="text-gray-400" />
        <h3 className="text-[14.5px] font-medium text-white">Administradores</h3>
        <span className="rounded-full border border-gray-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-gray-500">só você vê isto</span>
      </div>
      {erro && <p role="alert" className="mb-3 text-[13px] text-white">⚠ {erro}</p>}
      {membros.length === 0 ? (
        <Vazio icone={<UserCog size={18} />} titulo="Nenhum outro usuário ainda" texto="Quando alguém se cadastrar, aparece aqui pra você promover." />
      ) : (
        <ul className="divide-y divide-gray-800">
          {membros.map((m) => {
            const admin = m.papel === "admin";
            const eu = m.id === euId;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-white">{m.nome_completo || m.email || m.id}</p>
                  {m.email && <p className="truncate text-[12px] text-gray-500">{m.email}</p>}
                </div>
                {eu ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-black"><ShieldCheck size={11} /> Super admin</span>
                ) : (
                  <button
                    disabled={pendente && alvoId === m.id}
                    onClick={() => alternar(m)}
                    className={cn("btn btn-sm shrink-0", admin ? "btn-fantasma" : "btn-secundario")}
                  >
                    {admin ? <><ShieldOff size={13} /> Remover admin</> : <><ShieldCheck size={13} /> Tornar admin</>}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
