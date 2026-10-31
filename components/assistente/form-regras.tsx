"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { salvarRegrasIA } from "@/app/app/assistente/actions";
import { DIAS_SEMANA, OBJETIVOS, type PerfilIA } from "@/lib/ai/assistente-tipos";

function Opcao({ nome, marcado, titulo, texto }: { nome: string; marcado: boolean; titulo: string; texto: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 p-3.5 hover:border-gray-700">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="mt-0.5" />
      <span>
        <span className="block text-[13px] font-medium text-white">{titulo}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500">{texto}</span>
      </span>
    </label>
  );
}

export function FormRegras({ perfil, gestor, perguntasQualificacao }: { perfil: PerfilIA; gestor: boolean; perguntasQualificacao: number }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [dias, setDias] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(DIAS_SEMANA.map((_, i) => [i, !!perfil.horario[String(i)]])));

  return (
    <form
      action={(fd) => iniciar(async () => {
        setSalvo(false);
        const r = await salvarRegrasIA(fd);
        if (r.ok) { setErro(null); setSalvo(true); } else setErro(r.erro);
      })}
      className="space-y-6"
    >
      <fieldset disabled={!gestor || pendente} className="space-y-6">
        <section className="painel space-y-4 p-5">
          <h2 className="text-[14px] font-medium text-white">Objetivo do atendimento</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(OBJETIVOS).map(([id, texto]) => (
              <label key={id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-800 p-3.5 text-[13px] text-gray-200 hover:border-gray-700 has-[:checked]:border-white">
                <input type="radio" name="objetivo" value={id} defaultChecked={perfil.objetivo === id} /> {texto}
              </label>
            ))}
          </div>
          <div>
            <label htmlFor="regras" className="mb-1 block text-[12.5px] font-medium text-gray-300">Regras da empresa</label>
            <p className="mb-1.5 text-[12px] text-gray-500">O que o assistente deve sempre ou nunca fazer. Têm prioridade sobre o padrão do segmento.</p>
            <textarea id="regras" name="regras" defaultValue={perfil.regras} rows={5} maxLength={4000} className="campo w-full resize-y leading-relaxed"
              placeholder={"Ex.:\n- Nunca dê desconto; quem negocia é o comercial.\n- Sempre peça o nome completo antes de agendar.\n- Não fale de concorrentes."} />
          </div>
        </section>

        <section className="painel space-y-4 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-white">Quando chamar alguém da equipe</h2>
            <p className="mt-1 text-[12.5px] text-gray-500">
              O assistente já transfere sozinho quando o cliente pede uma pessoa, reclama, quer negociar ou ele não sabe a resposta.
              A conversa vai para a fila do Inbox (com rodízio, se estiver ligado na conexão).
            </p>
          </div>
          <textarea name="transferir_quando" defaultValue={perfil.transferir_quando} rows={3} maxLength={2000} className="campo w-full resize-y leading-relaxed"
            placeholder="Ex.: Pedido acima de R$ 10 mil; cliente com dor ou urgência; pedido de nota fiscal." />
        </section>

        <section className="painel space-y-4 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-white">Horário da equipe humana</h2>
            <p className="mt-1 text-[12.5px] text-gray-500">O assistente atende 24h. Fora deste horário ele avisa que a equipe responde no próximo expediente. Sem nenhum dia marcado, ele não fala de horário.</p>
          </div>
          <div className="divide-y divide-gray-800 rounded-lg border border-gray-800">
            {DIAS_SEMANA.map((nome, i) => {
              const f = perfil.horario[String(i)];
              return (
                <div key={nome} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <label className="flex w-28 items-center gap-2 text-[13px] text-gray-200">
                    <input type="checkbox" name={`dia_${i}`} checked={dias[i]} onChange={(e) => setDias((d) => ({ ...d, [i]: e.target.checked }))} /> {nome}
                  </label>
                  {dias[i] ? (
                    <div className="flex items-center gap-2 text-[13px] text-gray-400">
                      <input type="time" name={`abre_${i}`} defaultValue={f?.[0] ?? "08:00"} className="campo w-[7.5rem]" aria-label={`${nome}: abre`} />
                      até
                      <input type="time" name={`fecha_${i}`} defaultValue={f?.[1] ?? "18:00"} className="campo w-[7.5rem]" aria-label={`${nome}: fecha`} />
                    </div>
                  ) : <span className="text-[12px] text-gray-600">Fechado</span>}
                </div>
              );
            })}
          </div>
          <div>
            <label htmlFor="fora_horario" className="mb-1.5 block text-[12.5px] font-medium text-gray-300">Recado para fora do horário (opcional)</label>
            <input id="fora_horario" name="fora_horario" defaultValue={perfil.fora_horario} maxLength={500} className="campo w-full"
              placeholder="Ex.: Nossa equipe volta amanhã às 8h, mas já deixo tudo anotado para eles!" />
          </div>
        </section>

        <section className="painel space-y-3 p-5">
          <h2 className="text-[14px] font-medium text-white">O que o assistente pode fazer sozinho</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            <Opcao nome="pode_criar_lead" marcado={perfil.pode_criar_lead} titulo="Cadastrar clientes no CRM"
              texto="Quando souber nome e interesse, cria (ou completa) o lead com o telefone da conversa." />
            <Opcao nome="pode_criar_tarefa" marcado={perfil.pode_criar_tarefa} titulo="Criar tarefas para a equipe"
              texto="Pedido de retorno, ligação, visita ou proposta vira tarefa para o responsável da conversa." />
            <Opcao nome="aprender_contatos" marcado={perfil.aprender_contatos} titulo="Lembrar de cada cliente"
              texto="Guarda fatos curtos (preferências, orçamento, interesse) para não perguntar de novo. Revise na aba Memória." />
            <Opcao nome="usar_qualificacao" marcado={perfil.usar_qualificacao} titulo="Fazer as perguntas de qualificação"
              texto={perguntasQualificacao
                ? `Usa as ${perguntasQualificacao} pergunta(s) ativas do seu segmento no Chatbot de Qualificação.`
                : "Nenhuma pergunta cadastrada para o seu segmento ainda."} />
          </div>
          <p className="text-[12px] text-gray-500">
            Edite as perguntas em <Link href="/app/chatbot-qualificacao" className="underline hover:text-gray-300">Chatbot de Qualificação</Link>. Ligue ou desligue a IA por conexão em <Link href="/app/conexoes" className="underline hover:text-gray-300">Conexões</Link>.
          </p>
        </section>

        <section className="painel space-y-3 p-5">
          <h3 className="text-[14px] font-semibold text-white">Follow-up automático</h3>
          <Opcao nome="followup_ativo" marcado={perfil.followup_ativo} titulo="Retomar com quem parou de responder"
            texto="No WhatsApp, a IA manda uma mensagem curta e personalizada (com base na conversa e na memória) para quem sumiu. Só dentro do horário de atendimento; para se o cliente encerrou o assunto." />
          <div className="grid max-w-md grid-cols-2 gap-3">
            <div>
              <label htmlFor="followup_dias" className="rotulo">Depois de quantos dias</label>
              <input id="followup_dias" name="followup_dias" type="number" min={1} max={30} defaultValue={perfil.followup_dias} className="campo mt-1 w-full" />
            </div>
            <div>
              <label htmlFor="followup_max" className="rotulo">Máximo de lembretes</label>
              <input id="followup_max" name="followup_max" type="number" min={0} max={5} defaultValue={perfil.followup_max} className="campo mt-1 w-full" />
            </div>
          </div>
        </section>
      </fieldset>

      {gestor && (
        <div className="flex items-center gap-3">
          <button disabled={pendente} className="btn btn-primario">{pendente ? "Salvando…" : "Salvar regras"}</button>
          {salvo && <span className="inline-flex items-center gap-1 text-[13px] text-gray-300"><Check size={14} /> Salvo.</span>}
          {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
        </div>
      )}
    </form>
  );
}
