"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, Status, Vazio, cn } from "@/components/ui/base";
import { excluirLead, importarLeads, mudarStatusLead, salvarLead, detectarDuplicadosLead } from "@/app/app/actions";
import { LEAD_ORIGEM, LEAD_STATUS, type Lead, type LeadStatus } from "@/lib/data/types";
import { segmentoPorId } from "@/lib/segmentos";
import { formatData } from "@/lib/data/format";

type Filtro = "Todos" | LeadStatus;

/**
 * Célula CSV: sempre entre aspas (quebra de linha e vírgula ficam dentro), aspas
 * dobradas, e valor começando com = + - @ prefixado com ' — senão o Excel o
 * executa como fórmula (injeção de CSV com dado vindo de formulário público).
 */
function celulaCsv(v: unknown) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

export function LeadsView({ leads }: { leads: Lead[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Lead | null>(null);
  const [novo, setNovo] = useState(params.get("novo") === "1");
  const [importar, setImportar] = useState(false);
  const [filtroSegmento, setFiltroSegmento] = useState<string>("todos");
  const [pendente, iniciar] = useTransition();

  const contagem = useMemo(() => {
    const c: Record<string, number> = { Todos: leads.length };
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const segmentosUnicos = useMemo(() => {
    const s = new Set<string>();
    for (const l of leads) if (l.segmento) s.add(l.segmento);
    return [...s];
  }, [leads]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) =>
      (filtro === "Todos" || l.status === filtro) &&
      (filtroSegmento === "todos" || l.segmento === filtroSegmento) &&
      (!q || [l.nome, l.empresa, l.cargo, l.email, l.cod, l.segmento].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [leads, filtro, busca, filtroSegmento]);

  function exportarCSV() {
    const linhas = ["nome,empresa,cargo,email,telefone,segmento,origem,status,cod,proximo_contato_em"];
    for (const l of filtrados) {
      linhas.push([
        l.nome, l.empresa, l.cargo ?? "", l.email ?? "", l.telefone ?? "", l.segmento ?? "",
        l.origem, l.status, l.cod, l.proximo_contato_em ?? "",
      ].map(celulaCsv).join(","));
    }
    // BOM: sem ele o Excel abre acentos quebrados; \r\n é o fim de linha do RFC 4180
    const csv = "\uFEFF" + linhas.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-tappo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fechar() {
    setEditando(null);
    setNovo(false);
    if (params.get("novo")) router.replace("/app/leads");
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[360px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, empresa, código…" className="campo !pl-9" aria-label="Buscar leads" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportar(true)} className="btn btn-secundario btn-sm"><Upload size={14} /> Importar CSV</button>
          <button onClick={exportarCSV} className="btn btn-secundario btn-sm"><Download size={14} /> Exportar CSV</button>
          <button onClick={() => setNovo(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Novo lead</button>
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {(["Todos", ...LEAD_STATUS] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
              filtro === f ? "border-white bg-white text-black" : "border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white",
            )}
          >
            {f} <span className={cn("tabular text-[11px]", filtro === f ? "text-gray-600" : "text-gray-600")}>{contagem[f] ?? 0}</span>
          </button>
        ))}
        {segmentosUnicos.length > 0 && (
          <>
            <p className="mt-3 mb-1 text-[11px] uppercase tracking-wide text-gray-500">Segmento</p>
            <div className="flex gap-1.5 overflow-x-auto">
              <button onClick={() => setFiltroSegmento("todos")} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors", filtroSegmento === "todos" ? "border-white bg-white text-black" : "border-gray-800 text-gray-400 hover:text-white")}>Todos</button>
              {segmentosUnicos.map((s) => (
                <button key={s} onClick={() => setFiltroSegmento(s)} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors", filtroSegmento === s ? "border-white bg-white text-black" : "border-gray-800 text-gray-400 hover:text-white")}>
                  {segmentoPorId(s).nome}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="painel">
          {leads.length === 0 ? (
            <Vazio icone={<Users size={18} />} titulo="Sua base está vazia" texto="Cadastre o primeiro lead, importe uma planilha CSV ou peça ao Agente IA para cadastrar por você." acao={<button onClick={() => setNovo(true)} className="btn btn-primario btn-sm"><Plus size={15} /> Novo lead</button>} />
          ) : (
            <Vazio titulo="Nada encontrado" texto="Ajuste a busca ou o filtro de status." />
          )}
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="painel hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] uppercase tracking-[0.1em] text-gray-500">
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-3 py-3 font-medium">Empresa</th>
                  <th className="px-3 py-3 font-medium">Origem</th>
                  <th className="px-3 py-3 font-medium">Próx. contato</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="w-20 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtrados.map((l) => (
                  <tr key={l.id} className="group transition-colors hover:bg-gray-900/60">
                    <td className="px-5 py-3">
                      <button onClick={() => setEditando(l)} className="text-left">
                        <span className="block font-medium text-white group-hover:underline">{l.nome}</span>
                        <span className="block text-[12px] text-gray-500">{l.cargo ?? "—"} · <span className="font-mono">{l.cod}</span></span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{l.empresa}</td>
                    <td className="px-3 py-3 text-gray-400">{l.origem}</td>
                    <td className="px-3 py-3 text-gray-400 tabular">{formatData(l.proximo_contato_em)}</td>
                    <td className="px-3 py-3">
                      <select
                        value={l.status}
                        disabled={pendente}
                        onChange={(e) => iniciar(async () => { await mudarStatusLead(l.id, e.target.value as LeadStatus); })}
                        aria-label={`Status de ${l.nome}`}
                        className={cn(
                          "h-7 cursor-pointer appearance-none rounded-full border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] outline-none transition-colors hover:border-gray-400",
                          ["Reunião", "Qualificado"].includes(l.status) ? "border-white bg-white text-black" : "border-gray-700 bg-transparent text-gray-200",
                        )}
                      >
                        {LEAD_STATUS.map((s) => <option key={s} value={s} className="bg-black text-white">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <button onClick={() => setEditando(l)} aria-label="Editar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><Pencil size={14} /></button>
                        <BotaoExcluir id={l.id} nome={l.nome} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cartões */}
          <ul className="space-y-2 md:hidden">
            {filtrados.map((l) => (
              <li key={l.id}>
                <button onClick={() => setEditando(l)} className="painel flex w-full items-start justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-white">{l.nome}</p>
                    <p className="truncate text-[12.5px] text-gray-500">{l.empresa}{l.cargo ? ` · ${l.cargo}` : ""}</p>
                    <p className="mt-1.5 font-mono text-[11px] text-gray-600">{l.cod}{l.proximo_contato_em ? ` · contato ${formatData(l.proximo_contato_em)}` : ""}</p>
                  </div>
                  <Status valor={l.status} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-[12px] text-gray-600">{filtrados.length} de {leads.length} leads</p>

      <Dialogo aberto={novo || !!editando} aoFechar={fechar} titulo={editando ? editando.nome : "Novo lead"} descricao={editando ? `${editando.cod} · criado em ${formatData(editando.created_at)}` : "Cadastre uma nova ficha na sua base."}>
        <FormLead key={editando?.id ?? "novo"} lead={editando} aoSalvar={fechar} />
      </Dialogo>

      <Dialogo aberto={importar} aoFechar={() => setImportar(false)} titulo="Importar leads" descricao="Arquivo CSV com cabeçalho. Colunas aceitas: nome, empresa, cargo, email, telefone, segmento.">
        <FormImportar aoConcluir={() => setImportar(false)} />
      </Dialogo>
    </>
  );
}

function BotaoExcluir({ id, nome }: { id: string; nome: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (confirmar) {
    return (
      <button
        disabled={pendente}
        onClick={() => iniciar(async () => { await excluirLead(id); setConfirmar(false); })}
        onBlur={() => setConfirmar(false)}
        autoFocus
        className="rounded-md bg-white px-2 text-[11px] font-medium text-black"
      >
        {pendente ? "…" : "Excluir?"}
      </button>
    );
  }
  return <button onClick={() => setConfirmar(true)} aria-label={`Excluir ${nome}`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><Trash2 size={14} /></button>;
}

function FormLead({ lead, aoSalvar }: { lead: Lead | null; aoSalvar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [duplicados, setDuplicados] = useState<{ campo: string; valor: string; lead_id: string; lead_nome: string }[]>([]);
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false);
  const [fdPendente, setFdPendente] = useState<FormData | null>(null);

  async function verificarDuplicados(fd: FormData) {
    const telefone = String(fd.get("telefone") ?? "").trim() || null;
    const email = String(fd.get("email") ?? "").trim() || null;
    if (!telefone && !email) {
      await salvarLeadConfirmado(fd);
      return;
    }
    const { duplicados: dups } = await detectarDuplicadosLead(telefone, email);
    if (dups.length > 0) {
      setDuplicados(dups);
      setFdPendente(fd);
      setMostrarDuplicados(true);
    } else {
      setMostrarDuplicados(false);
      await salvarLeadConfirmado(fd);
    }
  }

  async function salvarLeadConfirmado(fd: FormData) {
    const r = await salvarLead(lead?.id ?? null, fd);
    if (r.ok) { aoSalvar(); setFdPendente(null); } else setErro(r.erro);
  }

  return (
    <>
      {mostrarDuplicados && fdPendente && (
        <Dialogo aberto aoFechar={() => { setMostrarDuplicados(false); setDuplicados([]); setFdPendente(null); }} titulo="Lead duplicado encontrado" descricao="Já existe um lead com este telefone ou e-mail na sua base. Deseja salvar mesmo assim?">
          <div className="space-y-3 p-4">
            {duplicados.map((d) => (
              <div key={d.lead_id} className="p-2 rounded-lg bg-gray-900/30 border border-gray-800">
                <p className="text-[11px] text-gray-500 uppercase">{d.campo}</p>
                <p className="text-[13px] font-medium text-white">{d.valor}</p>
                <p className="text-[11px] text-gray-400">{d.lead_nome}</p>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setMostrarDuplicados(false); setDuplicados([]); setFdPendente(null); }} className="btn btn-fantasma btn-sm">Cancelar</button>
              <button type="button" onClick={() => { setMostrarDuplicados(false); setDuplicados([]); salvarLeadConfirmado(fdPendente!); }} className="btn btn-primario btn-sm">Salvar mesmo assim</button>
            </div>
          </div>
        </Dialogo>
      )}
      <form
        action={(fd) => { verificarDuplicados(fd as unknown as FormData); }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
      <div className="sm:col-span-2"><Rotulo htmlFor="nome">Nome *</Rotulo><input id="nome" name="nome" required defaultValue={lead?.nome} className="campo" autoFocus /></div>
      <div><Rotulo htmlFor="empresa">Empresa *</Rotulo><input id="empresa" name="empresa" required defaultValue={lead?.empresa} className="campo" /></div>
      <div><Rotulo htmlFor="cargo">Cargo</Rotulo><input id="cargo" name="cargo" defaultValue={lead?.cargo ?? ""} className="campo" /></div>
      <div><Rotulo htmlFor="email">E-mail</Rotulo><input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} className="campo" /></div>
      <div><Rotulo htmlFor="telefone">Telefone</Rotulo><input id="telefone" name="telefone" type="tel" defaultValue={lead?.telefone ?? ""} className="campo" /></div>
      <div><Rotulo htmlFor="segmento">Segmento</Rotulo><input id="segmento" name="segmento" defaultValue={lead?.segmento ?? ""} className="campo" placeholder="Ex.: Indústria" /></div>
      <div><Rotulo htmlFor="linkedin_url">LinkedIn</Rotulo><input id="linkedin_url" name="linkedin_url" type="url" defaultValue={lead?.linkedin_url ?? ""} className="campo" placeholder="https://" /></div>
      <div>
        <Rotulo htmlFor="origem">Origem</Rotulo>
        <select id="origem" name="origem" defaultValue={lead?.origem ?? "Prospecção"} className="campo">{LEAD_ORIGEM.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <div>
        <Rotulo htmlFor="status">Status</Rotulo>
        <select id="status" name="status" defaultValue={lead?.status ?? "Nova"} className="campo">{LEAD_STATUS.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <div className="sm:col-span-2"><Rotulo htmlFor="proximo_contato_em">Próximo contato</Rotulo><input id="proximo_contato_em" name="proximo_contato_em" type="date" defaultValue={lead?.proximo_contato_em ?? ""} className="campo" /></div>
      <div className="sm:col-span-2"><Rotulo htmlFor="notas">Notas</Rotulo><textarea id="notas" name="notas" rows={4} defaultValue={lead?.notas ?? ""} className="campo" /></div>
      {erro && <p role="alert" className="text-[13px] text-white sm:col-span-2">⚠ {erro}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button>
        <button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Salvando…" : "Salvar lead"}</button>
      </div>
    </form>
    </>
  );
}

function FormImportar({ aoConcluir }: { aoConcluir: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string; duplicados?: { linha: number; campo: string; valor: string; lead_id: string; lead_nome: string }[] } | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 px-6 py-10 text-center transition-colors hover:border-gray-400">
        <Upload size={20} className="text-gray-400" />
        <span className="text-[14px] text-white">{pendente ? "Importando…" : "Escolher arquivo .csv"}</span>
        <span className="text-[12px] text-gray-500">Até 1.000 linhas · separador vírgula ou ponto-e-vírgula</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={pendente}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            iniciar(async () => {
              const r = await importarLeads(await f.text());
              setMsg(r.ok ? { ok: true, t: `${r.total} leads importados${r.duplicados?.length ? ` · ${r.duplicados.length} duplicados ignorados` : ""}.`, duplicados: r.duplicados } : { ok: false, t: r.erro });
            });
          }}
        />
      </label>
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[11.5px] text-gray-400">nome,empresa,cargo,email{"\n"}Ana Lima,Lima Agro,Diretora,ana@limaagro.com.br</pre>
      {msg && (
        <>
          <p role="status" className={cn("text-[13px]", msg.ok ? "text-emerald-400" : "text-gray-300")}>{msg.ok ? "✓" : "⚠"} {msg.t}</p>
          {msg.ok && msg.duplicados?.length && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-[11px] text-amber-400 mb-2 uppercase font-bold">Duplicados ignorados ({msg.duplicados.length})</p>
              <ul className="space-y-1 text-[11px]">
                {msg.duplicados.map((d) => (
                  <li key={`${d.linha}-${d.campo}`} className="flex justify-between gap-2">
                    <span className="text-gray-400">Linha {d.linha} · {d.campo}</span>
                    <span className="text-white truncate max-w-[200px]">{d.valor}</span>
                    <span className="text-gray-500 truncate">→ {d.lead_nome}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {msg?.ok && <button onClick={aoConcluir} className="btn btn-primario btn-sm w-full">Concluir</button>}
    </div>
  );
}
