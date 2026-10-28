"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, Check, Copy, Loader2, Pencil, Plus, Sparkles, Star, Trash2, Zap,
} from "lucide-react";
import { Cabecalho, Kpi, Rotulo, cn } from "@/components/ui/base";
import { PRESETS, presetPorId } from "@/lib/ai/provedores";
import type { AgenteSeguro } from "@/lib/ai/agentes";
import {
  ativarAgente, desativarAgentes, duplicarAgente, excluirAgente, salvarAgente, testarAgente,
  type EntradaAgente,
} from "@/app/admin/actions";

type Uso = Record<string, { pedidos: number; tokens: number; cache: number }>;
type Resultado = { estado: "ok" | "erro"; txt: string; ms?: number };

const nf = new Intl.NumberFormat("pt-BR");

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-400">{titulo}</h3>
        {descricao && <p className="text-[12.5px] text-gray-600">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export function AgentesView({ agentes, uso, totalTokens, totalPedidos }: {
  agentes: AgenteSeguro[]; uso: Uso; totalTokens: number; totalPedidos: number;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null | undefined>(undefined); // undefined = fechado, null = novo
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const alvo = editando === undefined ? null : agentes.find((a) => a.id === editando) ?? null;
  const ehNovo = editando === null;
  const ativo = agentes.find((a) => a.ativo);

  function executar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Erro inesperado.");
      else { setSalvo(true); setTimeout(() => setSalvo(false), 2000); router.refresh(); }
    });
  }

  function enviar(f: FormData) {
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const n = (k: string) => { const v = s(k); return v === "" ? null : Number(v); };
    const entrada: EntradaAgente = {
      nome: s("nome"),
      descricao: s("descricao") || null,
      preset: s("preset"),
      base_url: s("base_url") || null,
      modelo: s("modelo"),
      api_key: s("api_key") || null,
      remover_chave: f.get("remover_chave") === "on",
      esforco: (s("esforco") || "medium") as EntradaAgente["esforco"],
      max_tokens: Number(s("max_tokens") || 1500),
      temperatura: n("temperatura"),
      max_historico: Number(s("max_historico") || 20),
      teto_tokens_mes: n("teto_tokens_mes"),
      teto_tokens_usuario_dia: n("teto_tokens_usuario_dia"),
      instrucoes: String(f.get("instrucoes") ?? ""),
      pode_editar_dados: f.get("pode_editar_dados") === "on",
    };
    executar(() => salvarAgente(editando ?? null, entrada));
  }

  function testar(a: AgenteSeguro) {
    setResultados((r) => ({ ...r, [a.id]: { estado: "ok", txt: "Testando conexão…" } }));
    iniciar(async () => {
      const r = await testarAgente(a.id);
      setResultados((prev) => ({
        ...prev,
        [a.id]: r.ok
          ? { estado: "ok", txt: r.resposta ?? "(sem texto)", ms: r.ms }
          : { estado: "erro", txt: r.erro ?? "Falha no teste." },
      }));
    });
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        rotulo="Administração"
        titulo="Agentes de IA"
        descricao="Crie e gerencie os atendentes de IA do Tappo (qualquer provedor: Claude, NVIDIA NIM, OpenAI, Groq, OpenRouter…). Só administradores têm acesso — membros nem veem esta área."
        acoes={(
          <button onClick={() => { setErro(null); setEditando(null); }} className="btn btn-primario">
            <Plus size={15} /> Novo agente
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi rotulo="Agentes" valor={nf.format(agentes.length)} />
        <Kpi rotulo="Em atendimento" valor={ativo?.nome ?? "Nenhum"} detalhe={ativo ? `${ativo.modelo} · ${ativo.preset}` : "Ative um agente"} />
        <Kpi rotulo="Conversas · 30d" valor={nf.format(totalPedidos)} />
        <Kpi rotulo="Tokens · 30d" valor={nf.format(totalTokens)} detalhe="entrada + saída (sem cache)" />
      </div>

      {erro && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {agentes.map((a) => {
          const u = uso[a.id] ?? { pedidos: 0, tokens: 0, cache: 0 };
          const res = resultados[a.id];
          return (
            <section key={a.id} className={cn("flex flex-col rounded-xl border bg-gray-900/40 p-5", a.ativo ? "border-emerald-500/40" : "border-gray-800")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-gray-950 text-gray-300"><Brain size={17} /></div>
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 truncate text-[15px] font-semibold text-white">
                      {a.nome}
                      {a.ativo && <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-300"><Star size={10} /> Ativo</span>}
                    </h2>
                    <p className="line-clamp-2 text-[12.5px] text-gray-500">{a.descricao || "Sem descrição."}</p>
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid gap-1.5 border-t border-gray-800 pt-3 text-[12.5px]">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Inteligência</dt><dd className="truncate font-mono text-gray-200">{a.modelo}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Chave</dt><dd className="text-gray-300">{a.tem_chave ? `••••${(a.api_key_final ?? "").slice(-4)}` : "sem chave própria"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Uso · 30d</dt><dd className="text-gray-300">{nf.format(u.pedidos)} conversas · {nf.format(u.tokens)} tokens</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Permissões</dt><dd className="text-gray-300">{a.pode_editar_dados ? "pode editar dados do CRM" : "somente leitura"}</dd></div>
              </dl>

              {res && (
                <p className={cn("mt-3 rounded-lg border px-3 py-2 text-[12.5px]",
                  res.estado === "erro" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-gray-800 bg-gray-950/60 text-gray-300")}>
                  <Sparkles size={11} className="mr-1 inline" />
                  {res.txt}
                  {res.estado === "ok" && res.ms ? <span className="text-gray-600"> · {res.ms}ms</span> : null}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                {!a.ativo && (
                  <button onClick={() => executar(() => ativarAgente(a.id))} disabled={pendente} className="btn btn-primario btn-sm"><Star size={13} /> Ativar</button>
                )}
                <button onClick={() => testar(a)} disabled={pendente} className="btn btn-secundario btn-sm"><Zap size={13} /> Testar</button>
                <button onClick={() => { setErro(null); setEditando(a.id); }} className="btn btn-secundario btn-sm"><Pencil size={13} /> Editar</button>
                <button onClick={() => executar(() => duplicarAgente(a.id))} disabled={pendente} className="btn btn-secundario btn-sm"><Copy size={13} /> Duplicar</button>
                <button
                  onClick={() => { if (confirm(`Excluir o agente “${a.nome}”? Esta ação não pode ser desfeita.`)) executar(() => excluirAgente(a.id)); }}
                  disabled={pendente}
                  className="btn btn-fantasma btn-sm text-red-400 hover:bg-red-500/10"
                ><Trash2 size={13} /></button>
              </div>
            </section>
          );
        })}

        {agentes.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-800 px-6 py-10 text-center">
            <p className="text-[14px] text-gray-400">Nenhum agente ainda.</p>
            <p className="mt-1 text-[13px] text-gray-600">Crie o primeiro — depois ative-o para o Jarvis atender no WhatsApp.</p>
          </div>
        )}
      </div>

      {ativo && (
        <button onClick={() => executar(() => desativarAgentes())} disabled={pendente} className="btn btn-fantasma btn-sm text-gray-500">
          Desativar todos (nenhum agente atende)
        </button>
      )}

      {/* ---------------- Modal de criação/edição ---------------- */}
      {editando !== undefined && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-[8vh] backdrop-blur-sm" onClick={() => setEditando(undefined)}>
          <div className="w-full max-w-[720px] rounded-2xl border border-gray-800 bg-[#0C0C0C] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-white">{ehNovo ? "Novo agente" : `Editar · ${alvo?.nome}`}</h2>
              <button onClick={() => setEditando(undefined)} className="btn btn-fantasma btn-sm">Fechar</button>
            </div>

            <form action={enviar} key={editando ?? "novo"} className="space-y-6">
              <Secao titulo="Quem é este agente">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Rotulo htmlFor="ag-nome">Nome</Rotulo>
                    <input id="ag-nome" name="nome" required maxLength={80} defaultValue={alvo?.nome ?? ""} placeholder="Ex.: Fiver — Vendas" className="campo" />
                  </div>
                  <div>
                    <Rotulo htmlFor="ag-desc">Descrição</Rotulo>
                    <input id="ag-desc" name="descricao" maxLength={300} defaultValue={alvo?.descricao ?? ""} placeholder="O que este agente faz" className="campo" />
                  </div>
                </div>
              </Secao>

              <PresetCampos alvo={alvo} />

              <Secao titulo="As instruções dele" descricao="O system prompt — quem ele é, como fala, regras do negócio.">
                <textarea id="ag-instr" name="instrucoes" rows={8} defaultValue={alvo?.instrucoes ?? ""} placeholder="Você é o assistente de vendas da … Responda em português, seja direto…" className="campo font-mono !text-[13px]" />
              </Secao>

              <Secao titulo="Freios de segurança" descricao="Limites de tokens e histórico — evitam surpresas de custo.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Rotulo htmlFor="ag-maxtok">Máx. tokens/resposta</Rotulo>
                    <input id="ag-maxtok" name="max_tokens" type="number" min={256} max={16000} defaultValue={alvo?.max_tokens ?? 1500} className="campo font-mono !text-[13px]" />
                  </div>
                  <div>
                    <Rotulo htmlFor="ag-temp">Temperatura</Rotulo>
                    <input id="ag-temp" name="temperatura" type="number" step="0.1" min={0} max={2} defaultValue={alvo?.temperatura ?? ""} placeholder="padrão do modelo" className="campo font-mono !text-[13px]" />
                  </div>
                  <div>
                    <Rotulo htmlFor="ag-hist">Mensagens de histórico</Rotulo>
                    <input id="ag-hist" name="max_historico" type="number" min={2} max={40} defaultValue={alvo?.max_historico ?? 20} className="campo font-mono !text-[13px]" />
                  </div>
                  <div>
                    <Rotulo htmlFor="ag-teto">Teto de tokens/mês</Rotulo>
                    <input id="ag-teto" name="teto_tokens_mes" type="number" min={1} defaultValue={alvo?.teto_tokens_mes ?? ""} placeholder="sem teto" className="campo font-mono !text-[13px]" />
                  </div>
                  <div>
                    <Rotulo htmlFor="ag-tetodia">Teto tokens/usuário/dia</Rotulo>
                    <input id="ag-tetodia" name="teto_tokens_usuario_dia" type="number" min={1} defaultValue={alvo?.teto_tokens_usuario_dia ?? ""} placeholder="sem teto" className="campo font-mono !text-[13px]" />
                  </div>
                </div>
              </Secao>

              <Secao titulo="Permissões">
                <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
                  <input type="checkbox" name="pode_editar_dados" defaultChecked={alvo?.pode_editar_dados ?? true} className="mt-1" />
                  <span>
                    <span className="block text-[14px] font-medium text-white">Pode editar dados do CRM</span>
                    <span className="block text-[12.5px] text-gray-500">Cria/edita leads, tarefas e move negócios no funil. Desligue para respostas “somente leitura”.</span>
                  </span>
                </label>
              </Secao>

              {erro && <p className="text-[13px] text-red-400">{erro}</p>}

              <div className="flex items-center gap-3 border-t border-gray-800 pt-4">
                <button type="submit" disabled={pendente} className="btn btn-primario">
                  {pendente ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : null} Salvar
                </button>
                <button type="button" onClick={() => setEditando(undefined)} className="btn btn-secundario">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* Campos de inteligência: provedor, modelo, URL base, chave e esforço. */
function PresetCampos({ alvo }: { alvo: AgenteSeguro | null }) {
  const [preset, setPreset] = useState(alvo?.preset ?? "anthropic");
  const p = presetPorId(preset);
  const alterando = alvo?.preset === preset;

  return (
    <Secao titulo="A inteligência que ele usa" descricao="Provedor + modelo. A chave fica cifrada no servidor (nunca volta pra tela).">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="ag-preset">Provedor</Rotulo>
          <select id="ag-preset" name="preset" value={preset} onChange={(e) => setPreset(e.target.value)} className="campo">
            {PRESETS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
        <div>
          <Rotulo htmlFor="ag-modelo">Modelo</Rotulo>
          <input id="ag-modelo" name="modelo" list="ag-modelos" required defaultValue={alterando ? alvo.modelo : p.modelos[0] ?? ""} placeholder={p.modelos[0] ?? "nome-do-modelo"} className="campo font-mono !text-[13px]" />
          <datalist id="ag-modelos">{p.modelos.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        {p.tipo === "openai" && (
          <div className="sm:col-span-2">
            <Rotulo htmlFor="ag-base">URL base da API</Rotulo>
            <input id="ag-base" key={`base-${preset}`} name="base_url" defaultValue={(alterando && alvo.base_url) || p.baseUrl || ""} placeholder="https://…" className="campo font-mono !text-[13px]" />
            {p.chaveUrl && <p className="mt-1 text-[11.5px] text-gray-600">Chave em: {p.chaveUrl}</p>}
          </div>
        )}
        <div>
          <Rotulo htmlFor="ag-chave">Chave de API</Rotulo>
          <input id="ag-chave" name="api_key" type="password" autoComplete="new-password" placeholder={alvo?.tem_chave ? "•••••• (vazio mantém a atual)" : "sk-… / nvapi-…"} className="campo font-mono !text-[13px]" />
        </div>
        <div className="flex items-end pb-1">
          {alvo?.tem_chave && (
            <label className="flex items-center gap-2 text-[13px] text-gray-400">
              <input type="checkbox" name="remover_chave" /> Remover chave atual
            </label>
          )}
        </div>
        <div>
          <Rotulo htmlFor="ag-esforco">Esforço de raciocínio</Rotulo>
          <select id="ag-esforco" name="esforco" defaultValue={alvo?.esforco ?? "medium"} className="campo">
            <option value="low">Rápido (low)</option>
            <option value="medium">Equilibrado (medium)</option>
            <option value="high">Profundo (high)</option>
          </select>
        </div>
      </div>
      {p.nota && <p className="text-[12px] text-gray-600">{p.nota}</p>}
    </Secao>
  );
}
