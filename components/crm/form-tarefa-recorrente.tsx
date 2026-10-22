"use client";

import { useState, useTransition } from "react";
import { salvarTarefaRecorrente } from "@/app/app/crm/actions";

export function FormTarefaRecorrente() {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarTarefaRecorrente(fd);
        if (r.ok) { setErro(null); (document.getElementById("form-tarefa-recorrente") as HTMLFormElement | null)?.reset(); }
        else setErro(r.erro ?? "Não foi possível salvar.");
      })}
      id="form-tarefa-recorrente"
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Título</label>
        <input name="titulo" placeholder="Ex.: Ligar para clientes inativos" className="campo w-full" required />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Descrição</label>
        <textarea name="descricao" rows={2} placeholder="O que fazer nesta tarefa…" className="campo w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Tipo</label>
          <select name="tipo" className="campo w-full">
            <option value="ligacao">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
            <option value="reuniao">Reunião</option>
            <option value="visita">Visita</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Prioridade</label>
          <select name="prioridade" className="campo w-full">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Recorrência</label>
          <select name="recorrencia" className="campo w-full">
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-gray-300">Próxima execução</label>
          <input name="proxima_execucao" type="datetime-local" className="campo w-full" required />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
        <input type="checkbox" name="ativa" defaultChecked className="mt-1" />
        <span>
          <span className="block text-[14px] font-medium text-white">Tarefa ativa</span>
          <span className="block text-[12.5px] text-gray-500">Quando inativa, não gera novas tarefas.</span>
        </span>
      </label>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Salvar tarefa recorrente"}</button>
    </form>
  );
}
