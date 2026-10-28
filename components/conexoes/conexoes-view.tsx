"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertTriangle, Calendar, Check, Cloud, ExternalLink, Loader2, LogOut, Mail, MessageCircle,
  Megaphone, Plug, QrCode, Send, Smartphone, Trash2, Workflow, Zap,
} from "lucide-react";
import { Rotulo, cn } from "@/components/ui/base";
import { conectarWhatsApp, desconectarWhatsApp, estadoWhatsApp, type EstadoWhats } from "@/app/app/inbox/actions";
import { alternarMetaAds, removerMetaAds, salvarMetaAds } from "@/app/app/conexoes/actions";

export type ConexaoWaTela = { id: string; apelido: string | null; sessao: string; status: string; numero: string | null };
export type MetaAdsTela = { ativo: boolean; conta: string | null; tem_chave: boolean; ultimo_sync: string | null };

const ROTULO_STATUS: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando QR code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Falhou — reconecte",
  DESCONHECIDO: "Não verificado",
};

function Cartao({
  icone, nome, descricao, status, children, className,
}: {
  icone: React.ReactNode; nome: string; descricao: string;
  status?: { rotulo: string; tom: "verde" | "ambar" | "cinza" } | null;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-gray-800 bg-gray-900/40 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-gray-950 text-gray-300">{icone}</div>
          <div>
            <h2 className="text-[15px] font-semibold text-white">{nome}</h2>
            <p className="text-[12.5px] text-gray-500">{descricao}</p>
          </div>
        </div>
        {status && (
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
            status.tom === "verde" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            status.tom === "ambar" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
            status.tom === "cinza" && "border-gray-700 bg-gray-900 text-gray-400")}>
            <span className={cn("h-1.5 w-1.5 rounded-full",
              status.tom === "verde" && "bg-emerald-400", status.tom === "ambar" && "bg-amber-400", status.tom === "cinza" && "bg-gray-500")} />
            {status.rotulo}
          </span>
        )}
      </div>
      {children && <div className="mt-4 border-t border-gray-800 pt-4">{children}</div>}
    </section>
  );
}

function Botao({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn("btn btn-sm", props.className)}>{children}</button>;
}

export function ConexoesView({ wahaPronto, conexoesWa, telegram, email, metaAds }: {
  wahaPronto: boolean;
  conexoesWa: ConexaoWaTela[];
  telegram: { status: string; username: string | null } | null;
  email: { endereco_envia: string | null } | null;
  metaAds: MetaAdsTela | null;
}) {
  const waAtiva = conexoesWa[0] ?? null;
  const [estado, setEstado] = useState<EstadoWhats | null>(null);
  const [erroWa, setErroWa] = useState<string | null>(null);
  const [erroMeta, setErroMeta] = useState<string | null>(null);
  const [salvoMeta, setSalvoMeta] = useState(false);
  const [pendente, iniciar] = useTransition();

  const statusWa = estado?.ok ? estado.status : waAtiva?.status ?? "DESCONHECIDO";
  const tomWa = statusWa === "WORKING" ? "verde" : statusWa === "SCAN_QR_CODE" || statusWa === "STARTING" ? "ambar" : "cinza";

  const atualizarWa = () => iniciar(async () => {
    if (!waAtiva) return;
    setErroWa(null);
    const e = await estadoWhatsApp(waAtiva.id);
    setEstado(e);
    if (!e.ok) setErroWa(e.erro);
  });

  function enviarMeta(f: FormData) {
    setErroMeta(null); setSalvoMeta(false);
    iniciar(async () => {
      const r = await salvarMetaAds(f);
      if (!r.ok) setErroMeta(r.erro); else setSalvoMeta(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- WhatsApp (WAHA) ---------- */}
        <Cartao
          icone={<MessageCircle size={18} />}
          nome="WhatsApp (WAHA)"
          descricao={wahaPronto ? "Gateway configurado no servidor" : "WAHA não configurado no .env"}
          status={wahaPronto ? { rotulo: ROTULO_STATUS[statusWa] ?? statusWa, tom: tomWa } : { rotulo: "Sem servidor", tom: "ambar" }}
        >
          {!wahaPronto ? (
            <p className="flex items-start gap-2 text-[13px] text-amber-300/90">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Defina <code className="rounded bg-gray-950 px-1">WAHA_BASE_URL</code> (ou <code className="rounded bg-gray-950 px-1">WAHA_DOMAIN</code>) e <code className="rounded bg-gray-950 px-1">WAHA_API_KEY</code> no .env do servidor. A URL e a key nunca aparecem na interface.
            </p>
          ) : !waAtiva ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-gray-400">Nenhuma conexão criada ainda. Crie no Inbox e o QR aparece aqui.</p>
              <Link href="/app/inbox" className="btn btn-primario btn-sm shrink-0">Criar no Inbox <ExternalLink size={13} /></Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] text-white">
                  {waAtiva.apelido ?? "Conexão"} <span className="text-gray-500">· sessão {waAtiva.sessao}</span>
                  {estado?.ok && estado.numero && <span className="text-gray-500"> · +{estado.numero}</span>}
                </p>
                <div className="flex gap-2">
                  {statusWa === "WORKING" ? (
                    <Botao onClick={() => iniciar(async () => { await desconectarWhatsApp(waAtiva.id); await atualizarWa(); })}><LogOut size={13} /> Desconectar</Botao>
                  ) : (
                    <Botao className="btn-primario" onClick={atualizarWa}>{pendente ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />} Conectar</Botao>
                  )}
                  <Link href="/app/inbox" className="btn btn-fantasma btn-sm" title="Abrir Inbox"><ExternalLink size={13} /></Link>
                </div>
              </div>
              {erroWa && <p className="text-[13px] text-red-400">{erroWa}</p>}
              {estado?.ok && estado.qr && (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estado.qr} alt="QR code do WhatsApp" className="h-52 w-52" />
                  <p className="flex items-center gap-1.5 text-[12.5px] text-gray-700"><Smartphone size={14} /> WhatsApp → Aparelhos conectados → Conectar</p>
                </div>
              )}
              {conexoesWa.length > 1 && (
                <p className="text-[12px] text-gray-500">{conexoesWa.length} conexões — gerencie todas no <Link className="underline" href="/app/inbox">Inbox</Link>.</p>
              )}
            </div>
          )}
        </Cartao>

        {/* ---------- Meta Ads ---------- */}
        <Cartao
          icone={<Megaphone size={18} />}
          nome="Meta Ads"
          descricao="Leads de campanhas do Facebook/Instagram"
          status={metaAds?.tem_chave ? { rotulo: metaAds.ativo ? "Conectado" : "Pausado", tom: metaAds.ativo ? "verde" : "cinza" } : { rotulo: "Não conectado", tom: "cinza" }}
        >
          {metaAds?.tem_chave ? (
            <div className="space-y-3">
              <dl className="grid gap-1 text-[13px]">
                <div className="flex justify-between"><dt className="text-gray-500">Conta</dt><dd className="font-mono text-gray-200">{metaAds.conta}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Access token</dt><dd className="text-gray-200">•••••••• (salvo cifrado)</dd></div>
                {metaAds.ultimo_sync && (
                  <div className="flex justify-between"><dt className="text-gray-500">Salvo em</dt><dd className="text-gray-300">{new Date(metaAds.ultimo_sync).toLocaleString("pt-BR")}</dd></div>
                )}
              </dl>
              {erroMeta && <p className="text-[13px] text-red-400">{erroMeta}</p>}
              <div className="flex gap-2">
                <Botao onClick={() => iniciar(async () => { const r = await alternarMetaAds(!metaAds.ativo); if (!r.ok) setErroMeta(r.erro); })}>
                  {metaAds.ativo ? "Pausar" : "Ativar"}
                </Botao>
                <form action={() => iniciar(async () => { const r = await removerMetaAds(); if (!r.ok) setErroMeta(r.erro); })}>
                  <Botao type="submit" className="text-red-400 hover:bg-red-500/10"><Trash2 size={13} /> Remover</Botao>
                </form>
              </div>
            </div>
          ) : (
            <form action={enviarMeta} className="space-y-3">
              <div>
                <Rotulo htmlFor="m-conta">Conta de anúncios</Rotulo>
                <input id="m-conta" name="conta" placeholder="act_123456789" className="campo font-mono !text-[13px]" required />
              </div>
              <div>
                <Rotulo htmlFor="m-token">Access token do Meta</Rotulo>
                <input id="m-token" name="token" type="password" autoComplete="off" placeholder="EAAB…" className="campo font-mono !text-[13px]" required />
                <p className="mt-1 text-[12px] text-gray-500">Fica cifrado no servidor (AI_KEYS_SECRET) — nunca volta para a tela.</p>
              </div>
              {erroMeta && <p className="text-[13px] text-red-400">{erroMeta}</p>}
              <Botao type="submit" className="btn-primario">{pendente ? <Loader2 size={13} className="animate-spin" /> : salvoMeta ? <Check size={13} /> : <Plug size={13} />} {salvoMeta ? "Salvo" : "Conectar Meta Ads"}</Botao>
            </form>
          )}
        </Cartao>

        {/* ---------- Telegram ---------- */}
        <Cartao
          icone={<Send size={18} />}
          nome="Telegram"
          descricao="Bot de atendimento no Telegram"
          status={telegram ? { rotulo: telegram.status === "ativo" || telegram.status === "WORKING" ? "Conectado" : telegram.status, tom: telegram.status === "ativo" || telegram.status === "WORKING" ? "verde" : "cinza" } : { rotulo: "Não conectado", tom: "cinza" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-gray-400">
              {telegram?.username ? <>Bot <span className="text-gray-200">@{telegram.username}</span></> : "Configure o bot pelo Inbox (canal Telegram)."}
            </p>
            <Link href="/app/inbox" className="btn btn-secundario btn-sm shrink-0">Configurar <ExternalLink size={13} /></Link>
          </div>
        </Cartao>

        {/* ---------- E-mail ---------- */}
        <Cartao
          icone={<Mail size={18} />}
          nome="E-mail"
          descricao="Entrada e disparo via Resend"
          status={email ? { rotulo: "Ativo", tom: "verde" } : { rotulo: "Não configurado", tom: "cinza" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-gray-400">
              {email?.endereco_envia ? <>Enviando por <span className="text-gray-200">{email.endereco_envia}</span></> : "Configure remetente e caixa de entrada no Inbox (canal E-mail)."}
            </p>
            <Link href="/app/inbox" className="btn btn-secundario btn-sm shrink-0">Configurar <ExternalLink size={13} /></Link>
          </div>
        </Cartao>
      </div>

      {/* ---------- Em breve ---------- */}
      <div>
        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wide text-gray-500">Em breve</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icone: <Calendar size={16} />, nome: "Google Agenda", txt: "Reuniões direto na agenda" },
            { icone: <Zap size={16} />, nome: "Zapier", txt: "Milhares de apps conectados" },
            { icone: <Workflow size={16} />, nome: "n8n / Make", txt: "Automação self-hosted" },
            { icone: <Cloud size={16} />, nome: "WhatsApp Cloud API", txt: "API oficial da Meta" },
          ].map((x) => (
            <div key={x.nome} className="flex items-start gap-3 rounded-xl border border-gray-800/70 bg-gray-950/30 p-4 opacity-70">
              <span className="mt-0.5 text-gray-500">{x.icone}</span>
              <div>
                <p className="text-[13.5px] font-medium text-gray-300">{x.nome}</p>
                <p className="text-[12px] text-gray-600">{x.txt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
