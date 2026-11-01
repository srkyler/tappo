"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Rotulo, cn } from "@/components/ui/base";
import { salvarConexaoCloud } from "@/app/app/conexoes/actions";
import { excluirConexao } from "@/app/app/inbox/actions";

export type ConexaoCloudTela = {
  id: string; apelido: string | null; status: string; numero: string | null;
  ia_ativa: boolean; distribuicao: string | null;
  phone_number_id: string | null; waba_id: string | null;
  webhook: string | null; verify_token: string | null;
};

function Copiar({ valor }: { valor: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sem clipboard */ } }} className="shrink-0 text-gray-400 hover:text-white" title="Copiar">
      {ok ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

/**
 * WhatsApp oficial (Cloud API da Meta): sem QR e sem risco de banimento por
 * "aparelho não oficial". Fora da janela de 24h só sai mensagem de modelo aprovado.
 */
export function CartaoWhatsOficial({ conexoes, gestor }: { conexoes: ConexaoCloudTela[]; gestor: boolean }) {
  const [selId, setSelId] = useState<string | null>(conexoes[0]?.id ?? null);
  const [novo, setNovo] = useState(conexoes.length === 0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const sel = novo ? null : conexoes.find((c) => c.id === selId) ?? null;
  const algumaOk = conexoes.some((c) => c.status === "WORKING");

  return (
    <section className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-gray-950 text-gray-300"><BadgeCheck size={18} /></div>
          <div>
            <h2 className="text-[15px] font-semibold text-white">WhatsApp oficial (Cloud API)</h2>
            <p className="text-[12.5px] text-gray-500">Número verificado da Meta — sem QR, sem celular ligado</p>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium", algumaOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-gray-700 bg-gray-900 text-gray-400")}>
          {algumaOk ? "Conectado" : conexoes.length ? "Verificar" : "Não conectado"}
        </span>
      </div>

      <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
        {conexoes.length > 0 && (
          <div className="space-y-1.5">
            {conexoes.map((c) => (
              <div key={c.id} onClick={() => { setSelId(c.id); setNovo(false); setErro(null); }} className={cn("flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2", !novo && c.id === selId ? "border-gray-500 bg-white/10" : "border-gray-800 hover:border-gray-600")}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", c.status === "WORKING" ? "bg-emerald-400" : "bg-red-400")} />
                  <span className="truncate text-[13.5px] font-medium text-white">{c.apelido ?? "WhatsApp oficial"}</span>
                  {c.numero && <span className="shrink-0 text-[11px] text-gray-500">+{c.numero}</span>}
                </div>
                {gestor && (
                  <div className="flex shrink-0 items-center gap-3">
                    <Pencil size={12} className="text-gray-400" />
                    <button onClick={(e) => { e.stopPropagation(); if (!window.confirm("Excluir esta conexão oficial?")) return; iniciar(async () => { const r = await excluirConexao(c.id); if (!r.ok) setErro(r.erro); else router.refresh(); }); }} title="Excluir" className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
            ))}
            {gestor && !novo && (
              <button type="button" onClick={() => { setNovo(true); setErro(null); }} className="btn btn-secundario btn-sm text-[12px]"><Plus size={12} /> Adicionar número oficial</button>
            )}
          </div>
        )}

        {sel?.webhook && sel.verify_token && (
          <div className="space-y-1.5 rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-[12px]">
            <p className="font-medium text-gray-300">No painel da Meta (WhatsApp › Configuração › Webhook):</p>
            <div className="flex items-center gap-2"><span className="w-28 shrink-0 text-gray-500">URL de retorno</span><code className="min-w-0 flex-1 truncate text-gray-200">{sel.webhook}</code><Copiar valor={sel.webhook} /></div>
            <div className="flex items-center gap-2"><span className="w-28 shrink-0 text-gray-500">Token de verificação</span><code className="min-w-0 flex-1 truncate text-gray-200">{sel.verify_token}</code><Copiar valor={sel.verify_token} /></div>
            <p className="text-gray-500">Assine o campo <b className="text-gray-300">messages</b>. Fora de 24h desde a última mensagem do cliente, a Meta só aceita modelo aprovado.</p>
          </div>
        )}

        {gestor ? (
          <form
            key={sel?.id ?? "novo"}
            action={(fd) => iniciar(async () => {
              setErro(null); setSalvo(false);
              const r = await salvarConexaoCloud(fd);
              if (r.id) { setSelId(r.id); setNovo(false); }
              if (!r.ok) setErro(r.erro); else setSalvo(true);
              router.refresh();
            })}
            className="space-y-3"
          >
            <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">{sel ? "Editar conexão oficial" : "Nova conexão oficial"}</p>
            {sel && <input type="hidden" name="id" value={sel.id} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Rotulo htmlFor="cl-apelido">Apelido</Rotulo><input id="cl-apelido" name="apelido" defaultValue={sel?.apelido ?? ""} placeholder="Ex.: Vendas (oficial)" className="campo" /></div>
              <div><Rotulo htmlFor="cl-num">ID do número (Phone number ID)</Rotulo><input id="cl-num" name="phone_number_id" defaultValue={sel?.phone_number_id ?? ""} inputMode="numeric" required className="campo" /></div>
              <div><Rotulo htmlFor="cl-waba">ID da conta WhatsApp Business (opcional)</Rotulo><input id="cl-waba" name="waba_id" defaultValue={sel?.waba_id ?? ""} inputMode="numeric" className="campo" /></div>
              <div><Rotulo htmlFor="cl-sec">App Secret</Rotulo><input id="cl-sec" name="app_secret" type="password" autoComplete="off" placeholder={sel ? "•••••• (vazio = manter)" : ""} className="campo" /></div>
            </div>
            <div><Rotulo htmlFor="cl-tok">Token de acesso permanente</Rotulo><input id="cl-tok" name="token" type="password" autoComplete="off" placeholder={sel ? "•••••• (vazio = manter)" : "Token do usuário do sistema (Business Manager)"} className="campo" /></div>
            <label className="flex items-center gap-2 text-[13px] text-gray-300"><input type="checkbox" name="ia_ativa" defaultChecked={sel?.ia_ativa ?? false} /> IA responde os clientes deste número</label>
            <label className="flex items-center gap-2 text-[13px] text-gray-300"><input type="checkbox" name="distribuicao" defaultChecked={sel?.distribuicao === "rodizio"} /> Rodízio de atendimento</label>
            {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
            {salvo && <p className="text-[13px] text-emerald-400">Conectado e validado na Meta. Agora cole a URL e o token de verificação no painel da Meta.</p>}
            <div className="flex gap-2">
              <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? <Loader2 size={13} className="animate-spin" /> : null} {sel ? "Salvar e validar" : "Conectar número oficial"}</button>
              {novo && conexoes.length > 0 && <button type="button" onClick={() => setNovo(false)} className="btn btn-fantasma btn-sm">Cancelar</button>}
            </div>
            <p className="text-[11.5px] text-gray-600">Token e App Secret ficam cifrados no servidor e nunca voltam para a tela.</p>
          </form>
        ) : (
          !conexoes.length && <p className="text-[12.5px] text-gray-500">Peça ao dono ou gestor para conectar um número oficial.</p>
        )}
      </div>
    </section>
  );
}
