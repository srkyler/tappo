"use client";

import { useState, useTransition } from "react";
import { Rotulo } from "@/components/ui/base";
import { salvarPromocao } from "@/app/app/marketing/actions";
import type { SugestaoPromocao } from "@/lib/marketing/sugestoes-promocao";

export function FormPromocao({ sugestoes, aoSalvar }: { sugestoes: SugestaoPromocao[]; aoSalvar?: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [oferta, setOferta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function aplicarSugestao(s: SugestaoPromocao) {
    setTitulo(s.titulo);
    setOferta(s.oferta);
    setDescricao(s.descricao);
  }

  return (
    <form
      action={(fd) => iniciar(async () => {
        const r = await salvarPromocao(null, fd);
        if (r.ok) {
          setErro(null); setTitulo(""); setOferta(""); setDescricao("");
          (document.getElementById("form-promocao") as HTMLFormElement | null)?.reset();
          aoSalvar?.();
        } else setErro(r.erro);
      })}
      id="form-promocao"
      className="space-y-3"
    >
      {sugestoes.length > 0 && (
        <div>
          <Rotulo>Sugestões pro seu segmento</Rotulo>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <button key={s.titulo} type="button" onClick={() => aplicarSugestao(s)} className="rounded-full border border-gray-800 px-3 py-1.5 text-[12px] text-gray-400 transition-colors hover:border-gray-600 hover:text-white">
                {s.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <Rotulo htmlFor="promo-titulo">Título *</Rotulo>
        <input id="promo-titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Avaliação gratuita de verão" className="campo" required />
      </div>
      <div>
        <Rotulo htmlFor="promo-oferta">Oferta</Rotulo>
        <input id="promo-oferta" name="oferta" value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Ex.: 20% de desconto até o fim do mês" className="campo" />
      </div>
      <div>
        <Rotulo htmlFor="promo-descricao">Descrição</Rotulo>
        <textarea id="promo-descricao" name="descricao" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="campo" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="promo-inicio">Início *</Rotulo>
          <input id="promo-inicio" name="data_inicio" type="date" className="campo" required />
        </div>
        <div>
          <Rotulo htmlFor="promo-fim">Fim (opcional)</Rotulo>
          <input id="promo-fim" name="data_fim" type="date" className="campo" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="promo-canal">Canal</Rotulo>
          <select id="promo-canal" name="canal" className="campo" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
            <option value="instagram">Instagram</option>
            <option value="site">Site</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <Rotulo htmlFor="promo-status">Status</Rotulo>
          <select id="promo-status" name="status" className="campo" defaultValue="planejada">
            <option value="planejada">Planejada</option>
            <option value="ativa">Ativa</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <button disabled={pendente} className="btn btn-primario w-full">{pendente ? "Salvando…" : "Criar promoção"}</button>
    </form>
  );
}
