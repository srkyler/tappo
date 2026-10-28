"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Loader2, LogOut, QrCode, Smartphone, Trash2, ChevronRight } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, cn } from "@/components/ui/base";
import { conectarWhatsApp, desconectarWhatsApp, estadoWhatsApp, salvarConexao, excluirConexao, type EstadoWhats } from "@/app/app/inbox/actions";
import type { ConexaoTela } from "./inbox-view";

const ROTULO_STATUS: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando leitura do QR code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Falhou — reconecte",
  DESCONHECIDO: "Ainda não verificado",
};

export function ConexaoWhats({ abertas, aberta, aoFechar, conexaoAtiva, setConexaoAtiva }: { abertas: ConexaoTela[]; aberta: boolean; aoFechar: () => void; conexaoAtiva: ConexaoTela | null; setConexaoAtiva: (c: ConexaoTela | null) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [estado, setEstado] = useState<EstadoWhats | null>(null);
  const [pendente, iniciar] = useTransition();

  const atualizar = useCallback(async (id: string): Promise<EstadoWhats> => {
    const e = await estadoWhatsApp(id);
    setEstado(e);
    return e;
  }, []);

  // Enquanto o diálogo está aberto e não conectou, consulta o status (QR expira a cada ~20s)
  useEffect(() => {
    if (!aberta || !conexaoAtiva) return;
    const id = conexaoAtiva.id;
    let vivo = true;
    const ciclo = async () => {
      const e = await atualizar(id);
      if (vivo && !(e.ok && e.status === "WORKING")) timer = setTimeout(ciclo, 4000);
    };
    let timer = setTimeout(ciclo, 0);
    return () => { vivo = false; clearTimeout(timer); };
  }, [aberta, conexaoAtiva, atualizar]);

  function enviar(f: FormData) {
    setErro(null); setSalvo(false);
    iniciar(async () => {
      const r = await salvarConexao(f);
      if (!r.ok) setErro(r.erro);
      else setSalvo(true);
    });
  }

  const status = estado?.ok ? estado.status : conexaoAtiva?.status ?? "DESCONHECIDO";

  return (
    <Dialogo aberto={aberta} aoFechar={aoFechar} titulo="WhatsApp (WAHA)" descricao="Gerencie múltiplas conexões WAHA por empresa. Cada conexão é um número diferente." largura={640}>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        {/* Lista de conexões existentes */}
        <section className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-medium text-gray-400 uppercase tracking-wide">Conexões</h3>
            <button type="button" onClick={() => { setConexaoAtiva(null); }} className="btn btn-fantasma btn-sm text-[12px]">Nova conexão</button>
          </div>
          {abertas.length === 0 ? (
            <p className="text-[12px] text-gray-500 text-center py-4">Nenhuma conexão configurada.</p>
          ) : (
            <div className="space-y-1">
              {abertas.map((c) => {
                const ativa = conexaoAtiva?.id === c.id;
                const st = c.status;
                return (
                  <div key={c.id} onClick={() => setConexaoAtiva(c)} className={cn("flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors hover:bg-gray-900/50", ativa ? "bg-white/10 border-gray-500" : "border-gray-800 hover:border-gray-600")}>
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`h-2 w-2 rounded-full ${st === "WORKING" ? "bg-emerald-400" : st === "SCAN_QR_CODE" || st === "STARTING" ? "bg-amber-400" : "bg-gray-600"}`} />
                      <span className="truncate text-[13px] font-medium text-white">{c.apelido}</span>
                      <span className="text-[10px] text-gray-600">{ROTULO_STATUS[st] ?? st}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setConexaoAtiva(c); }} className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white" title="Selecionar como ativa">{ativa ? <Check size={12} /> : <ChevronRight size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); setConexaoAtiva(c); }} className="rounded-md p-1 text-gray-400 hover:bg-amber-500/20 hover:text-amber-400" title="Ver status"><QrCode size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); iniciar(async () => { await excluirConexao(c.id); setConexaoAtiva(null); }); }} className="rounded-md p-1 text-red-400 hover:bg-red-500/20" title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Formulário nova conexão / editar — sem URL nem API key: fica no .env do servidor */}
        <form action={enviar} className="space-y-4">
          <div>
            <Rotulo htmlFor="w-apelido">Apelido da conexão</Rotulo>
            <input id="w-apelido" name="apelido" defaultValue={conexaoAtiva?.apelido ?? "Conexão WhatsApp"} placeholder="Ex.: Comercial, Suporte, Vendas" className="campo" required />
          </div>
          <div>
            <Rotulo htmlFor="w-sessao">Sessão</Rotulo>
            <input id="w-sessao" name="sessao" defaultValue={conexaoAtiva?.sessao ?? "default"} className="campo" placeholder="default" />
            <p className="mt-1 text-[12px] text-gray-500">Uma sessão por número de WhatsApp. O servidor WAHA e a API key ficam só no .env — nada aqui é exposto.</p>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="ia_ativa" defaultChecked={conexaoAtiva?.ia_ativa ?? false} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">IA responde os clientes</span>
              <span className="block text-[12.5px] text-gray-500">Usa o agente ativo no admin. Em cada conversa você pode assumir e desligar a IA.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="distribuicao" defaultChecked={conexaoAtiva?.distribuicao === "rodizio"} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">Rodízio de atendimento</span>
              <span className="block text-[12.5px] text-gray-500">Distribui conversas novas automaticamente para quem tem menos atendimentos abertos.</span>
            </span>
          </label>
          <div>
            <Rotulo htmlFor="w-instr">Sobre o negócio (o que a IA deve saber)</Rotulo>
            <textarea id="w-instr" name="ia_instrucoes" rows={5} defaultValue={conexaoAtiva?.ia_instrucoes ?? ""} placeholder="Ex.: Somos a Loja X. Horário: seg–sex 9h–18h. Frete grátis acima de R$ 200. Para orçamento, peça nome e cidade." className="campo" />
          </div>
          {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
          <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : null} {salvo ? "Salvo" : "Salvar conexão"}</button>
        </form>

        {/* Status da conexão ativa */}
        {conexaoAtiva && (
          <section className="space-y-4 border-t border-gray-800 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-gray-500">Status da conexão ativa</p>
                <p className="flex items-center gap-2 text-[14px] text-white">
                  <span className={`h-2 w-2 rounded-full ${status === "WORKING" ? "bg-emerald-400" : status === "SCAN_QR_CODE" || status === "STARTING" ? "bg-amber-400" : "bg-gray-600"}`} />
                  {ROTULO_STATUS[status] ?? status}
                  {estado?.ok && estado.numero && <span className="text-gray-500">· +{estado.numero}</span>}
                </p>
              </div>
              {status === "WORKING" ? (
                <button disabled={pendente} onClick={() => iniciar(async () => { await desconectarWhatsApp(conexaoAtiva.id); await atualizar(conexaoAtiva.id); })} className="btn btn-secundario btn-sm"><LogOut size={14} /> Desconectar</button>
              ) : (
                <button disabled={pendente} onClick={() => iniciar(async () => { setErro(null); const r = await conectarWhatsApp(conexaoAtiva.id); if (!r.ok) setErro(r.erro); await atualizar(conexaoAtiva.id); })} className="btn btn-primario btn-sm"><QrCode size={14} /> Conectar</button>
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
          </section>
        )}
      </div>
    </Dialogo>
  );
}
