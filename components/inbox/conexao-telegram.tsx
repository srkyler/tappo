"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, LogOut, Send } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo } from "@/components/ui/base";
import { desconectarTelegram, salvarTelegram } from "@/app/inbox/telegram-actions";
import type { ConexaoTelegramTela } from "./inbox-view";

export function ConexaoTelegram({ aberto, aoFechar, conexao }: { aberto: boolean; aoFechar: () => void; conexao: ConexaoTelegramTela | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function enviar(f: FormData) {
    setErro(null); setSalvo(false);
    iniciar(async () => {
      const r = await salvarTelegram(f);
      if (!r.ok) setErro(r.erro);
      else setSalvo(true);
    });
  }

  const conectado = conexao?.status === "WORKING";

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Telegram" descricao="Conecte um bot do Telegram pra atender por lá também." largura={560}>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <form action={enviar} className="space-y-4">
          <div>
            <Rotulo htmlFor="t-token">Token do bot {conexao?.tem_token && <span className="text-gray-500">(salvo — deixe vazio para manter)</span>}</Rotulo>
            <input id="t-token" name="bot_token" type="password" autoComplete="off" placeholder={conexao?.tem_token ? "••••••••" : "123456:ABC-DEF..."} className="campo" />
            <p className="mt-1.5 text-[12px] text-gray-500">Fale com <strong>@BotFather</strong> no Telegram → <code className="font-mono">/newbot</code> → cole o token aqui.</p>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="ia_ativa" defaultChecked={conexao?.ia_ativa ?? false} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">IA responde os clientes</span>
              <span className="block text-[12.5px] text-gray-500">Usa o mesmo agente ativo no admin. Em cada conversa você pode assumir e desligar a IA.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="distribuicao" defaultChecked={conexao?.distribuicao === "rodizio"} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Rodízio de atendimento</span>
              <span className="block text-[12.5px] text-gray-500">Distribui conversas novas automaticamente para quem tem menos atendimentos abertos.</span>
            </span>
          </label>
          <div>
            <Rotulo htmlFor="t-instr">Sobre o negócio (o que a IA deve saber)</Rotulo>
            <textarea id="t-instr" name="ia_instrucoes" rows={5} defaultValue={conexao?.ia_instrucoes ?? ""} placeholder="Ex.: Somos a Loja X. Horário: seg–sex 9h–18h." className="campo" />
          </div>
          {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
          <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : null} {salvo ? "Salvo" : "Salvar"}</button>
        </form>

        {conexao && (
          <section className="space-y-4 border-t border-gray-800 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-gray-500">Status</p>
                <p className="flex items-center gap-2 text-[14px] text-white">
                  <span className={`h-2 w-2 rounded-full ${conectado ? "bg-emerald-400" : "bg-gray-600"}`} />
                  {conectado ? "Conectado" : "Desconectado"}
                  {conexao.username && <span className="text-gray-500">· @{conexao.username}</span>}
                </p>
              </div>
              {conectado && (
                <button disabled={pendente} onClick={() => iniciar(async () => { const r = await desconectarTelegram(); if (!r.ok) setErro(r.erro); })} className="btn btn-secundario btn-sm"><LogOut size={14} /> Desconectar</button>
              )}
            </div>
            {!conectado && conexao.tem_token && <p className="flex items-center gap-1.5 text-[12.5px] text-gray-500"><Send size={13} /> Token salvo, mas desconectado — salve de novo para reconectar o webhook.</p>}
          </section>
        )}
      </div>
    </Dialogo>
  );
}
