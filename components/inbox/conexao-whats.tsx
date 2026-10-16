"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, LogOut, QrCode, Smartphone } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo } from "@/components/ui/base";
import { conectarWhatsApp, desconectarWhatsApp, estadoWhatsApp, salvarConexao, type EstadoWhats } from "@/app/app/inbox/actions";
import type { ConexaoTela } from "./inbox-view";

const ROTULO_STATUS: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando leitura do QR code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Falhou — reconecte",
  DESCONHECIDO: "Ainda não verificado",
};

export function ConexaoWhats({ aberto, aoFechar, conexao }: { aberto: boolean; aoFechar: () => void; conexao: ConexaoTela | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [estado, setEstado] = useState<EstadoWhats | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  const atualizar = useCallback(async () => {
    const e = await estadoWhatsApp();
    setEstado(e);
    return e;
  }, []);

  // Enquanto o diálogo está aberto e não conectou, consulta o status (QR expira a cada ~20s)
  useEffect(() => {
    if (!aberto || !conexao) return;
    let vivo = true;
    const ciclo = async () => {
      const e = await atualizar();
      if (vivo && !(e.ok && e.status === "WORKING")) timer = setTimeout(ciclo, 4000);
    };
    let timer = setTimeout(ciclo, 0);
    return () => { vivo = false; clearTimeout(timer); };
  }, [aberto, conexao, atualizar]);

  function enviar(f: FormData) {
    setErro(null); setSalvo(false);
    iniciar(async () => {
      const r = await salvarConexao(f);
      if (!r.ok) setErro(r.erro);
      else setSalvo(true);
    });
  }

  const status = estado?.ok ? estado.status : conexao?.status ?? "DESCONHECIDO";

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="WhatsApp (WAHA)" descricao="Conecte seu servidor WAHA e escaneie o QR code com o WhatsApp do atendimento." largura={560}>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <form action={enviar} className="space-y-4">
          <div>
            <Rotulo htmlFor="w-url">URL do WAHA</Rotulo>
            <input id="w-url" name="base_url" defaultValue={conexao?.base_url ?? ""} placeholder="https://waha.suaempresa.com" className="campo" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Rotulo htmlFor="w-key">API key {conexao?.tem_chave && <span className="text-gray-500">(salva — deixe vazio para manter)</span>}</Rotulo>
              <input id="w-key" name="api_key" type="password" autoComplete="off" placeholder={conexao?.tem_chave ? "••••••••" : "WAHA_API_KEY"} className="campo" />
            </div>
            <div>
              <Rotulo htmlFor="w-sessao">Sessão</Rotulo>
              <input id="w-sessao" name="sessao" defaultValue={conexao?.sessao ?? "default"} className="campo" />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="ia_ativa" defaultChecked={conexao?.ia_ativa ?? false} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">IA responde os clientes</span>
              <span className="block text-[12.5px] text-gray-500">Usa o agente ativo no admin. Em cada conversa você pode assumir e desligar a IA.</span>
            </span>
          </label>
          <div>
            <Rotulo htmlFor="w-instr">Sobre o negócio (o que a IA deve saber)</Rotulo>
            <textarea id="w-instr" name="ia_instrucoes" rows={5} defaultValue={conexao?.ia_instrucoes ?? ""} placeholder="Ex.: Somos a Loja X. Horário: seg–sex 9h–18h. Frete grátis acima de R$ 200. Para orçamento, peça nome e cidade." className="campo" />
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
                  <span className={`h-2 w-2 rounded-full ${status === "WORKING" ? "bg-emerald-400" : status === "SCAN_QR_CODE" || status === "STARTING" ? "bg-amber-400" : "bg-gray-600"}`} />
                  {ROTULO_STATUS[status] ?? status}
                  {estado?.ok && estado.numero && <span className="text-gray-500">· +{estado.numero}</span>}
                </p>
              </div>
              {status === "WORKING" ? (
                <button disabled={pendente} onClick={() => iniciar(async () => { await desconectarWhatsApp(); await atualizar(); })} className="btn btn-secundario btn-sm"><LogOut size={14} /> Desconectar</button>
              ) : (
                <button disabled={pendente} onClick={() => iniciar(async () => { setErro(null); const r = await conectarWhatsApp(); if (!r.ok) setErro(r.erro); await atualizar(); })} className="btn btn-primario btn-sm"><QrCode size={14} /> Conectar</button>
              )}
            </div>
            {estado && !estado.ok && <p className="text-[13px] text-red-400">{estado.erro}</p>}
            {estado?.ok && estado.qr && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estado.qr} alt="QR code do WhatsApp" className="h-56 w-56" />
                <p className="flex items-center gap-1.5 text-[12.5px] text-gray-700"><Smartphone size={14} /> WhatsApp → Aparelhos conectados → Conectar</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-[12px] text-gray-500">Webhook (configurado automaticamente ao conectar)</p>
              <div className="flex gap-2">
                <code className="campo flex items-center overflow-x-auto whitespace-nowrap text-[12px]">{conexao.webhook}</code>
                <button type="button" onClick={async () => { await navigator.clipboard.writeText(conexao.webhook); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="btn btn-secundario btn-sm shrink-0" aria-label="Copiar webhook">{copiado ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
              {/localhost|127\.0\.0\.1/.test(conexao.webhook) && <p className="mt-1.5 text-[12px] text-amber-400">O WAHA não alcança localhost. Use a URL pública do app (NEXT_PUBLIC_APP_URL) ou um túnel como ngrok.</p>}
            </div>
          </section>
        )}
      </div>
    </Dialogo>
  );
}
