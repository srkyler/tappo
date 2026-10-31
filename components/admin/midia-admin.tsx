"use client";

import { useState, useTransition } from "react";
import { Check, Image as ImageIcon, Loader2, Mic } from "lucide-react";
import { Rotulo } from "@/components/ui/base";
import { salvarMidiaConfig } from "@/app/admin/actions";

export type MidiaTela = {
  transcricao_ativa: boolean;
  transcricao_base_url: string;
  transcricao_modelo: string;
  tem_chave: boolean;
  visao_ativa: boolean;
  visao_agent_id: string | null;
};

/** Áudio e imagem no atendimento: qual API transcreve e qual agente lê imagens. */
export function MidiaAdmin({ cfg, agentes }: { cfg: MidiaTela | null; agentes: { id: string; nome: string; modelo: string }[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (!cfg) {
    return (
      <section className="painel p-5 text-[13px] text-gray-400">
        Áudio e imagem: rode a migration <code className="font-mono">20261101120000_fila_midia.sql</code> no Supabase para configurar.
      </section>
    );
  }
  return (
    <section className="painel p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><Mic size={15} /> Áudio e imagem no atendimento</h2>
      <p className="mt-1 text-[13px] text-gray-500">
        Desligado, a IA responde pedindo que o cliente escreva. Ligado, ela entende o áudio (transcrição) e a foto (descrição) e responde ao conteúdo.
      </p>
      <form
        className="mt-4 space-y-4"
        action={(fd) => iniciar(async () => {
          setSalvo(false);
          const r = await salvarMidiaConfig(fd);
          if (r.ok) { setErro(null); setSalvo(true); } else setErro(r.erro);
        })}
      >
        <div className="rounded-lg border border-gray-800 p-4">
          <label className="flex items-center gap-2 text-[13.5px] font-medium text-white">
            <input type="checkbox" name="transcricao_ativa" defaultChecked={cfg.transcricao_ativa} /> <Mic size={13} /> Transcrever áudios
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Rotulo htmlFor="tr-url">URL (compatível com OpenAI)</Rotulo>
              <input id="tr-url" name="transcricao_base_url" defaultValue={cfg.transcricao_base_url} className="campo" placeholder="https://api.groq.com/openai/v1" />
            </div>
            <div>
              <Rotulo htmlFor="tr-modelo">Modelo</Rotulo>
              <input id="tr-modelo" name="transcricao_modelo" defaultValue={cfg.transcricao_modelo} className="campo" placeholder="whisper-large-v3" />
            </div>
            <div className="sm:col-span-2">
              <Rotulo htmlFor="tr-chave">Chave da API {cfg.tem_chave && <span className="text-gray-500">(salva — deixe vazio para manter)</span>}</Rotulo>
              <input id="tr-chave" name="transcricao_chave" type="password" autoComplete="off" className="campo" placeholder={cfg.tem_chave ? "••••••••" : "gsk_… ou sk-…"} />
            </div>
            {cfg.tem_chave && (
              <label className="flex items-end gap-2 pb-2 text-[12.5px] text-gray-400"><input type="checkbox" name="remover_chave" /> Remover chave</label>
            )}
          </div>
          <p className="mt-2 text-[12px] text-gray-500">Groq (whisper-large-v3) é rápido e barato; OpenAI: https://api.openai.com/v1 + whisper-1.</p>
        </div>

        <div className="rounded-lg border border-gray-800 p-4">
          <label className="flex items-center gap-2 text-[13.5px] font-medium text-white">
            <input type="checkbox" name="visao_ativa" defaultChecked={cfg.visao_ativa} /> <ImageIcon size={13} /> Ler imagens (comprovantes, fotos de produto, prints)
          </label>
          <div className="mt-3 max-w-md">
            <Rotulo htmlFor="vi-agente">Agente que lê as imagens (precisa ter visão)</Rotulo>
            <select id="vi-agente" name="visao_agent_id" defaultValue={cfg.visao_agent_id ?? ""} className="campo">
              <option value="">O agente ativo</option>
              {agentes.map((a) => <option key={a.id} value={a.id}>{a.nome} — {a.modelo}</option>)}
            </select>
          </div>
          <p className="mt-2 text-[12px] text-gray-500">Claude, GPT-4o, Gemini e Llama Vision têm visão; modelos só de texto falham e a IA pede descrição ao cliente.</p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pendente} className="btn btn-primario btn-sm">{pendente && <Loader2 size={13} className="animate-spin" />} Salvar</button>
          {salvo && <span className="flex items-center gap-1 text-[12.5px] text-emerald-400"><Check size={13} /> Salvo</span>}
          {erro && <span className="text-[12.5px] text-red-400">{erro}</span>}
        </div>
      </form>
    </section>
  );
}
