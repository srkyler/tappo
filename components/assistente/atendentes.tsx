"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Mail, MessageCircle, Pencil, Plus, Send, Star, Trash2 } from "lucide-react";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { Dialogo } from "@/components/ui/dialogo";
import { OBJETIVOS, TONS, type Atendente } from "@/lib/ai/assistente-tipos";
import { atribuirAtendenteCanal, excluirAtendente, salvarAtendente } from "@/app/app/assistente/actions";

export type CanalAtendente = {
  canal: "whatsapp" | "telegram" | "email";
  id: string;
  nome: string;
  status: string | null;
  atendente_id: string | null;
};

const ICONE_CANAL = { whatsapp: MessageCircle, telegram: Send, email: Mail };

/*
 * Vários atendentes de IA (estilo DeskcommCRM): cada um com nome, função e jeito
 * próprios, todos usando o conhecimento e a memória da empresa. Cada número/canal
 * escolhe quem atende; um atendente pode passar a conversa para outro.
 */
export function Atendentes({ atendentes, canais, gestor }: { atendentes: Atendente[]; canais: CanalAtendente[]; gestor: boolean }) {
  const [editando, setEditando] = useState<Atendente | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const padrao = atendentes.find((a) => a.padrao && a.ativo);

  return (
    <div className="space-y-6">
      <div className="painel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Atendentes de IA</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-gray-500">
              Crie quantos quiser — por exemplo “Ana, vendas” e “Leo, suporte”. Todos sabem o que está na base de conhecimento;
              cada um tem a própria função e jeito de falar, e um pode passar a conversa para o outro.
            </p>
          </div>
          {gestor && (
            <button onClick={() => setEditando("novo")} className="btn btn-primario btn-sm"><Plus size={14} /> Novo atendente</button>
          )}
        </div>

        {atendentes.length === 0 ? (
          <div className="mt-5">
            <Vazio
              icone={<Bot size={18} />}
              titulo="Nenhum atendente criado"
              texto="Sem atendentes, um assistente único responde com o nome e as regras das abas Empresa e Regras. Crie atendentes para ter vários, cada um num número ou assunto."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {atendentes.map((a) => {
              const atende = canais.filter((c) => c.atendente_id === a.id || (!c.atendente_id && a.padrao));
              return (
                <div key={a.id} className={cn("rounded-xl border p-4", a.ativo ? "border-gray-800" : "border-gray-900 opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-white">
                        <Bot size={14} className="text-gray-400" /> {a.nome}
                        {a.padrao && <span title="Atende os canais sem atendente definido" className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 px-1.5 text-[10.5px] text-amber-300"><Star size={9} /> padrão</span>}
                        {!a.ativo && <span className="rounded-full border border-gray-700 px-1.5 text-[10.5px] text-gray-400">pausado</span>}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-gray-500">{a.funcao || "Sem função definida"}</p>
                    </div>
                    {gestor && (
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => setEditando(a)} title="Editar" className="text-gray-400 hover:text-white"><Pencil size={13} /></button>
                        <button
                          title="Excluir"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => iniciar(async () => { setErro(null); const r = await excluirAtendente(a.id); if (!r.ok) setErro(r.erro); })}
                        ><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-gray-500">
                    {atende.length ? `Atende: ${atende.map((c) => c.nome).join(", ")}` : "Ainda não atende nenhum canal."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {erro && <p className="mt-3 text-[13px] text-red-400">{erro}</p>}
      </div>

      {atendentes.length > 0 && (
        <div className="painel p-5">
          <h2 className="text-[15px] font-semibold text-white">Quem atende cada canal</h2>
          <p className="mt-1 text-[13px] text-gray-500">
            “Padrão” = {padrao ? padrao.nome : "o assistente único (marque um atendente como padrão)"}. A IA só responde nos canais com IA ligada em Conexões.
          </p>
          {canais.length === 0 ? (
            <p className="mt-4 text-[13px] text-gray-500">Nenhum canal conectado ainda. Conecte o WhatsApp, Telegram ou e-mail em Conexões.</p>
          ) : (
            <div className="mt-4 divide-y divide-gray-800/70">
              {canais.map((c) => {
                const Icone = ICONE_CANAL[c.canal];
                return (
                  <div key={`${c.canal}-${c.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <p className="flex min-w-0 items-center gap-2 text-[13.5px] text-white">
                      <Icone size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate">{c.nome}</span>
                      {c.status && <span className={cn("text-[11px]", c.status === "WORKING" ? "text-emerald-400" : "text-gray-500")}>{c.status === "WORKING" ? "conectado" : c.status.toLowerCase()}</span>}
                    </p>
                    <select
                      disabled={!gestor || pendente}
                      defaultValue={c.atendente_id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        iniciar(async () => { setErro(null); const r = await atribuirAtendenteCanal(c.canal, c.id, v); if (!r.ok) setErro(r.erro); });
                      }}
                      className="campo w-auto min-w-[200px] py-1.5 text-[13px]"
                      aria-label={`Atendente de ${c.nome}`}
                    >
                      <option value="">Padrão{padrao ? ` (${padrao.nome})` : ""}</option>
                      {atendentes.filter((a) => a.ativo).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
          {pendente && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-500"><Loader2 size={12} className="animate-spin" /> Salvando…</p>}
        </div>
      )}

      {editando && (
        <FormAtendente
          atendente={editando === "novo" ? null : editando}
          primeiro={atendentes.length === 0}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function FormAtendente({ atendente: a, primeiro, aoFechar }: { atendente: Atendente | null; primeiro: boolean; aoFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={a ? `Editar ${a.nome}` : "Novo atendente de IA"} descricao="Campos vazios usam o que está nas abas Empresa e Regras." largura={640}>
      <form
        className="space-y-3"
        action={(fd) => iniciar(async () => {
          setErro(null);
          const r = await salvarAtendente(fd);
          if (!r.ok) setErro(r.erro); else aoFechar();
        })}
      >
        {a && <input type="hidden" name="id" value={a.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="at-nome">Nome</Rotulo>
            <input id="at-nome" name="nome" defaultValue={a?.nome ?? ""} placeholder="Ex.: Ana" maxLength={60} className="campo" required />
          </div>
          <div>
            <Rotulo htmlFor="at-funcao">Função</Rotulo>
            <input id="at-funcao" name="funcao" defaultValue={a?.funcao ?? ""} placeholder="Ex.: vendas e orçamentos" maxLength={200} className="campo" />
          </div>
          <div>
            <Rotulo htmlFor="at-tom">Tom</Rotulo>
            <select id="at-tom" name="tom" defaultValue={a?.tom ?? ""} className="campo">
              <option value="">Igual ao da empresa</option>
              {Object.entries(TONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Rotulo htmlFor="at-objetivo">Objetivo</Rotulo>
            <select id="at-objetivo" name="objetivo" defaultValue={a?.objetivo ?? ""} className="campo">
              <option value="">Igual ao da empresa</option>
              {Object.entries(OBJETIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Rotulo htmlFor="at-saudacao">Saudação</Rotulo>
          <input id="at-saudacao" name="saudacao" defaultValue={a?.saudacao ?? ""} placeholder="Ex.: Oi! Sou a Ana, do comercial. Como posso ajudar?" maxLength={500} className="campo" />
        </div>
        <div>
          <Rotulo htmlFor="at-instrucoes">Instruções deste atendente</Rotulo>
          <textarea id="at-instrucoes" name="instrucoes" defaultValue={a?.instrucoes ?? ""} rows={5} maxLength={8000} className="campo" placeholder="O que ele faz, o que não faz, como conduz a conversa…" />
        </div>
        <div>
          <Rotulo htmlFor="at-transferir">Passar para um humano quando…</Rotulo>
          <input id="at-transferir" name="transferir_quando" defaultValue={a?.transferir_quando ?? ""} maxLength={2000} className="campo" placeholder="Ex.: pedir desconto acima de 10% ou reclamar de cobrança" />
        </div>
        <div className="flex flex-wrap gap-5 pt-1 text-[13px] text-gray-300">
          <label className="flex items-center gap-2"><input type="checkbox" name="ativo" defaultChecked={a?.ativo ?? true} /> Ativo</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="padrao" defaultChecked={a?.padrao ?? primeiro} /> Padrão (atende canais sem atendente definido)</label>
        </div>
        {erro && <p className="text-[13px] text-red-400">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={aoFechar} className="btn btn-fantasma btn-sm">Cancelar</button>
          <button type="submit" disabled={pendente} className="btn btn-primario btn-sm">{pendente && <Loader2 size={13} className="animate-spin" />} Salvar</button>
        </div>
      </form>
    </Dialogo>
  );
}
