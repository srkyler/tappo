"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { salvarPerfilIA } from "@/app/app/assistente/actions";
import { TONS, type PerfilIA } from "@/lib/ai/assistente-tipos";

function Campo({ nome, rotulo, dica, valor, linhas = 4, max, placeholder }: {
  nome: string; rotulo: string; dica?: string; valor: string; linhas?: number; max: number; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={nome} className="mb-1 block text-[12.5px] font-medium text-gray-300">{rotulo}</label>
      {dica && <p className="mb-1.5 text-[12px] text-gray-500">{dica}</p>}
      <textarea id={nome} name={nome} defaultValue={valor} rows={linhas} maxLength={max} placeholder={placeholder} className="campo w-full resize-y leading-relaxed" />
    </div>
  );
}

export function FormPerfil({ perfil, nomeEmpresa, gestor }: { perfil: PerfilIA; nomeEmpresa: string; gestor: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      action={(fd) => iniciar(async () => {
        setSalvo(false);
        const r = await salvarPerfilIA(fd);
        if (r.ok) { setErro(null); setSalvo(true); } else setErro(r.erro);
      })}
      className="space-y-6"
    >
      <fieldset disabled={!gestor || pendente} className="space-y-6">
        <section className="painel space-y-4 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-white">Identidade do assistente</h2>
            <p className="mt-1 text-[12.5px] text-gray-500">Como ele se apresenta para os clientes da {nomeEmpresa}.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nome_assistente" className="mb-1.5 block text-[12.5px] font-medium text-gray-300">Nome</label>
              <input id="nome_assistente" name="nome_assistente" defaultValue={perfil.nome_assistente} maxLength={60} required className="campo w-full" placeholder="Ex.: Ana, Bia, Assistente Sorriso" />
            </div>
            <div>
              <label htmlFor="tom" className="mb-1.5 block text-[12.5px] font-medium text-gray-300">Tom de voz</label>
              <select id="tom" name="tom" defaultValue={perfil.tom} className="campo w-full">
                {Object.entries(TONS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </div>
          </div>
          <Campo nome="saudacao" rotulo="Saudação no primeiro contato" valor={perfil.saudacao} linhas={2} max={500}
            placeholder="Ex.: Olá! Aqui é a Ana, da Clínica Sorriso 😊 Como posso te ajudar hoje?" />
          <label className="flex items-center gap-2 text-[13px] text-gray-300">
            <input type="checkbox" name="usar_emojis" defaultChecked={perfil.usar_emojis} /> Pode usar emojis (com moderação)
          </label>
        </section>

        <section className="painel space-y-4 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-white">Sobre o negócio</h2>
            <p className="mt-1 text-[12.5px] text-gray-500">É daqui que o assistente tira as respostas. Se não estiver escrito aqui ou na base de conhecimento, ele não inventa — transfere para a equipe.</p>
          </div>
          <Campo nome="sobre" rotulo="O que a empresa faz" valor={perfil.sobre} max={4000}
            placeholder="Ex.: Clínica odontológica em Campinas desde 2012, com 6 dentistas. Atendemos particular e os convênios Amil e Bradesco Dental." />
          <Campo nome="produtos" rotulo="Produtos e serviços (com preços, se puder divulgar)" valor={perfil.produtos} linhas={6} max={8000}
            dica="Um por linha. Inclua o que está e o que NÃO está incluso."
            placeholder={"Ex.:\n- Avaliação inicial: gratuita\n- Limpeza: R$ 180\n- Clareamento: a partir de R$ 900 (definido na avaliação)\n- Não fazemos cirurgia ortognática"} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Campo nome="publico" rotulo="Público que vocês atendem" valor={perfil.publico} linhas={3} max={2000}
              placeholder="Ex.: Adultos e crianças a partir de 6 anos, região de Campinas." />
            <Campo nome="diferenciais" rotulo="Diferenciais" valor={perfil.diferenciais} linhas={3} max={2000}
              placeholder="Ex.: Atendimento aos sábados, sedação consciente, parcelamento em 12x." />
          </div>
          <Campo nome="politicas" rotulo="Políticas" valor={perfil.politicas} max={4000}
            dica="Pagamento, entrega, troca, cancelamento, garantia, remarcação."
            placeholder="Ex.: Pix, cartão em até 12x. Remarcação com 24h de antecedência sem custo. Falta sem aviso: cobramos R$ 50." />
          <Campo nome="contato" rotulo="Contato e localização" valor={perfil.contato} linhas={3} max={2000}
            placeholder="Ex.: Av. Brasil, 1200 — Centro, Campinas/SP. Estacionamento conveniado. Site: sorriso.com.br. Instagram: @clinicasorriso" />
        </section>
      </fieldset>

      {gestor && (
        <div className="flex items-center gap-3">
          <button disabled={pendente} className="btn btn-primario">{pendente ? "Salvando…" : "Salvar perfil"}</button>
          {salvo && <span className="inline-flex items-center gap-1 text-[13px] text-gray-300"><Check size={14} /> Salvo — o assistente já usa na próxima mensagem.</span>}
          {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
        </div>
      )}
    </form>
  );
}
