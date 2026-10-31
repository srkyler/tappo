"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { aplicarImportacao, importarDoSite, type DadosDoSite } from "@/app/app/assistente/actions";

const ROTULOS: Record<Exclude<keyof DadosDoSite, "faqs">, string> = {
  sobre: "Sobre a empresa", produtos: "Produtos e serviços", publico: "Público", diferenciais: "Diferenciais",
  politicas: "Políticas", contato: "Contato",
};

/** Cola a URL do site → a IA propõe perfil e FAQs → o cliente revisa e aplica. */
export function ImportarSite() {
  const [url, setUrl] = useState("");
  const [dados, setDados] = useState<DadosDoSite | null>(null);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <section className="painel mb-6 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white"><Sparkles size={15} /> Preencher a partir do site</h2>
      <p className="mt-1 text-[13px] text-gray-500">Cole o endereço do site da empresa. A IA lê as páginas principais e sugere o perfil e perguntas frequentes — você revisa antes de aplicar.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        action={() => iniciar(async () => {
          setErro(null); setDados(null); setFeito(false);
          const r = await importarDoSite(url);
          if (!r.ok) setErro(r.erro); else setDados(r.dados);
        })}
      >
        <div className="relative min-w-[240px] flex-1">
          <Globe size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.suaempresa.com.br" className="campo w-full pl-9" required />
        </div>
        <button type="submit" disabled={pendente} className="btn btn-secundario">{pendente && !dados ? <><Loader2 size={14} className="animate-spin" /> Lendo o site…</> : "Ler site"}</button>
      </form>
      {erro && <p className="mt-2 text-[13px] text-red-400">{erro}</p>}
      {feito && <p className="mt-2 text-[13px] text-emerald-300">Aplicado. As FAQs estão em Conhecimento › Sugestões para você aprovar.</p>}

      {dados && (
        <div className="mt-4 space-y-3 rounded-lg border border-gray-800 p-4">
          {(Object.keys(ROTULOS) as (keyof typeof ROTULOS)[]).filter((k) => dados[k].trim()).map((k) => (
            <div key={k}>
              <p className="rotulo">{ROTULOS[k]}</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-200">{dados[k]}</p>
            </div>
          ))}
          {dados.faqs.length > 0 && (
            <div>
              <p className="rotulo">{dados.faqs.length} perguntas frequentes (entram como sugestão)</p>
              <ul className="mt-1 space-y-1 text-[13px] text-gray-300">
                {dados.faqs.map((f) => <li key={f.pergunta}>• <span className="text-white">{f.pergunta}</span> — {f.resposta}</li>)}
              </ul>
            </div>
          )}
          <label className="flex items-center gap-2 text-[13px] text-gray-400">
            <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} /> Substituir o que já está preenchido (senão, só completa campos vazios)
          </label>
          <div className="flex gap-2">
            <button
              disabled={pendente}
              onClick={() => iniciar(async () => {
                const r = await aplicarImportacao(dados, sobrescrever);
                if (!r.ok) setErro(r.erro); else { setDados(null); setFeito(true); }
              })}
              className="btn btn-primario btn-sm"
            >{pendente && <Loader2 size={13} className="animate-spin" />} Aplicar</button>
            <button onClick={() => setDados(null)} className="btn btn-fantasma btn-sm">Descartar</button>
          </div>
        </div>
      )}
    </section>
  );
}
