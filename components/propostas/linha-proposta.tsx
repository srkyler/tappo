"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { enviarProposta, excluirProposta, revogarLinkProposta } from "@/app/app/propostas/actions";
import { gerarPdfProposta } from "@/app/app/propostas/actions-pdf";
import type { Proposta } from "@/lib/data/types";

const COR: Record<string, string> = {
  rascunho: "text-gray-400", enviado: "text-blue-400", visualizado: "text-amber-300",
  aceito: "text-emerald-400", rejeitado: "text-red-400", expirado: "text-gray-500",
};
const brl = (v: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "");

export function LinhaProposta({ p, base }: { p: Proposta; base: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const link = p.token_publico ? `${base || (typeof window !== "undefined" ? window.location.origin : "")}/p/${p.token_publico}` : null;

  const copiar = async (l: string) => {
    try { await navigator.clipboard.writeText(l); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setErro(`Copie: ${l}`); }
  };
  const rodar = (f: () => Promise<{ ok: boolean; erro?: string; link?: string }>) => iniciar(async () => {
    setErro(null);
    const r = await f();
    if (!r.ok) setErro(r.erro ?? "Falhou."); else if (r.link) await copiar(r.link);
  });
  const respondida = p.status === "aceito" || p.status === "rejeitado";

  return (
    <div className="rounded-lg bg-gray-900/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{p.titulo}</p>
          <p className="text-[11px] text-gray-500">
            {brl(p.valor)} · <span className={COR[p.status] ?? ""}>{p.status}</span>
            {p.visualizado_em && !respondida ? ` · aberta ${dt(p.visualizado_em)}` : ""}
            {p.link_expira_em && !respondida ? ` · link até ${dt(p.link_expira_em).split(" ")[0]}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {pendente && <Loader2 size={13} className="animate-spin text-gray-500" />}
          {!respondida && (
            link ? (
              <>
                <button onClick={() => copiar(link)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10" title="Copiar link do cliente">
                  {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? "Copiado" : "Copiar link"}
                </button>
                <button disabled={pendente} onClick={() => rodar(() => revogarLinkProposta(p.id))} className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-800" title="O cliente não consegue mais abrir">Revogar</button>
              </>
            ) : (
              <button disabled={pendente} onClick={() => rodar(() => enviarProposta(p.id))} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10" title="Gera o link para o cliente aceitar e copia">
                <Link2 size={12} /> Gerar link
              </button>
            )
          )}
          {p.pdf_url ? (
            <a href={p.pdf_url} target="_blank" rel="noreferrer" className="rounded px-2 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10">PDF</a>
          ) : (
            <button disabled={pendente} onClick={() => rodar(async () => { await gerarPdfProposta(p.id); return { ok: true }; })} className="rounded px-2 py-1 text-[11px] text-blue-400 hover:bg-blue-500/10">Gerar PDF</button>
          )}
          <button disabled={pendente} onClick={() => { if (window.confirm("Excluir esta proposta?")) rodar(() => excluirProposta(p.id)); }} className="rounded px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10">Excluir</button>
        </div>
      </div>
      {respondida && p.resposta_nome && (
        <p className="mt-2 text-[12px] text-gray-400">
          {p.status === "aceito" ? "Aceita" : "Recusada"} por <span className="text-white">{p.resposta_nome}</span> em {dt(p.respondido_em)}
          {p.resposta_mensagem ? <span className="block text-gray-500">“{p.resposta_mensagem}”</span> : null}
        </p>
      )}
      {erro && <p role="alert" className="mt-1 text-[12px] text-red-400">{erro}</p>}
    </div>
  );
}
