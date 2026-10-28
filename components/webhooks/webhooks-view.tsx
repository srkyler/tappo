"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Pause, Play, Plus, RotateCw, Trash2, Webhook } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { tempoRelativo } from "@/lib/data/format";
import {
  alternarWebhookSaida, excluirWebhookSaida, regenerarSegredoWebhook,
  reenviarWebhookLog, salvarWebhookSaida,
} from "@/app/app/webhooks/actions";

export type WebhookSaidaTela = {
  id: string; url: string; eventos: string[]; ativo: boolean;
  secret: string | null; criado_em: string;
};
export type EnvioWebhookTela = {
  id: string; webhook_id: string; evento: string;
  status: number | null; erro: string | null; enviado_em: string;
};
type EventoInfo = { id: string; rotulo: string; dica: string };

function Copiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="btn btn-secundario btn-sm shrink-0"
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Copiado" : rotulo}
    </button>
  );
}

function badgeStatus(status: number | null) {
  if (status === null) return { cls: "bg-gray-800 text-gray-400", txt: "sem resposta" };
  if (status < 300) return { cls: "bg-gray-700 text-white", txt: `HTTP ${status}` };
  if (status < 500) return { cls: "bg-gray-800 text-gray-300 border border-gray-700", txt: `HTTP ${status}` };
  return { cls: "bg-gray-800 text-gray-500 border border-gray-700", txt: `HTTP ${status}` };
}

const VERIFICACAO_NODE = (segredo: string) => `const crypto = require("crypto");

// Verifique SEMPRE o corpo bruto, antes de JSON.parse
app.post("/tappo/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const esperado = crypto.createHmac("sha256", "${segredo || "<SEGREDO>"}").update(req.body).digest("hex");
  const h = Buffer.from(req.headers["x-tappo-assinatura"] || "");
  const e = Buffer.from(esperado);
  if (h.length !== e.length || !crypto.timingSafeEqual(h, e)) return res.sendStatus(401);

  const { evento, dados } = JSON.parse(req.body);
  if (evento === "lead.criado") { /* sua lógica */ }
  res.sendStatus(200); // responda 2xx em até 10s
});`;

export function WebhooksView({
  webhooks, logsPorWebhook, gestor, eventos,
}: {
  webhooks: WebhookSaidaTela[];
  logsPorWebhook: Map<string, EnvioWebhookTela[]>;
  gestor: boolean;
  eventos: EventoInfo[];
}) {
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(webhooks[0]?.id ?? null);
  const [pendente, iniciar] = useTransition();
  const sel = webhooks.find((w) => w.id === aberto) ?? null;
  const selLogs = (sel && logsPorWebhook.get(sel.id)) ?? [];

  return (
    <>
      {gestor && (
        <div className="mb-5 flex justify-end">
          <button onClick={() => setNovo(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Novo webhook</button>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="painel">
          <Vazio
            icone={<Webhook size={18} />}
            titulo="Nenhum webhook de saída"
            texto="Avisos automáticos para fora do Tappo: crie um webhook para enviar cada lead novo, mudança de etapa ou mensagem recebida direto para o seu sistema."
            acao={gestor ? <button onClick={() => setNovo(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Criar webhook</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="space-y-2">
            {webhooks.map((w) => (
              <li key={w.id}>
                <button onClick={() => setAberto(w.id)} className={cn("painel w-full p-4 text-left transition-colors", aberto === w.id ? "border-white" : "hover:border-gray-600")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium text-white">{new URL(w.url).host + (new URL(w.url).pathname !== "/" ? new URL(w.url).pathname : "")}</span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", w.ativo ? "bg-white" : "bg-gray-700")} title={w.ativo ? "Ativo" : "Pausado"} />
                  </div>
                  <p className="mt-1 truncate font-mono text-[11.5px] text-gray-500">{w.url}</p>
                  <p className="mt-1 text-[12px] text-gray-500">{w.eventos.length} evento{w.eventos.length === 1 ? "" : "s"} · criado {tempoRelativo(w.criado_em)}</p>
                </button>
              </li>
            ))}
          </ul>

          {sel && (
            <div className="space-y-4">
              <section className="painel p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-medium text-white">POST para a sua URL</h2>
                    <p className="text-[12.5px] text-gray-500">{sel.ativo ? "Enviando eventos agora." : "Pausado — nada é enviado até reativar."}</p>
                  </div>
                  {gestor && (
                    <div className="flex gap-1">
                      <button disabled={pendente} onClick={() => iniciar(async () => { await alternarWebhookSaida(sel.id, !sel.ativo); })} className="btn btn-secundario btn-sm">
                        {sel.ativo ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Ativar</>}
                      </button>
                      <button disabled={pendente} onClick={() => { if (confirm("Excluir este webhook? Os envios antigos no histórico também são apagados.")) iniciar(async () => { await excluirWebhookSaida(sel.id); setAberto(null); }); }} className="btn btn-fantasma btn-sm" aria-label="Excluir webhook"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                <Rotulo>URL de destino</Rotulo>
                <div className="flex gap-2">
                  <code className="campo flex items-center overflow-x-auto whitespace-nowrap font-mono !text-[12px]">{sel.url}</code>
                  <Copiar texto={sel.url} />
                </div>

                <div className="mt-4">
                  <Rotulo>Eventos enviados</Rotulo>
                  <div className="flex flex-wrap gap-1.5">
                    {sel.eventos.map((e) => (
                      <span key={e} className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-0.5 font-mono text-[11.5px] text-gray-300">{e}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Rotulo>Segredo de assinatura (HMAC-SHA256)</Rotulo>
                  {sel.secret ? (
                    <>
                      <div className="flex gap-2">
                        <code className="campo flex items-center overflow-x-auto whitespace-nowrap font-mono !text-[12px]">{sel.secret}</code>
                        <Copiar texto={sel.secret} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <p className="flex-1 text-[12px] text-gray-500">Header <span className="font-mono text-gray-300">x-tappo-assinatura</span> = HMAC-SHA256 do corpo bruto com este segredo. Guarde como senha.</p>
                        <button disabled={pendente} onClick={() => { if (confirm("Gerar um segredo novo? O segredo atual deixa de validar imediatamente — atualize a sua API.")) iniciar(async () => { await regenerarSegredoWebhook(sel.id); }); }} className="btn btn-secundario btn-sm shrink-0"><KeyRound size={14} /> Regenerar</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-gray-500">Visível só para o dono/gestor da empresa.</p>
                  )}
                </div>
              </section>

              <section className="painel overflow-hidden">
                <p className="border-b border-gray-800 px-5 py-3 text-[14px] font-medium text-white">Como verificar</p>
                <div className="space-y-4 px-5 py-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-gray-300">Corpo que enviamos</span><Copiar rotulo="Copiar JSON" texto={`{"evento":"lead.criado","dados":{"id":"…","nome":"Ana","empresa":"X","email":"ana@x.com","telefone":"…","origem":"Site","status":"Nova"},"enviado_em":"2026-10-28T12:00:00.000Z"}`} /></div>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[11.5px] leading-relaxed text-gray-300">{`{
  "evento": "lead.criado",
  "dados": { "id": "…", "nome": "Ana", "empresa": "X", … },
  "enviado_em": "2026-10-28T12:00:00.000Z"
}`}</pre>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-gray-300">Verificação (Node/Express)</span><Copiar rotulo="Copiar código" texto={VERIFICACAO_NODE(sel.secret ?? "")} /></div>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11.5px] leading-relaxed text-gray-300">{VERIFICACAO_NODE(sel.secret ?? "")}</pre>
                  </div>
                  <p className="text-[12px] text-gray-500">Headers: <span className="font-mono text-gray-300">x-tappo-evento</span>, <span className="font-mono text-gray-300">x-tappo-assinatura</span>. Respondemos a qualquer status 2xx como entregue; timeout de 10 segundos.</p>
                </div>
              </section>

              <section className="painel overflow-hidden">
                <p className="border-b border-gray-800 px-5 py-3 text-[14px] font-medium text-white">Últimos envios</p>
                {selLogs.length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-gray-500">Nada enviado ainda. Crie um lead novo para ver o evento por aqui.</p>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {selLogs.slice(0, 15).map((l) => {
                      const b = badgeStatus(l.status);
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[10.5px]", b.cls)}>{b.txt}</span>
                            <span className="truncate font-mono text-[12px] text-gray-300">{l.evento}</span>
                            {l.erro && <span className="truncate text-[11.5px] text-gray-600" title={l.erro}>{l.erro}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-[11.5px] text-gray-600">{tempoRelativo(l.enviado_em)}</span>
                            {gestor && (
                              <button disabled={pendente} onClick={() => iniciar(async () => { await reenviarWebhookLog(l.id); })} className="btn btn-fantasma btn-sm" title="Reenviar este evento"><RotateCw size={13} /></button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {gestor && (
        <Dialogo aberto={novo} aoFechar={() => setNovo(false)} titulo="Novo webhook de saída" descricao="O Tappo fará POST assinado (HMAC-SHA256) para a URL escolhida sempre que o evento ocorrer.">
          <FormWebhook eventos={eventos} aoSalvar={() => setNovo(false)} />
        </Dialogo>
      )}
    </>
  );
}

function FormWebhook({ eventos, aoSalvar }: { eventos: EventoInfo[]; aoSalvar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form action={(fd) => iniciar(async () => { const r = await salvarWebhookSaida(fd); if (r.ok) aoSalvar(); else setErro(r.erro); })} className="space-y-4">
      <div>
        <Rotulo htmlFor="w-url">URL de destino *</Rotulo>
        <input id="w-url" name="url" required type="url" className="campo font-mono !text-[13px]" placeholder="https://suaempresa.com.br/webhooks/tappo" autoFocus />
        <p className="mt-1.5 text-[12px] text-gray-500">Use https. Precisa responder 2xx em até 10 segundos.</p>
      </div>
      <fieldset>
        <Rotulo>Eventos *</Rotulo>
        <div className="space-y-2">
          {eventos.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-800 bg-gray-900/50 p-3 transition-colors hover:border-gray-700">
              <input type="checkbox" name="eventos" value={e.id} defaultChecked={e.id === "lead.criado"} className="mt-0.5 accent-white" />
              <span>
                <span className="block text-[13px] text-gray-200">{e.rotulo} <span className="font-mono text-[11.5px] text-gray-500">{e.id}</span></span>
                <span className="block text-[12px] text-gray-500">{e.dica}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button>
        <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Criando…" : "Criar webhook"}</button>
      </div>
    </form>
  );
}
