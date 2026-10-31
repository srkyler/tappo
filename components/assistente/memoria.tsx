"use client";

import { useMemo, useState, useTransition } from "react";
import { Brain, Megaphone, Sparkles, Trash2, UserRound } from "lucide-react";
import { Painel, Vazio } from "@/components/ui/base";
import { excluirMemoria, salvarMemoria } from "@/app/app/assistente/actions";
import type { Memoria } from "@/lib/ai/assistente-tipos";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Telefone (só dígitos) → +55 (11) 9••••-1234; chat_id fica abreviado. */
function rotuloContato(c: string | null) {
  if (!c) return "Contato";
  if (/^\d{10,13}$/.test(c)) {
    const n = c.startsWith("55") && c.length > 11 ? c.slice(2) : c;
    return `(${n.slice(0, 2)}) ${n.slice(2, 3)}••••-${n.slice(-4)}`;
  }
  return c.length > 18 ? `${c.slice(0, 16)}…` : c;
}

export function MemoriaIA({ memorias, gestor }: { memorias: Memoria[]; gestor: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const h = hoje();

  const avisos = memorias.filter((m) => m.escopo === "empresa");
  const porContato = useMemo(() => {
    const g = new Map<string, Memoria[]>();
    for (const m of memorias.filter((x) => x.escopo === "contato")) {
      const k = m.contato ?? "?";
      g.set(k, [...(g.get(k) ?? []), m]);
    }
    return [...g.entries()];
  }, [memorias]);

  const excluir = (id: string) => iniciar(async () => {
    const r = await excluirMemoria(id);
    setErro(r.ok ? null : r.erro);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Painel titulo={<span className="inline-flex items-center gap-2"><Megaphone size={14} /> Avisos da empresa</span>}>
        <div className="space-y-4 p-5">
          <p className="text-[12.5px] leading-relaxed text-gray-500">
            Coisas que o assistente deve saber agora e vale para todos os clientes — promoções, falta de estoque, feriados, mudanças.
            Com data de validade, o aviso some sozinho.
          </p>
          {gestor && (
            <form
              action={(fd) => iniciar(async () => {
                const r = await salvarMemoria(fd);
                if (r.ok) { setErro(null); (document.getElementById("form-aviso-ia") as HTMLFormElement | null)?.reset(); }
                else setErro(r.erro);
              })}
              id="form-aviso-ia"
              className="space-y-2"
            >
              <textarea name="fato" rows={2} maxLength={500} required className="campo w-full resize-y" placeholder="Ex.: Black Friday: 20% de desconto em clareamento até 30/11." />
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-gray-400" htmlFor="valido_ate">Válido até</label>
                <input id="valido_ate" name="valido_ate" type="date" min={h} className="campo w-auto" />
                <button disabled={pendente} className="btn btn-primario btn-sm ml-auto">{pendente ? "Salvando…" : "Adicionar aviso"}</button>
              </div>
            </form>
          )}
          {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
          {avisos.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-600">Nenhum aviso no momento.</p>
          ) : (
            <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
              {avisos.map((m) => {
                const vencido = !!m.valido_ate && m.valido_ate < h;
                return (
                  <li key={m.id} className="flex items-start gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] leading-relaxed ${vencido ? "text-gray-600 line-through" : "text-gray-200"}`}>{m.fato}</p>
                      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-600">
                        {m.valido_ate ? (vencido ? `Venceu em ${m.valido_ate.split("-").reverse().join("/")}` : `Até ${m.valido_ate.split("-").reverse().join("/")}`) : "Sem validade"}
                      </p>
                    </div>
                    {gestor && <button aria-label="Excluir aviso" disabled={pendente} onClick={() => excluir(m.id)} className="btn btn-fantasma btn-sm"><Trash2 size={13} /></button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Painel>

      <Painel titulo={<span className="inline-flex items-center gap-2"><Brain size={14} /> O que o assistente lembra dos clientes</span>}>
        {porContato.length === 0 ? (
          <Vazio icone={<Sparkles size={18} />} titulo="Nada aprendido ainda"
            texto="Durante as conversas o assistente guarda fatos curtos sobre cada cliente (interesse, preferências, orçamento) para não perguntar de novo." />
        ) : (
          <ul className="max-h-[640px] divide-y divide-gray-800 overflow-y-auto">
            {porContato.map(([contato, fatos]) => (
              <li key={contato} className="px-5 py-4">
                <p className="mb-2 inline-flex items-center gap-2 text-[12.5px] font-medium text-white"><UserRound size={13} /> {rotuloContato(contato)}</p>
                <ul className="space-y-1.5">
                  {fatos.map((m) => (
                    <li key={m.id} className="group flex items-start gap-2 text-[13px] text-gray-300">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-500" />
                      <span className="flex-1 leading-relaxed">{m.fato} <span className="font-mono text-[10.5px] text-gray-600">{m.origem === "ia" ? "IA" : "equipe"} · {data(m.created_at)}</span></span>
                      {gestor && (
                        <button aria-label="Esquecer este fato" title="Esquecer" disabled={pendente} onClick={() => excluir(m.id)}
                          className="text-gray-600 opacity-0 transition-opacity hover:text-white focus:opacity-100 group-hover:opacity-100"><Trash2 size={12} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
