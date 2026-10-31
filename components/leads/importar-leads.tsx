"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { importarLeadsMapeados, type ResultadoImportacao } from "@/app/app/actions";
import { CAMPOS_LEAD, ROTULO_CAMPO, lerCsv, sugerirMapeamento, type CampoLead } from "@/lib/csv-ler";
import { LEAD_ORIGEM, type LeadOrigem } from "@/lib/data/types";

/*
 * Importação em 3 passos: escolher arquivo → conferir quais colunas viram quais
 * campos (já sugerido pelo nome da coluna) → importar. Duplicados (e-mail ou
 * telefone, no arquivo ou na base) são apontados, nunca criados de novo.
 */

const MAX = 5000;

export function ImportarLeads({ aoConcluir }: { aoConcluir: () => void }) {
  const [linhas, setLinhas] = useState<string[][] | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [mapa, setMapa] = useState<Record<CampoLead, number> | null>(null);
  const [origem, setOrigem] = useState<LeadOrigem>("Prospecção");
  const [dup, setDup] = useState<"ignorar" | "completar">("ignorar");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [pendente, iniciar] = useTransition();

  const cab = linhas?.[0] ?? [];
  const dados = useMemo(() => (linhas ?? []).slice(1), [linhas]);
  const registros = useMemo(() => {
    if (!mapa) return [];
    const v = (row: string[], c: CampoLead) => (mapa[c] >= 0 ? row[mapa[c]] ?? "" : "");
    return dados.slice(0, MAX).map((row) => Object.fromEntries(CAMPOS_LEAD.map((c) => [c, v(row, c)])) as Record<CampoLead, string>);
  }, [dados, mapa]);
  const validos = registros.filter((r) => r.nome.trim() && r.empresa.trim()).length;

  const abrir = async (f: File) => {
    setErro(null); setResultado(null);
    let texto = await f.text();
    // Excel antigo salva em Windows-1252: sem UTF-8 válido, aparecem "�"
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(await f.arrayBuffer());
    const l = lerCsv(texto);
    if (l.length < 2) { setErro("O arquivo precisa de uma linha de cabeçalho e ao menos uma linha de dados."); return; }
    setArquivo(f.name);
    setLinhas(l);
    setMapa(sugerirMapeamento(l[0]));
  };

  if (resultado) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Criados", resultado.criados], ["Completados", resultado.atualizados], ["Duplicados", resultado.ignorados], ["Sem nome/empresa", resultado.invalidos]].map(([r, n]) => (
            <div key={r} className="rounded-lg border border-gray-800 p-3"><p className="text-[11px] text-gray-500">{r}</p><p className="text-[20px] font-semibold text-white tabular">{n}</p></div>
          ))}
        </div>
        {resultado.duplicados.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase text-amber-400">Duplicados ({resultado.duplicados.length})</p>
            <ul className="space-y-1 text-[12px]">
              {resultado.duplicados.map((d, i) => (
                <li key={i} className="flex justify-between gap-2"><span className="text-gray-400">Linha {d.linha} · {d.campo}</span><span className="truncate text-white">{d.valor}</span><span className="truncate text-gray-500">→ {d.lead_nome}</span></li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={aoConcluir} className="btn btn-primario w-full">Concluir</button>
      </div>
    );
  }

  if (!linhas || !mapa) {
    return (
      <div className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 px-6 py-10 text-center transition-colors hover:border-gray-400">
          <Upload size={20} className="text-gray-400" />
          <span className="text-[14px] text-white">Escolher arquivo .csv</span>
          <span className="text-[12px] text-gray-500">Exportado do Excel, Google Planilhas ou outro CRM · até {MAX.toLocaleString("pt-BR")} linhas</span>
          <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) abrir(f); }} />
        </label>
        <p className="text-[12px] text-gray-500">No Excel: Arquivo › Salvar como › CSV. A primeira linha deve ter o nome das colunas — você escolhe qual coluna vira cada campo no próximo passo.</p>
        {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-gray-400"><span className="text-white">{arquivo}</span> · {dados.length.toLocaleString("pt-BR")} linhas{dados.length > MAX ? ` (só as primeiras ${MAX} serão importadas)` : ""}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {CAMPOS_LEAD.map((c) => (
          <label key={c} className="text-[12px] text-gray-400">{ROTULO_CAMPO[c]}
            <select value={mapa[c]} onChange={(e) => setMapa({ ...mapa, [c]: Number(e.target.value) })} className="campo mt-1 !h-9">
              <option value={-1}>— não importar —</option>
              {cab.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead><tr className="border-b border-gray-800 text-gray-500">{["nome", "empresa", "email", "telefone"].map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
          <tbody>
            {registros.slice(0, 5).map((r, i) => (
              <tr key={i} className="border-b border-gray-800/60 last:border-0 text-gray-300">
                {(["nome", "empresa", "email", "telefone"] as const).map((c) => <td key={c} className={`max-w-[10rem] truncate px-3 py-1.5 ${!r[c] && (c === "nome" || c === "empresa") ? "text-red-400" : ""}`}>{r[c] || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-gray-400">Origem dos leads
          <select value={origem} onChange={(e) => setOrigem(e.target.value as LeadOrigem)} className="campo mt-1 !h-9">
            {LEAD_ORIGEM.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-gray-400">Se já existir (mesmo e-mail ou telefone)
          <select value={dup} onChange={(e) => setDup(e.target.value as "ignorar" | "completar")} className="campo mt-1 !h-9">
            <option value="ignorar">Ignorar a linha</option>
            <option value="completar">Completar campos vazios do lead existente</option>
          </select>
        </label>
      </div>

      {erro && <p role="alert" className="text-[13px] text-red-400">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setLinhas(null); setMapa(null); }} disabled={pendente} className="btn btn-fantasma">Trocar arquivo</button>
        <button
          disabled={pendente || mapa.nome < 0 || mapa.empresa < 0 || !validos}
          onClick={() => iniciar(async () => {
            setErro(null);
            const r = await importarLeadsMapeados(registros, { origem, duplicados: dup });
            if (!r.ok) setErro(r.erro); else setResultado(r.resultado ?? null);
          })}
          className="btn btn-primario flex-1"
        >
          {pendente ? <><Loader2 size={14} className="animate-spin" /> Importando…</> : `Importar ${validos.toLocaleString("pt-BR")} leads`}
        </button>
      </div>
      {(mapa.nome < 0 || mapa.empresa < 0) && <p className="text-[12px] text-amber-300">Escolha as colunas de Nome e Empresa.</p>}
    </div>
  );
}
