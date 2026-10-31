"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle, Calendar, Check, Cloud, ExternalLink, Loader2, LogOut, Mail, Megaphone,
  MessageCircle, Pencil, Plus, Plug, QrCode, Send, Smartphone, Trash2, Workflow, Zap,
} from "lucide-react";
import { Rotulo, cn } from "@/components/ui/base";
import {
  codigoPareamentoWhatsApp, conectarWhatsApp, desconectarWhatsApp, estadoWhatsApp,
  excluirConexao, novaConexaoRapida, salvarConexao, type EstadoWhats,
} from "@/app/app/inbox/actions";
import { alternarMetaAds, removerMetaAds, salvarMetaAds } from "@/app/app/conexoes/actions";

export type ConexaoWaTela = {
  id: string; apelido: string | null; sessao: string; status: string; numero: string | null;
  ia_ativa: boolean; ia_instrucoes: string; distribuicao: string | null;
};
export type MetaAdsTela = { ativo: boolean; conta: string | null; tem_chave: boolean; ultimo_sync: string | null };

const ROTULO_STATUS: Record<string, string> = {
  WORKING: "Conectado",
  SCAN_QR_CODE: "Aguardando QR code",
  STARTING: "Iniciando…",
  STOPPED: "Desconectado",
  FAILED: "Falhou — reconecte",
  DESCONHECIDO: "Não verificado",
};

/** Alternativa ao QR (celular sem câmera boa, atendimento remoto): o WhatsApp pede um código de 8 caracteres. */
function PareamentoPorCodigo({ conexaoId }: { conexaoId: string }) {
  const [fone, setFone] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="mt-3 rounded-lg border border-gray-800 p-3">
      <p className="text-[12.5px] text-gray-400">Sem câmera? Receba um código e digite no celular em <span className="text-gray-300">Aparelhos conectados → Conectar com número de telefone</span>.</p>
      <form
        className="mt-2 flex gap-2"
        action={() => iniciar(async () => {
          setErro(null); setCodigo(null);
          const r = await codigoPareamentoWhatsApp(conexaoId, fone);
          if (!r.ok) setErro(r.erro); else setCodigo(r.codigo);
        })}
      >
        <input value={fone} onChange={(e) => setFone(e.target.value)} placeholder="DDD + número do WhatsApp" inputMode="tel" className="campo flex-1" required />
        <button type="submit" disabled={pendente} className="btn btn-secundario btn-sm">{pendente ? <Loader2 size={13} className="animate-spin" /> : "Gerar código"}</button>
      </form>
      {codigo && <p className="mt-2 text-center font-mono text-[22px] tracking-[0.3em] text-white">{codigo}</p>}
      {erro && <p className="mt-2 text-[12.5px] text-red-400">{erro}</p>}
    </div>
  );
}

function Cartao({
  icone, nome, descricao, status, children, className,
}: {
  icone: React.ReactNode; nome: string; descricao: string;
  status?: { rotulo: string; tom: "verde" | "ambar" | "cinza" };
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

/* ---------------- WhatsApp (WAHA): gestão completa nesta página ---------------- */
function CartaoWhats({ wahaPronto, conexoes }: { wahaPronto: boolean; conexoes: ConexaoWaTela[] }) {
  const [selId, setSelId] = useState<string | null>(conexoes[0]?.id ?? null);
  const [estado, setEstado] = useState<EstadoWhats | null>(null);
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  const sel = conexoes.find((c) => c.id === selId) ?? null;
  const status = estado?.ok ? estado.status : sel?.status ?? "DESCONHECIDO";
  const tomWa = status === "WORKING" ? "verde" : status === "SCAN_QR_CODE" || status === "STARTING" ? "ambar" : "cinza";

  // Ao selecionar: busca o estado atual
  useEffect(() => {
    if (!selId) { setEstado(null); return; }
    let vivo = true;
    estadoWhatsApp(selId).then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, [selId]);

  // QR pendente → auto-refresh até conectar (QR expira a cada ~20s; pausa com aba oculta)
  useEffect(() => {
    if (!selId || (status !== "SCAN_QR_CODE" && status !== "STARTING")) return;
    const t = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const e = await estadoWhatsApp(selId);
      setEstado(e);
    }, 4000);
    return () => clearInterval(t);
  }, [selId, status]);

  function enviar(f: FormData) {
    setErro(null); setSalvo(false);
    iniciar(async () => {
      const r = await salvarConexao(f);
      if (!r.ok) setErro(r.erro); else { setSalvo(true); setTimeout(() => setSalvo(false), 2000); }
    });
  }

  const editar = (c: ConexaoWaTela | null) => { setSelId(c?.id ?? null); setErro(null); setSalvo(false); };

  return (
    <Cartao
      icone={<MessageCircle size={18} />}
      nome="WhatsApp (WAHA)"
      descricao={wahaPronto ? "Conecte aqui — depois disso Inbox e Jarvis atendem sozinhos" : "WAHA não configurado no .env"}
      status={wahaPronto ? { rotulo: ROTULO_STATUS[status] ?? status, tom: tomWa } : { rotulo: "Sem servidor", tom: "ambar" }}
    >
      {!wahaPronto ? (
        <p className="flex items-start gap-2 text-[13px] text-amber-300/90">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Defina <code className="rounded bg-gray-950 px-1">WAHA_BASE_URL</code> (ou <code className="rounded bg-gray-950 px-1">WAHA_DOMAIN</code>) e <code className="rounded bg-gray-950 px-1">WAHA_API_KEY</code> no .env do servidor. A URL e a key nunca aparecem na interface.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Lista de conexões */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">Conexões desta empresa</p>
              <button
                type="button"
                disabled={pendente}
                onClick={() => iniciar(async () => {
                  setErro(null); setSalvo(false);
                  const r = await novaConexaoRapida();
                  if (!r.ok) setErro(r.erro);
                  else { setSelId(r.id ?? null); setEstado(null); router.refresh(); }
                })}
                className="btn btn-primario btn-sm text-[12px]"
              >
                {pendente ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Conectar novo WhatsApp
              </button>
            </div>
            {conexoes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-800 px-3 py-3 text-center text-[12.5px] text-gray-500">Nenhuma conexão ainda — clique em “Conectar novo WhatsApp” (1 clique) e leia o QR.</p>
            ) : (
              conexoes.map((c) => {
                const ativa = c.id === selId;
                const st = ativa && estado?.ok ? estado.status : c.status;
                return (
                  <div key={c.id} onClick={() => editar(c)} className={cn("flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-colors", ativa ? "border-gray-500 bg-white/10" : "border-gray-800 hover:border-gray-600")}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", st === "WORKING" ? "bg-emerald-400" : st === "SCAN_QR_CODE" || st === "STARTING" ? "bg-amber-400" : "bg-gray-600")} />
                      <span className="truncate text-[13.5px] font-medium text-white">{c.apelido ?? "Conexão"}</span>
                      <span className="shrink-0 text-[11px] text-gray-600">sessão {c.sessao}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[11px] text-gray-500">
                      <span>{ROTULO_STATUS[st] ?? st}</span>
                      <button onClick={(e) => { e.stopPropagation(); editar(c); }} title="Editar" className="text-gray-400 hover:text-white"><Pencil size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); iniciar(async () => { setErro(null); const r = await excluirConexao(c.id); if (!r.ok) setErro(r.erro); if (c.id === selId) editar(null); }); }} title="Excluir" className="text-red-400 hover:text-red-300"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Status + QR da conexão selecionada */}
          {sel && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13.5px] text-white">
                  {sel.apelido ?? "Conexão"}
                  {estado?.ok && estado.numero && <span className="text-gray-500"> · +{estado.numero}</span>}
                </p>
                <div className="flex gap-2">
                  {status === "WORKING" ? (
                    <Botao onClick={() => iniciar(async () => { await desconectarWhatsApp(sel.id); const e = await estadoWhatsApp(sel.id); setEstado(e); })}><LogOut size={13} /> Desconectar</Botao>
                  ) : (
                    <Botao className="btn-primario" onClick={() => iniciar(async () => {
                      setErro(null);
                      const r = await conectarWhatsApp(sel.id);
                      if (!r.ok) { setErro(r.erro); return; }
                      const e = await estadoWhatsApp(sel.id);
                      setEstado(e);
                    })}>{pendente ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />} Conectar</Botao>
                  )}
                </div>
              </div>
              {erro && <p className="mt-2 text-[13px] text-red-400">{erro}</p>}
              {estado && !estado.ok && <p className="mt-2 text-[13px] text-red-400">{estado.erro}</p>}
              {estado?.ok && estado.qr && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-xl bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estado.qr} alt="QR code do WhatsApp" className="h-52 w-52" />
                  <p className="flex items-center gap-1.5 text-[12.5px] text-gray-700"><Smartphone size={14} /> WhatsApp → Aparelhos conectados → Conectar</p>
                </div>
              )}
              {estado?.ok && estado.status === "SCAN_QR_CODE" && <PareamentoPorCodigo key={sel.id} conexaoId={sel.id} />}
              {status === "WORKING" && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-emerald-300/90"><Check size={13} /> Pronto: mensagens chegam no Inbox e a IA/Jarvis atende conforme a configuração abaixo.</p>
              )}
            </div>
          )}

          {/* Formulário de edição — a criação é 1 clique acima */}
          {sel && (
          <form action={enviar} key={sel.id} className="space-y-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">Editar conexão</p>
            <input type="hidden" name="id" value={sel.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Rotulo htmlFor="c-apelido">Apelido</Rotulo>
                <input id="c-apelido" name="apelido" defaultValue={sel.apelido ?? ""} placeholder="Ex.: Comercial, Suporte" className="campo" required />
              </div>
              <div>
                <Rotulo htmlFor="c-sessao">Sessão</Rotulo>
                <input id="c-sessao" name="sessao" defaultValue={sel.sessao} readOnly placeholder="default" className="campo opacity-60" />
                <p className="mt-1 text-[11.5px] text-gray-600">Sessão viva no WAHA — não muda na edição.</p>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="ia_ativa" defaultChecked={sel.ia_ativa} className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">IA (Jarvis) responde os clientes</span>
                <span className="block text-[12.5px] text-gray-500">Usa o agente ativo no admin. Em cada conversa você pode assumir e desligar a IA.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <input type="checkbox" name="distribuicao" defaultChecked={sel.distribuicao === "rodizio"} className="mt-1" />
              <span>
                <span className="block text-[14px] font-medium text-white">Rodízio de atendimento</span>
                <span className="block text-[12.5px] text-gray-500">Distribui conversas novas para quem tem menos atendimentos abertos.</span>
              </span>
            </label>
            <div>
              <Rotulo htmlFor="c-instr">Sobre o negócio (o que a IA deve saber)</Rotulo>
              <textarea id="c-instr" name="ia_instrucoes" rows={4} defaultValue={sel.ia_instrucoes} placeholder="Ex.: Somos a Loja X. Horário: seg–sex 9h–18h. Frete grátis acima de R$ 200." className="campo" />
            </div>
            <div className="flex items-center gap-3">
              <Botao type="submit" className="btn-primario" disabled={pendente}>
                {pendente ? <Loader2 size={13} className="animate-spin" /> : salvo ? <Check size={13} /> : null} Salvar alterações
              </Botao>
            </div>
          </form>
          )}
        </div>
      )}
    </Cartao>
  );
}

/* ---------------- Página ---------------- */
export function ConexoesView({ wahaPronto, conexoesWa, telegram, email, metaAds }: {
  wahaPronto: boolean;
  conexoesWa: ConexaoWaTela[];
  telegram: { status: string; username: string | null } | null;
  email: { endereco_envia: string | null } | null;
  metaAds: MetaAdsTela | null;
}) {
  const [erroMeta, setErroMeta] = useState<string | null>(null);
  const [salvoMeta, setSalvoMeta] = useState(false);
  const [pendente, iniciar] = useTransition();

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
        <CartaoWhats wahaPronto={wahaPronto} conexoes={conexoesWa} />

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
                <Botao className="text-red-400 hover:bg-red-500/10" onClick={() => iniciar(async () => { const r = await removerMetaAds(); if (!r.ok) setErroMeta(r.erro); })}>
                  <Trash2 size={13} /> Remover
                </Botao>
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
