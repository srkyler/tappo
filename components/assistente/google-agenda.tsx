"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { desconectarGoogleAgenda, salvarAgendaIA } from "@/app/app/assistente/actions";

export type AgendaIA = {
  disponivel: boolean;
  conectada: { email: string | null; duracao_min: number; antecedencia_horas: number; dias_a_frente: number; ativo: boolean } | null;
};

const AVISOS: Record<string, [string, boolean]> = {
  conectada: ["Google Agenda conectada.", true],
  cancelado: ["Conexão cancelada na tela do Google.", false],
  expirado: ["O link de conexão expirou. Tente de novo.", false],
  sem_permissao: ["Só o dono ou um gestor pode conectar a agenda.", false],
  indisponivel: ["A integração com o Google ainda não foi habilitada na plataforma.", false],
  erro: ["Não foi possível conectar. Tente de novo em instantes.", false],
};

/** Google Agenda da empresa: a IA oferece horários livres e marca reuniões sozinha. */
export function GoogleAgenda({ agenda, gestor }: { agenda: AgendaIA; gestor: boolean }) {
  const aviso = AVISOS[useSearchParams().get("agenda") ?? ""];
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const c = agenda.conectada;

  return (
    <section className="painel mb-6 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><CalendarCheck size={15} /> Agendamento pela IA (Google Agenda)</h2>
      <p className="mt-1 text-[13px] text-gray-500">
        Com a agenda conectada, a IA consulta seus horários livres (dentro do horário de atendimento abaixo), marca a reunião no Google
        e cria uma tarefa no CRM para a equipe.
      </p>
      {aviso && <p className={`mt-2 text-[13px] ${aviso[1] ? "text-emerald-300" : "text-amber-300"}`}>{aviso[0]}</p>}

      {!agenda.disponivel && !c ? (
        <p className="mt-3 text-[13px] text-gray-400">Disponível em breve — a administração da plataforma ainda não habilitou o Google.</p>
      ) : !c ? (
        gestor
          ? <a href="/api/integracoes/google/iniciar" className="btn btn-primario btn-sm mt-3 inline-flex">Conectar Google Agenda</a>
          : <p className="mt-3 text-[13px] text-gray-400">Peça a um gestor para conectar a agenda da empresa.</p>
      ) : (
        <form
          className="mt-4 space-y-4"
          action={(fd) => iniciar(async () => {
            setErro(null); setSalvo(false);
            const r = await salvarAgendaIA(fd);
            if (!r.ok) setErro(r.erro); else setSalvo(true);
          })}
        >
          <p className="text-[13px] text-gray-300">
            Conectada{c.email ? <> como <span className="text-white">{c.email}</span></> : null}.
            {!c.ativo && <span className="ml-1 text-amber-300">A IA não está marcando reuniões (desligado ou acesso revogado no Google).</span>}
          </p>
          <fieldset disabled={!gestor || pendente} className="grid gap-3 sm:grid-cols-3">
            <label className="text-[13px] text-gray-400">Duração da reunião (min)
              <input type="number" name="duracao_min" min={10} max={240} step={5} defaultValue={c.duracao_min} className="campo mt-1 w-full" />
            </label>
            <label className="text-[13px] text-gray-400">Antecedência mínima (horas)
              <input type="number" name="antecedencia_horas" min={0} max={168} defaultValue={c.antecedencia_horas} className="campo mt-1 w-full" />
            </label>
            <label className="text-[13px] text-gray-400">Marcar até quantos dias à frente
              <input type="number" name="dias_a_frente" min={1} max={60} defaultValue={c.dias_a_frente} className="campo mt-1 w-full" />
            </label>
            <label className="flex items-center gap-2 text-[13px] text-gray-300 sm:col-span-3">
              <input type="checkbox" name="ativo" defaultChecked={c.ativo} /> A IA pode marcar reuniões nesta agenda
            </label>
          </fieldset>
          {erro && <p className="text-[13px] text-red-400">{erro}</p>}
          {salvo && <p className="text-[13px] text-emerald-300">Salvo.</p>}
          {gestor && (
            <div className="flex gap-2">
              <button type="submit" disabled={pendente} className="btn btn-primario btn-sm">{pendente && <Loader2 size={13} className="animate-spin" />} Salvar</button>
              <a href="/api/integracoes/google/iniciar" className="btn btn-secundario btn-sm">Reconectar</a>
              <button
                type="button"
                disabled={pendente}
                onClick={() => iniciar(async () => {
                  const r = await desconectarGoogleAgenda();
                  if (!r.ok) setErro(r.erro);
                })}
                className="btn btn-fantasma btn-sm"
              >Desconectar</button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
