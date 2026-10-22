"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { salvarChatbotQualificacao, excluirChatbotQualificacao } from "@/app/app/crm/actions";
import type { ChatbotQualificacao } from "@/lib/data/types";

export function FormPerguntaChatbot({ segmentoId, perguntas }: { segmentoId: string; perguntas: ChatbotQualificacao[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  function excluir(id: string) {
    if (!confirm("Excluir esta pergunta?")) return;
    setErro(null);
    setExcluindoId(id);
    iniciar(async () => {
      const r = await excluirChatbotQualificacao(id);
      if (!r.ok) setErro(r.erro ?? "Não foi possível excluir.");
      setExcluindoId(null);
    });
  }

  return (
    <>
      <div className="px-5 py-3">
        {perguntas.length === 0 ? (
          <p className="text-[12px] text-gray-500">Nenhuma pergunta configurada.</p>
        ) : (
          <div className="space-y-1">
            {perguntas.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-900/30 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-white">{p.pergunta}</p>
                  <p className="text-[10px] text-gray-500">{p.campo_resposta} · ordem {p.ordem}</p>
                </div>
                <button
                  onClick={() => excluir(p.id)}
                  disabled={pendente && excluindoId === p.id}
                  className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {erro && <p role="alert" className="mt-2 text-[11px] text-white">⚠ {erro}</p>}
      </div>

      <form
        action={(fd) => iniciar(async () => {
          const r = await salvarChatbotQualificacao(fd);
          if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
          else { setErro(null); (document.getElementById(`form-chatbot-${segmentoId}`) as HTMLFormElement | null)?.reset(); }
        })}
        id={`form-chatbot-${segmentoId}`}
        className="space-y-3 px-5 py-4"
      >
        <input type="hidden" name="segmento" value={segmentoId} />
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Pergunta</label>
          <input name="pergunta" placeholder="Ex.: Qual tratamento você procura?" className="campo w-full" required />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Campo resposta</label>
            <input name="campo_resposta" defaultValue="resposta" className="campo w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-gray-300">Ordem</label>
            <input name="ordem" type="number" min="1" defaultValue={perguntas.length + 1} className="campo w-full" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5">
              <input type="checkbox" name="obrigatoria" defaultChecked className="mt-1" />
              <span className="text-[11px] text-gray-400">Obrigatória</span>
            </label>
            <label className="mb-1 flex items-center gap-1.5">
              <input type="checkbox" name="ativa" defaultChecked className="mt-1" />
              <span className="text-[11px] text-gray-400">Ativa</span>
            </label>
          </div>
        </div>
        <button disabled={pendente} className="btn btn-primario btn-sm w-full">{pendente ? "Salvando…" : "Adicionar pergunta"}</button>
      </form>
    </>
  );
}
