"use client";

import { useState, useTransition } from "react";
import { Bot, Copy, ExternalLink, KeyRound, Pencil, Plus, Power, Trash2, Zap } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { ativarAgente, desativarAgentes, duplicarAgente, excluirAgente, salvarAgente, testarAgente, type EntradaAgente } from "@/app/admin/actions";
import { PRESETS, presetPorId } from "@/lib/ai/provedores";
import type { AgenteSeguro } from "@/lib/ai/agentes";
import { formatNum } from "@/lib/data/format";

type UsoAgente = Record<string, { pedidos: number; tokens: number; cache: number }>;

export function AgentesAdmin({ agentes, uso }: { agentes: AgenteSeguro[]; uso: UsoAgente }) {
  const [editando, setEditando] = useState<AgenteSeguro | "novo" | null>(null);
  const [pendente, iniciar] = useTransition();
  const [testes, setTestes] = useState<Record<string, { ok: boolean; t: string }>>({});
  const [testando, setTestando] = useState<string | null>(null);
  const ativo = agentes.find((a) => a.ativo);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px] text-gray-400">
          {ativo ? <>Em produção para os membros: <strong className="text-white">{ativo.nome}</strong></> : "Nenhum agente ativo — o chat está desligado para os membros."}
        </p>
        <div className="flex gap-2">
          {ativo && <button disabled={pendente} onClick={() => iniciar(async () => { await desativarAgentes(); })} className="btn btn-secundario btn-sm"><Power size={14} /> Desligar chat</button>}
          <button onClick={() => setEditando("novo")} className="btn btn-primario btn-sm"><Plus size={15} /> Novo agente</button>
        </div>
      </div>

      {agentes.length === 0 ? (
        <div className="painel"><Vazio icone={<Bot size={18} />} titulo="Nenhum agente cadastrado" texto="Cadastre um agente com o provedor e a chave de API que preferir." acao={<button onClick={() => setEditando("novo")} className="btn btn-primario btn-sm"><Plus size={15} /> Novo agente</button>} /></div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {agentes.map((a) => {
            const preset = presetPorId(a.preset);
            const u = uso[a.id];
            const teste = testes[a.id];
            return (
              <li key={a.id} className={cn("painel flex flex-col p-5", a.ativo && "border-white")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[16px] font-medium text-white">{a.nome}</h3>
                      {a.ativo && <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-black">Ativo</span>}
                    </div>
                    {a.descricao && <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{a.descricao}</p>}
                  </div>
                  <button disabled={pendente || a.ativo} onClick={() => iniciar(async () => { await ativarAgente(a.id); })} className={cn("btn btn-sm shrink-0", a.ativo ? "btn-fantasma" : "btn-secundario")}>
                    {a.ativo ? "Em uso" : "Usar este"}
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-3">
                  <div><dt className="text-gray-600">Provedor</dt><dd className="truncate text-gray-200">{preset.nome}</dd></div>
                  <div className="col-span-1 sm:col-span-2"><dt className="text-gray-600">Modelo</dt><dd className="truncate font-mono text-[12px] text-gray-200">{a.modelo}</dd></div>
                  <div><dt className="text-gray-600">Chave</dt><dd className="flex items-center gap-1 text-gray-200"><KeyRound size={11} /> {a.tem_chave ? a.api_key_final : a.provedor === "anthropic" ? "do servidor" : "nenhuma"}</dd></div>
                  <div><dt className="text-gray-600">Saída máx.</dt><dd className="text-gray-200 tabular">{formatNum(a.max_tokens)} tok</dd></div>
                  <div><dt className="text-gray-600">Teto/mês</dt><dd className="text-gray-200 tabular">{a.teto_tokens_mes ? `${formatNum(a.teto_tokens_mes)} tok` : "sem limite"}</dd></div>
                  <div><dt className="text-gray-600">Dados</dt><dd className="text-gray-200">{a.pode_editar_dados ? "lê e altera" : "só leitura"}</dd></div>
                </dl>

                <p className="mt-3 text-[12px] text-gray-500">
                  30 dias: {formatNum(u?.pedidos ?? 0)} conversas · {formatNum(u?.tokens ?? 0)} tokens{u?.cache ? ` · ${formatNum(u.cache)} em cache` : ""}
                </p>

                {teste && <p role="status" className={cn("mt-3 rounded-lg border px-3 py-2 text-[12.5px]", teste.ok ? "border-gray-700 text-white" : "border-gray-700 border-dashed text-gray-300")}>{teste.ok ? "✓" : "⚠"} {teste.t}</p>}

                <div className="mt-4 flex flex-wrap gap-1 border-t border-gray-800 pt-3">
                  <button
                    disabled={testando === a.id}
                    onClick={async () => {
                      setTestando(a.id);
                      const r = await testarAgente(a.id);
                      setTestes((t) => ({ ...t, [a.id]: r.ok ? { ok: true, t: `${r.resposta} — ${r.ms} ms, ${r.tokens} tokens` } : { ok: false, t: r.erro } }));
                      setTestando(null);
                    }}
                    className="btn btn-fantasma btn-sm"
                  >
                    <Zap size={14} /> {testando === a.id ? "Testando…" : "Testar"}
                  </button>
                  <button onClick={() => setEditando(a)} className="btn btn-fantasma btn-sm"><Pencil size={14} /> Editar</button>
                  <button disabled={pendente} onClick={() => iniciar(async () => { await duplicarAgente(a.id); })} className="btn btn-fantasma btn-sm"><Copy size={14} /> Duplicar</button>
                  <button disabled={pendente || a.ativo} onClick={() => { if (confirm(`Excluir o agente "${a.nome}"?`)) iniciar(async () => { await excluirAgente(a.id); }); }} className="btn btn-fantasma btn-sm ml-auto" title={a.ativo ? "Desative antes de excluir" : undefined}><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo aberto={editando !== null} aoFechar={() => setEditando(null)} titulo={editando === "novo" ? "Novo agente" : "Editar agente"} descricao="A chave é guardada criptografada e nunca volta para o navegador." largura={640}>
        {editando !== null && <FormAgente key={editando === "novo" ? "novo" : editando.id} agente={editando === "novo" ? null : editando} aoSalvar={() => setEditando(null)} />}
      </Dialogo>
    </>
  );
}

function FormAgente({ agente, aoSalvar }: { agente: AgenteSeguro | null; aoSalvar: () => void }) {
  const [presetId, setPresetId] = useState(agente?.preset ?? "anthropic");
  const preset = presetPorId(presetId);
  const [modelo, setModelo] = useState(agente?.modelo ?? preset.modelos[0] ?? "");
  const [baseUrl, setBaseUrl] = useState(agente?.base_url ?? preset.baseUrl ?? "");
  const [removerChave, setRemoverChave] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function trocarPreset(id: string) {
    const p = presetPorId(id);
    setPresetId(id);
    setModelo(p.modelos[0] ?? "");
    setBaseUrl(p.baseUrl ?? "");
  }

  return (
    <form
      action={(fd) => {
        const temp = String(fd.get("temperatura") ?? "").replace(",", ".");
        const entrada: EntradaAgente = {
          nome: String(fd.get("nome") ?? ""),
          descricao: String(fd.get("descricao") ?? "") || null,
          preset: presetId,
          base_url: preset.tipo === "openai" ? baseUrl : null,
          modelo,
          api_key: String(fd.get("api_key") ?? "") || null,
          remover_chave: removerChave,
          esforco: (String(fd.get("esforco") ?? "low") as "low"),
          max_tokens: Number(fd.get("max_tokens") ?? 1500),
          temperatura: temp ? Number(temp) : null,
          max_historico: Number(fd.get("max_historico") ?? 10),
          teto_tokens_mes: Number(fd.get("teto_tokens_mes")) > 0 ? Math.round(Number(fd.get("teto_tokens_mes"))) : null,
          teto_tokens_usuario_dia: Number(fd.get("teto_tokens_usuario_dia")) > 0 ? Math.round(Number(fd.get("teto_tokens_usuario_dia"))) : null,
          instrucoes: String(fd.get("instrucoes") ?? ""),
          pode_editar_dados: fd.get("pode_editar_dados") === "on",
        };
        iniciar(async () => {
          const r = await salvarAgente(agente?.id ?? null, entrada);
          if (r.ok) aoSalvar(); else setErro(r.erro);
        });
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Rotulo htmlFor="a-nome">Nome *</Rotulo><input id="a-nome" name="nome" required defaultValue={agente?.nome} className="campo" placeholder="Ex.: SDR Llama NVIDIA" autoFocus /></div>
        <div className="sm:col-span-2"><Rotulo htmlFor="a-desc">Descrição (os membros veem)</Rotulo><input id="a-desc" name="descricao" defaultValue={agente?.descricao ?? ""} className="campo" /></div>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-[12.5px] font-medium text-gray-300">Provedor e modelo</legend>
        <div>
          <Rotulo htmlFor="a-preset">Provedor</Rotulo>
          <select id="a-preset" value={presetId} onChange={(e) => trocarPreset(e.target.value)} className="campo">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {(preset.nota || preset.chaveUrl) && (
            <p className="mt-1.5 text-[12px] text-gray-500">
              {preset.nota} {preset.chaveUrl && <a href={preset.chaveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-gray-300 underline">obter chave <ExternalLink size={10} /></a>}
            </p>
          )}
        </div>
        {preset.tipo === "openai" && (
          <div><Rotulo htmlFor="a-url">URL base da API *</Rotulo><input id="a-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required className="campo font-mono !text-[13px]" placeholder="https://…/v1" /></div>
        )}
        <div>
          <Rotulo htmlFor="a-modelo">Modelo *</Rotulo>
          <input id="a-modelo" list="modelos-sugeridos" value={modelo} onChange={(e) => setModelo(e.target.value)} required className="campo font-mono !text-[13px]" placeholder="id do modelo no provedor" />
          <datalist id="modelos-sugeridos">{preset.modelos.map((m) => <option key={m} value={m} />)}</datalist>
          <p className="mt-1.5 text-[12px] text-gray-500">Escolha da lista ou digite qualquer id de modelo que o provedor aceite. O modelo precisa suportar chamada de ferramentas para ler/alterar dados.</p>
        </div>
        <div>
          <Rotulo htmlFor="a-chave">Chave de API {agente?.tem_chave && <span className="font-normal text-gray-500">(atual {agente.api_key_final} — deixe vazio para manter)</span>}</Rotulo>
          <input id="a-chave" name="api_key" type="password" autoComplete="off" className="campo font-mono !text-[13px]" placeholder={presetId === "anthropic" ? "vazio = usar ANTHROPIC_API_KEY do servidor" : "cole a chave aqui"} />
          {agente?.tem_chave && (
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-gray-400"><input type="checkbox" checked={removerChave} onChange={(e) => setRemoverChave(e.target.checked)} className="accent-white" /> Remover chave salva</label>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-gray-800 p-4">
        <legend className="px-1 text-[12.5px] font-medium text-gray-300">Economia de tokens</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Rotulo htmlFor="a-max">Saída máx. (tokens)</Rotulo>
            <input id="a-max" name="max_tokens" type="number" min={256} max={16000} step={128} defaultValue={agente?.max_tokens ?? 1500} className="campo tabular" />
          </div>
          <div>
            <Rotulo htmlFor="a-hist">Mensagens de memória</Rotulo>
            <input id="a-hist" name="max_historico" type="number" min={2} max={40} defaultValue={agente?.max_historico ?? 10} className="campo tabular" />
          </div>
          {preset.tipo === "anthropic" ? (
            <div>
              <Rotulo htmlFor="a-esf">Esforço</Rotulo>
              <select id="a-esf" name="esforco" defaultValue={agente?.esforco ?? "low"} className="campo">
                <option value="low">Baixo (econômico)</option><option value="medium">Médio</option><option value="high">Alto</option>
              </select>
            </div>
          ) : (
            <div>
              <Rotulo htmlFor="a-temp">Temperatura</Rotulo>
              <input id="a-temp" name="temperatura" inputMode="decimal" defaultValue={agente?.temperatura ?? ""} className="campo tabular" placeholder="padrão do modelo" />
              <input type="hidden" name="esforco" value={agente?.esforco ?? "low"} />
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="a-teto-mes">Teto do agente por mês (tokens)</Rotulo>
            <input id="a-teto-mes" name="teto_tokens_mes" type="number" min={0} step={10000} defaultValue={agente?.teto_tokens_mes ?? ""} className="campo tabular" placeholder="sem limite" />
          </div>
          <div>
            <Rotulo htmlFor="a-teto-dia">Teto por membro em 24h (tokens)</Rotulo>
            <input id="a-teto-dia" name="teto_tokens_usuario_dia" type="number" min={0} step={1000} defaultValue={agente?.teto_tokens_usuario_dia ?? ""} className="campo tabular" placeholder="sem limite" />
          </div>
        </div>
        <p className="text-[12px] text-gray-500">Menos memória e menor saída = conversas mais baratas. Claude usa cache de prompt automaticamente. Ao bater o teto, o chat avisa o membro e para de gastar.</p>
      </fieldset>

      <div>
        <Rotulo htmlFor="a-inst">Instruções do agente</Rotulo>
        <textarea id="a-inst" name="instrucoes" rows={5} maxLength={8000} defaultValue={agente?.instrucoes ?? ""} className="campo" placeholder="Tom de voz, foco, regras do seu negócio… (seja breve: cada palavra custa tokens em toda conversa)" />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-gray-800 p-4">
        <input type="checkbox" name="pode_editar_dados" defaultChecked={agente?.pode_editar_dados ?? true} className="mt-0.5 h-4 w-4 accent-white" />
        <span>
          <span className="block text-[13.5px] text-white">Pode alterar dados</span>
          <span className="block text-[12px] text-gray-500">Cadastrar leads, mudar status, abrir e mover negócios. Desmarcado = somente leitura. O agente sempre opera só nos dados do membro que está conversando.</span>
        </span>
      </label>

      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button>
        <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Salvando…" : "Salvar agente"}</button>
      </div>
    </form>
  );
}
