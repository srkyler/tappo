"use client";

import { Fragment, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { salvarPermissaoTela } from "@/app/app/empresa/actions";
import { PAPEIS_CONFIGURAVEIS, TELAS_CONFIGURAVEIS, type PapelConfiguravel } from "@/lib/telas";

const ROTULO: Record<PapelConfiguravel, string> = { gestor: "Gestor", vendedor: "Vendedor", atendente: "Atendente" };

/** Matriz tela × papel: marcado = vê a tela. O dono sempre vê tudo. */
export function PermissoesTelas({ inicial }: { inicial: { papel: string; modulo: string; pode_ver: boolean }[] }) {
  const [oculto, setOculto] = useState<Set<string>>(() => new Set(inicial.filter((p) => !p.pode_ver).map((p) => `${p.papel}|${p.modulo}`)));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const alternar = (papel: PapelConfiguravel, modulo: string) => {
    const k = `${papel}|${modulo}`;
    const ver = oculto.has(k); // estava oculto → passa a ver
    const antes = oculto;
    const n = new Set(oculto);
    if (ver) n.delete(k); else n.add(k);
    setOculto(n);
    iniciar(async () => {
      setErro(null);
      const r = await salvarPermissaoTela(papel, modulo, ver);
      if (!r.ok) { setErro(r.erro); setOculto(antes); }
    });
  };

  const grupos = [...new Set(TELAS_CONFIGURAVEIS.map((t) => t.grupo))];

  return (
    <section className="painel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-white">Permissões por tela</h3>
          <p className="text-[12px] text-gray-500">Desmarque para esconder a tela daquele papel — some do menu e a página fica bloqueada. O dono sempre vê tudo.</p>
        </div>
        {pendente && <Loader2 size={14} className="animate-spin text-gray-500" />}
      </div>
      {erro && <p role="alert" className="mb-2 text-[12.5px] text-red-400">{erro}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead>
            <tr className="border-b border-gray-800 text-left text-[11px] text-gray-500">
              <th className="py-2 font-medium">Tela</th>
              {PAPEIS_CONFIGURAVEIS.map((p) => <th key={p} className="w-24 py-2 text-center font-medium">{ROTULO[p]}</th>)}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g}>
                <tr><td colSpan={4} className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-600">{g}</td></tr>
                {TELAS_CONFIGURAVEIS.filter((t) => t.grupo === g).map((t) => (
                  <tr key={t.href} className="border-b border-gray-800/50">
                    <td className="py-1.5 text-gray-300">{t.label}</td>
                    {PAPEIS_CONFIGURAVEIS.map((p) => (
                      <td key={p} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${ROTULO[p]} vê ${t.label}`}
                          checked={!oculto.has(`${p}|${t.href}`)}
                          onChange={() => alternar(p, t.href)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
