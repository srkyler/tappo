"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo } from "@/components/ui/base";
import { salvarEmailConexao } from "@/app/inbox/email-actions";

export type EmailConexaoTela = {
  endereco_recebe: string | null;
  endereco_envia: string | null;
  ia_ativa: boolean;
  ia_instrucoes: string;
  webhook: string;
};

export function ConexaoEmail({ aberto, aoFechar, conexao }: { aberto: boolean; aoFechar: () => void; conexao: EmailConexaoTela | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  function enviar(f: FormData) {
    setErro(null); setSalvo(false);
    iniciar(async () => {
      const r = await salvarEmailConexao(f);
      if (!r.ok) setErro(r.erro);
      else setSalvo(true);
    });
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="E-mail" descricao="Receba e responda e-mails de clientes direto pelo inbox, via Resend." largura={560}>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <form action={enviar} className="space-y-4">
          <div>
            <Rotulo htmlFor="e-recebe">Endereço que recebe (ex.: atendimento@suaempresa.com)</Rotulo>
            <input id="e-recebe" name="endereco_recebe" type="email" defaultValue={conexao?.endereco_recebe ?? ""} placeholder="atendimento@suaempresa.com" className="campo" />
          </div>
          <div>
            <Rotulo htmlFor="e-envia">Endereço que envia as respostas</Rotulo>
            <input id="e-envia" name="endereco_envia" defaultValue={conexao?.endereco_envia ?? ""} placeholder="Atendimento <atendimento@suaempresa.com>" className="campo" />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
            <input type="checkbox" name="ia_ativa" defaultChecked={conexao?.ia_ativa ?? false} className="mt-1" />
            <span>
              <span className="block text-[14px] font-medium text-white">IA responde os e-mails</span>
              <span className="block text-[12.5px] text-gray-500">Usa o agente ativo no admin. Você pode assumir e desligar a IA em cada conversa.</span>
            </span>
          </label>
          <div>
            <Rotulo htmlFor="e-instr">Sobre o negócio (o que a IA deve saber)</Rotulo>
            <textarea id="e-instr" name="ia_instrucoes" rows={5} defaultValue={conexao?.ia_instrucoes ?? ""} placeholder="Ex.: Somos a Loja X. Horário: seg–sex 9h–18h." className="campo" />
          </div>
          {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
          <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : null} {salvo ? "Salvo" : "Salvar"}</button>
        </form>

        {conexao && (
          <section className="space-y-3 border-t border-gray-800 pt-5">
            <div>
              <p className="mb-1 text-[12px] text-gray-500">URL do webhook (cole em Resend → Domains → Inbound)</p>
              <div className="flex gap-2">
                <code className="campo flex items-center overflow-x-auto whitespace-nowrap text-[12px]">{conexao.webhook}</code>
                <button type="button" onClick={async () => { await navigator.clipboard.writeText(conexao.webhook); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="btn btn-secundario btn-sm shrink-0" aria-label="Copiar webhook">{copiado ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
              <p className="mt-1.5 text-[12px] text-gray-500">O Resend não tem API pra registrar isso automaticamente — é configuração manual, uma vez, no painel deles.</p>
              {/localhost|127\.0\.0\.1/.test(conexao.webhook) && <p className="mt-1.5 text-[12px] text-amber-400">Resend não alcança localhost. Use a URL pública do app (NEXT_PUBLIC_APP_URL).</p>}
            </div>
          </section>
        )}
      </div>
    </Dialogo>
  );
}
