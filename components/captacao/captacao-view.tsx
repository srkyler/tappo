"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Pause, Play, Plus, Trash2, Webhook } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { alternarFonte, excluirFonte, salvarFonte } from "@/app/actions";
import { LEAD_ORIGEM, LEAD_STATUS } from "@/lib/data/types";
import { tempoRelativo } from "@/lib/data/format";

export type Fonte = {
  id: string; nome: string; token: string; origem: string; status_inicial: string;
  ativo: boolean; recebidos: number; ultimo_em: string | null;
};
export type LogWebhook = { id: string; source_id: string | null; ok: boolean; resultado: string | null; created_at: string };

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

export function CaptacaoView({ fontes, logs, origem }: { fontes: Fonte[]; logs: LogWebhook[]; origem: string }) {
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(fontes[0]?.id ?? null);
  const [pendente, iniciar] = useTransition();
  const sel = fontes.find((f) => f.id === aberta) ?? null;

  return (
    <>
      <div className="mb-5 flex justify-end">
        <button onClick={() => setNova(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Nova fonte</button>
      </div>

      {fontes.length === 0 ? (
        <div className="painel">
          <Vazio icone={<Webhook size={18} />} titulo="Nenhuma fonte de captação" texto="Crie uma fonte para receber leads automaticamente de landing pages, formulários, Zapier, Make ou n8n." acao={<button onClick={() => setNova(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Criar fonte</button>} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {fontes.map((f) => (
              <li key={f.id}>
                <button onClick={() => setAberta(f.id)} className={cn("painel w-full p-4 text-left transition-colors", aberta === f.id ? "border-white" : "hover:border-gray-600")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium text-white">{f.nome}</span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", f.ativo ? "bg-white" : "bg-gray-700")} title={f.ativo ? "Ativa" : "Pausada"} />
                  </div>
                  <p className="mt-1 text-[12px] text-gray-500">{f.recebidos} recebidos{f.ultimo_em ? ` · último ${tempoRelativo(f.ultimo_em)}` : ""}</p>
                </button>
              </li>
            ))}
          </ul>

          {sel && (
            <div className="space-y-4">
              <section className="painel p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-medium text-white">{sel.nome}</h2>
                    <p className="text-[12.5px] text-gray-500">Entra como <strong className="text-gray-300">{sel.status_inicial}</strong> · origem <strong className="text-gray-300">{sel.origem}</strong> · contato agendado para o mesmo dia</p>
                  </div>
                  <div className="flex gap-1">
                    <button disabled={pendente} onClick={() => iniciar(async () => { await alternarFonte(sel.id, !sel.ativo); })} className="btn btn-secundario btn-sm">
                      {sel.ativo ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Ativar</>}
                    </button>
                    <button disabled={pendente} onClick={() => { if (confirm("Excluir esta fonte? A URL deixa de funcionar.")) iniciar(async () => { await excluirFonte(sel.id); setAberta(null); }); }} className="btn btn-fantasma btn-sm" aria-label="Excluir fonte"><Trash2 size={14} /></button>
                  </div>
                </div>

                <Rotulo>URL de captação (POST)</Rotulo>
                <div className="flex gap-2">
                  <code className="campo flex items-center overflow-x-auto whitespace-nowrap font-mono !text-[12px]">{`${origem}/api/v1/webhooks/in/${sel.token}`}</code>
                  <Copiar texto={`${origem}/api/v1/webhooks/in/${sel.token}`} />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">Trate esta URL como senha: quem tiver ela consegue criar leads na sua base.</p>
              </section>

              <section className="painel p-5">
                <p className="mb-3 text-[14px] font-medium text-white">Como usar</p>
                <div className="space-y-4 text-[13px] text-gray-400">
                  <div>
                    <p className="mb-1.5">Campos aceitos (JSON ou formulário): <span className="font-mono text-[12px] text-gray-300">nome, empresa, email, telefone, cargo, segmento, mensagem</span>. Também entende <span className="font-mono text-[12px]">name, company, phone, whatsapp…</span></p>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-gray-300">Teste via terminal</span><Copiar rotulo="Copiar comando" texto={`curl -X POST ${origem}/api/v1/webhooks/in/${sel.token} -H "Content-Type: application/json" -d '{"nome":"Lead Teste","empresa":"Empresa X","email":"teste@empresax.com.br"}'`} /></div>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[11.5px] leading-relaxed text-gray-300">{`curl -X POST ${origem}/api/v1/webhooks/in/${sel.token.slice(0, 8)}… \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Lead Teste","empresa":"Empresa X","email":"teste@empresax.com.br"}'`}</pre>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-gray-300">Formulário HTML pronto</span><Copiar rotulo="Copiar HTML" texto={`<form action="${origem}/api/v1/webhooks/in/${sel.token}" method="POST">\n  <input name="nome" placeholder="Nome" required>\n  <input name="empresa" placeholder="Empresa">\n  <input name="email" type="email" placeholder="E-mail">\n  <input name="telefone" placeholder="WhatsApp">\n  <button type="submit">Quero falar com vendas</button>\n</form>`} /></div>
                    <p className="text-[12px] text-gray-500">Cole na sua landing page. No Zapier/Make/n8n, use uma ação “Webhook POST” com esta URL.</p>
                  </div>
                </div>
              </section>

              <section className="painel overflow-hidden">
                <p className="border-b border-gray-800 px-5 py-3 text-[14px] font-medium text-white">Últimos recebimentos</p>
                {logs.filter((l) => l.source_id === sel.id).length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-gray-500">Nada recebido ainda. Rode o teste acima.</p>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {logs.filter((l) => l.source_id === sel.id).slice(0, 15).map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                        <span className={cn("flex items-center gap-2", l.ok ? "text-gray-200" : "text-gray-500")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", l.ok ? "bg-white" : "border border-gray-500")} /> {l.resultado}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-gray-600">{tempoRelativo(l.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      <Dialogo aberto={nova} aoFechar={() => setNova(false)} titulo="Nova fonte de captação" descricao="Cada fonte gera uma URL própria — use uma por landing page ou integração.">
        <FormFonte aoSalvar={() => setNova(false)} />
      </Dialogo>
    </>
  );
}

function FormFonte({ aoSalvar }: { aoSalvar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form action={(fd) => iniciar(async () => { const r = await salvarFonte(null, fd); if (r.ok) aoSalvar(); else setErro(r.erro); })} className="space-y-4">
      <div><Rotulo htmlFor="f-nome">Nome *</Rotulo><input id="f-nome" name="nome" required className="campo" placeholder="Ex.: Landing Black Friday" autoFocus /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Rotulo htmlFor="f-origem">Origem</Rotulo><select id="f-origem" name="origem" defaultValue="Site" className="campo">{LEAD_ORIGEM.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><Rotulo htmlFor="f-status">Status inicial</Rotulo><select id="f-status" name="status_inicial" defaultValue="Nova" className="campo">{LEAD_STATUS.filter((s) => s !== "Perdido").map((o) => <option key={o}>{o}</option>)}</select></div>
      </div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button><button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Criando…" : "Criar fonte"}</button></div>
    </form>
  );
}
