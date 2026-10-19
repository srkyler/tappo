"use client";

import { useState, useTransition } from "react";
import { MapPin, Phone, Search, Star, Globe } from "lucide-react";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { buscarEmpresasAction, importarEmpresasComoLeads } from "@/app/prospeccao/actions";
import type { EmpresaEncontrada } from "@/lib/prospeccao/google-maps";

export function BuscaMaps() {
  const [consulta, setConsulta] = useState("");
  const [regiao, setRegiao] = useState("");
  const [resultados, setResultados] = useState<EmpresaEncontrada[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [buscando, iniciarBusca] = useTransition();
  const [importando, iniciarImportacao] = useTransition();

  function buscar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    setMensagem(null);
    iniciarBusca(async () => {
      const r = await buscarEmpresasAction(consulta, regiao);
      if (!r.ok) { setErro(r.erro); setResultados(null); return; }
      setResultados(r.empresas);
      setSelecionados(new Set(r.empresas.map((e) => e.id)));
    });
  }

  function alternar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function importar() {
    if (!resultados) return;
    const escolhidos = resultados.filter((e) => selecionados.has(e.id));
    if (!escolhidos.length) return;
    setErro(null);
    iniciarImportacao(async () => {
      const r = await importarEmpresasComoLeads(escolhidos);
      if (!r.ok) { setErro(r.erro); return; }
      setMensagem(`${r.importados} lead(s) importado(s)${r.pulados ? `, ${r.pulados} já existia(m) (telefone duplicado)` : ""}.`);
      setResultados((atual) => atual?.filter((e) => !selecionados.has(e.id)) ?? null);
      setSelecionados(new Set());
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={buscar} className="painel grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <Rotulo htmlFor="consulta-maps">O que procurar</Rotulo>
          <input id="consulta-maps" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Ex.: clínica odontológica, imobiliária, academia…" className="campo" required />
        </div>
        <div>
          <Rotulo htmlFor="regiao-maps">Região (opcional)</Rotulo>
          <input id="regiao-maps" value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Ex.: Pinheiros, São Paulo" className="campo" />
        </div>
        <div className="flex items-end">
          <button disabled={buscando} className="btn btn-primario h-[42px] w-full sm:w-auto"><Search size={15} /> {buscando ? "Buscando…" : "Buscar"}</button>
        </div>
      </form>

      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      {mensagem && <p className="text-[13px] text-emerald-400">{mensagem}</p>}

      {resultados && (
        <div className="painel">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
            <h2 className="text-[13px] font-medium text-white">{resultados.length} encontrada(s) · {selecionados.size} selecionada(s)</h2>
            <button onClick={importar} disabled={importando || !selecionados.size} className="btn btn-primario btn-sm">
              {importando ? "Importando…" : `Importar ${selecionados.size} como lead(s)`}
            </button>
          </div>
          {resultados.length === 0 ? (
            <div className="p-5"><Vazio titulo="Nada encontrado" texto="Tente outro termo ou região." /></div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {resultados.map((e) => (
                <li key={e.id} className={cn("flex items-start gap-3 px-5 py-3", selecionados.has(e.id) && "bg-gray-900/40")}>
                  <input type="checkbox" checked={selecionados.has(e.id)} onChange={() => alternar(e.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-white">{e.nome}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-gray-500">
                      {e.endereco && <span className="flex items-center gap-1"><MapPin size={11} /> {e.endereco}</span>}
                      {e.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {e.telefone}</span>}
                      {e.site && <span className="flex items-center gap-1"><Globe size={11} /> {e.site.replace(/^https?:\/\//, "")}</span>}
                      {e.avaliacao && <span className="flex items-center gap-1"><Star size={11} /> {e.avaliacao} ({e.totalAvaliacoes})</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
