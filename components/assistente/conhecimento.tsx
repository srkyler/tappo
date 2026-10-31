"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, BookOpen, FileText, HelpCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Vazio, cn } from "@/components/ui/base";
import { Dialogo } from "@/components/ui/dialogo";
import { definirStatusConhecimento, excluirConhecimento, salvarConhecimento } from "@/app/app/assistente/actions";
import type { ItemConhecimento } from "@/lib/ai/assistente-tipos";

type Rascunho = { id: string | null; tipo: "faq" | "documento"; titulo: string; conteudo: string; origem: "manual" | "conversa" };
type Filtro = "ativo" | "sugerido" | "arquivado";

const MAX_CONTEUDO = 60000;

function Editor({ rascunho, aoFechar }: { rascunho: Rascunho; aoFechar: () => void }) {
  const [r, setR] = useState(rascunho);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!/\.(txt|md|csv)$/i.test(arquivo.name)) { setErro("Importe arquivos .txt, .md ou .csv. Para PDF/Word, copie e cole o texto."); return; }
    const txt = (await arquivo.text()).slice(0, MAX_CONTEUDO);
    setR((x) => ({ ...x, tipo: "documento", titulo: x.titulo || arquivo.name.replace(/\.[^.]+$/, ""), conteudo: txt }));
    setErro(null);
  }

  return (
    <form
      action={(fd) => iniciar(async () => {
        const res = await salvarConhecimento(fd);
        if (res.ok) aoFechar(); else setErro(res.erro);
      })}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={r.id ?? ""} />
      <input type="hidden" name="tipo" value={r.tipo} />
      <input type="hidden" name="origem" value={r.origem} />
      {!r.id && (
        <div className="grid grid-cols-2 gap-2">
          {(["faq", "documento"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setR((x) => ({ ...x, tipo: t }))}
              className={cn("rounded-lg border px-3 py-2.5 text-left text-[13px]", r.tipo === t ? "border-white text-white" : "border-gray-800 text-gray-400 hover:border-gray-700")}>
              <span className="block font-medium">{t === "faq" ? "Pergunta e resposta" : "Documento"}</span>
              <span className="mt-0.5 block text-[11.5px] text-gray-500">{t === "faq" ? "Dúvidas frequentes dos clientes" : "Catálogo, tabela, manual, roteiro"}</span>
            </button>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="k-titulo" className="mb-1.5 block text-[12.5px] font-medium text-gray-300">{r.tipo === "faq" ? "Pergunta do cliente" : "Título do documento"}</label>
        <input id="k-titulo" name="titulo" value={r.titulo} onChange={(e) => setR({ ...r, titulo: e.target.value })} maxLength={300} required className="campo w-full"
          placeholder={r.tipo === "faq" ? "Ex.: Vocês atendem aos sábados?" : "Ex.: Tabela de preços 2026"} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="k-conteudo" className="text-[12.5px] font-medium text-gray-300">{r.tipo === "faq" ? "Resposta" : "Conteúdo"}</label>
          {r.tipo === "documento" && (
            <label className="btn btn-fantasma btn-sm cursor-pointer">
              <Upload size={13} /> Importar .txt / .md
              <input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" className="sr-only" onChange={(e) => importar(e.target.files?.[0])} />
            </label>
          )}
        </div>
        <textarea id="k-conteudo" name="conteudo" value={r.conteudo} onChange={(e) => setR({ ...r, conteudo: e.target.value })}
          rows={r.tipo === "faq" ? 5 : 14} maxLength={MAX_CONTEUDO} required className="campo w-full resize-y leading-relaxed"
          placeholder={r.tipo === "faq" ? "Ex.: Sim! Aos sábados atendemos das 8h às 12h, só com horário marcado." : "Cole aqui o texto. Separe os assuntos com uma linha em branco — o assistente busca pelos trechos mais relevantes."} />
        <p className="mt-1 text-right font-mono text-[11px] text-gray-600">{r.conteudo.length.toLocaleString("pt-BR")} / {MAX_CONTEUDO.toLocaleString("pt-BR")}</p>
      </div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex gap-2">
        <button disabled={pendente} className="btn btn-primario flex-1">{pendente ? "Salvando…" : rascunho.id ? "Salvar" : "Adicionar à base"}</button>
        <button type="button" onClick={aoFechar} className="btn btn-secundario">Cancelar</button>
      </div>
    </form>
  );
}

export function Conhecimento({ itens, gestor, ensinar, aoUsarEnsinar }: {
  itens: ItemConhecimento[];
  gestor: boolean;
  /** Pergunta vinda do log de atividade para virar FAQ. */
  ensinar: string | null;
  aoUsarEnsinar: () => void;
}) {
  const [editando, setEditando] = useState<Rascunho | null>(() =>
    ensinar && gestor ? { id: null, tipo: "faq", titulo: ensinar.slice(0, 300), conteudo: "", origem: "conversa" } : null);
  const [filtro, setFiltro] = useState<Filtro>(() => (itens.some((i) => i.status === "sugerido") ? "sugerido" : "ativo"));
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const contagem = useMemo(() => ({
    ativo: itens.filter((i) => i.status === "ativo").length,
    sugerido: itens.filter((i) => i.status === "sugerido").length,
    arquivado: itens.filter((i) => i.status === "arquivado").length,
  }), [itens]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((i) => i.status === filtro && (!t || i.titulo.toLowerCase().includes(t) || i.conteudo.toLowerCase().includes(t)));
  }, [itens, filtro, busca]);

  const fechar = () => { setEditando(null); aoUsarEnsinar(); };
  const agir = (fn: () => Promise<{ ok: boolean; erro?: string }>) => iniciar(async () => {
    const r = await fn();
    setErro(r.ok ? null : (r.erro ?? "Não foi possível concluir."));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-gray-800 p-1">
          {(["ativo", "sugerido", "arquivado"] as Filtro[]).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={cn("rounded-md px-3 py-1.5 text-[12.5px] capitalize", filtro === f ? "bg-white font-medium text-black" : "text-gray-400 hover:text-white")}>
              {f === "ativo" ? "Ativos" : f === "sugerido" ? "Sugestões" : "Arquivados"} <span className="font-mono text-[11px] opacity-70">{contagem[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar…" className="campo w-full sm:w-56" aria-label="Filtrar conhecimento" />
          {gestor && (
            <button onClick={() => setEditando({ id: null, tipo: "faq", titulo: "", conteudo: "", origem: "manual" })} className="btn btn-primario shrink-0">
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>
      </div>

      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}

      {visiveis.length === 0 ? (
        <div className="painel">
          <Vazio
            icone={<BookOpen size={18} />}
            titulo={busca ? "Nada encontrado" : filtro === "ativo" ? "Sua base ainda está vazia" : filtro === "sugerido" ? "Nenhuma sugestão pendente" : "Nada arquivado"}
            texto={filtro === "ativo" && !busca
              ? "Comece pelas 5 perguntas que seus clientes mais fazem. Depois, cole sua tabela de preços ou catálogo como documento."
              : filtro === "sugerido" ? "Perguntas que o assistente não soube responder aparecem na aba Atividade — de lá você ensina a resposta com um clique." : undefined}
          />
        </div>
      ) : (
        <ul className="painel divide-y divide-gray-800">
          {visiveis.map((i) => (
            <li key={i.id} className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 text-gray-500">{i.tipo === "faq" ? <HelpCircle size={15} /> : <FileText size={15} />}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-white">{i.titulo}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12.5px] leading-relaxed text-gray-400">{i.conteudo}</p>
                <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-gray-600">
                  {i.tipo === "faq" ? "FAQ" : `Documento · ${i.conteudo.length.toLocaleString("pt-BR")} caracteres`}
                  {i.origem === "conversa" && " · veio de uma conversa"}
                  {i.usos > 0 && ` · usado ${i.usos}×`}
                </p>
              </div>
              {gestor && (
                <div className="flex shrink-0 gap-1">
                  <button aria-label="Editar" title={i.status === "sugerido" ? "Revisar e aprovar" : "Editar"} disabled={pendente}
                    onClick={() => setEditando({ id: i.id, tipo: i.tipo, titulo: i.titulo, conteudo: i.conteudo, origem: i.origem })}
                    className="btn btn-fantasma btn-sm"><Pencil size={13} /></button>
                  {i.status === "arquivado" ? (
                    <button aria-label="Reativar" title="Reativar" disabled={pendente} onClick={() => agir(() => definirStatusConhecimento(i.id, "ativo"))} className="btn btn-fantasma btn-sm"><ArchiveRestore size={13} /></button>
                  ) : (
                    <button aria-label="Arquivar" title="Arquivar (o assistente deixa de usar)" disabled={pendente} onClick={() => agir(() => definirStatusConhecimento(i.id, "arquivado"))} className="btn btn-fantasma btn-sm"><Archive size={13} /></button>
                  )}
                  <button aria-label="Excluir" title="Excluir" disabled={pendente} onClick={() => agir(() => excluirConhecimento(i.id))} className="btn btn-fantasma btn-sm"><Trash2 size={13} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        aberto={!!editando}
        aoFechar={fechar}
        titulo={editando?.id ? "Editar conhecimento" : "Ensinar algo ao assistente"}
        descricao="O assistente consulta isto para responder os clientes. Escreva como você responderia."
        largura={640}
      >
        {editando && <Editor key={editando.id ?? editando.titulo} rascunho={editando} aoFechar={fechar} />}
      </Dialogo>
    </div>
  );
}
