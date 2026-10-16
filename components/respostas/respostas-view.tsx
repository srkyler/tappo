"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Mail, MessageCircle, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Rotulo, Vazio, cn } from "@/components/ui/base";
import { contarUsoTemplate, excluirTemplate, salvarTemplate } from "@/app/app/actions";
import { CANAL, type Lead } from "@/lib/data/types";

export type Template = { id: string; titulo: string; canal: string; assunto: string | null; corpo: string; usos: number };
type LeadMin = Pick<Lead, "id" | "nome" | "empresa" | "cargo" | "email" | "telefone">;

function preencher(t: string, l: LeadMin | null) {
  if (!l) return t;
  return t
    .replace(/\{\{\s*nome\s*\}\}/gi, l.nome.split(" ")[0])
    .replace(/\{\{\s*nome_completo\s*\}\}/gi, l.nome)
    .replace(/\{\{\s*empresa\s*\}\}/gi, l.empresa)
    .replace(/\{\{\s*cargo\s*\}\}/gi, l.cargo ?? "");
}

export function RespostasView({ templates, leads }: { templates: Template[]; leads: LeadMin[] }) {
  const [editando, setEditando] = useState<Template | "novo" | null>(null);
  const [leadId, setLeadId] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const lead = useMemo(() => leads.find((l) => l.id === leadId) ?? null, [leads, leadId]);

  async function copiar(t: Template) {
    await navigator.clipboard.writeText([t.assunto ? preencher(t.assunto, lead) : null, preencher(t.corpo, lead)].filter(Boolean).join("\n\n"));
    setCopiado(t.id);
    setTimeout(() => setCopiado(null), 1500);
    contarUsoTemplate(t.id, t.usos);
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-[340px]">
          <Rotulo htmlFor="r-lead">Preencher para o lead</Rotulo>
          <select id="r-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} className="campo">
            <option value="">— mostrar variáveis —</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.empresa}</option>)}
          </select>
        </div>
        <button onClick={() => setEditando("novo")} className="btn btn-primario btn-sm"><Plus size={15} /> Nova resposta</button>
      </div>

      {templates.length === 0 ? (
        <div className="painel"><Vazio icone={<Zap size={18} />} titulo="Nenhuma resposta rápida" texto="Crie modelos com {{nome}}, {{empresa}} e {{cargo}} para responder em segundos." acao={<button onClick={() => setEditando("novo")} className="btn btn-primario btn-sm"><Plus size={15} /> Criar modelo</button>} /></div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => {
            const corpo = preencher(t.corpo, lead);
            const fone = lead?.telefone?.replace(/\D/g, "");
            return (
              <li key={t.id} className="painel flex flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-medium text-white">{t.titulo}</h3>
                    <p className="text-[12px] text-gray-500">{t.canal} · usado {t.usos}×</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button onClick={() => setEditando(t)} aria-label="Editar" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"><Pencil size={14} /></button>
                    <button disabled={pendente} onClick={() => { if (confirm("Excluir este modelo?")) iniciar(async () => { await excluirTemplate(t.id); }); }} aria-label="Excluir" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"><Trash2 size={14} /></button>
                  </div>
                </div>
                {t.assunto && <p className="mb-1 text-[13px] font-medium text-gray-200">{preencher(t.assunto, lead)}</p>}
                <p className="mb-4 line-clamp-6 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-400">{corpo}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <button onClick={() => copiar(t)} className="btn btn-secundario btn-sm">{copiado === t.id ? <Check size={14} /> : <Copy size={14} />} {copiado === t.id ? "Copiado" : "Copiar"}</button>
                  {lead?.email && (
                    <a onClick={() => contarUsoTemplate(t.id, t.usos)} href={`mailto:${lead.email}?subject=${encodeURIComponent(preencher(t.assunto ?? "", lead))}&body=${encodeURIComponent(corpo)}`} className="btn btn-fantasma btn-sm"><Mail size={14} /> E-mail</a>
                  )}
                  {fone && (
                    <a onClick={() => contarUsoTemplate(t.id, t.usos)} href={`https://wa.me/${fone.length <= 11 ? `55${fone}` : fone}?text=${encodeURIComponent(corpo)}`} target="_blank" rel="noreferrer" className="btn btn-fantasma btn-sm"><MessageCircle size={14} /> WhatsApp</a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo aberto={editando !== null} aoFechar={() => setEditando(null)} titulo={editando === "novo" ? "Nova resposta rápida" : "Editar resposta"} descricao="Variáveis: {{nome}}, {{nome_completo}}, {{empresa}}, {{cargo}}">
        {editando !== null && <FormTemplate key={editando === "novo" ? "n" : editando.id} t={editando === "novo" ? null : editando} aoSalvar={() => setEditando(null)} />}
      </Dialogo>
    </>
  );
}

function FormTemplate({ t, aoSalvar }: { t: Template | null; aoSalvar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form action={(fd) => iniciar(async () => { const r = await salvarTemplate(t?.id ?? null, fd); if (r.ok) aoSalvar(); else setErro(r.erro); })} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div><Rotulo htmlFor="t-titulo">Título *</Rotulo><input id="t-titulo" name="titulo" required defaultValue={t?.titulo} className="campo" autoFocus /></div>
        <div><Rotulo htmlFor="t-canal">Canal</Rotulo><select id="t-canal" name="canal" defaultValue={t?.canal ?? "E-mail"} className="campo">{CANAL.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div><Rotulo htmlFor="t-assunto">Assunto (e-mail)</Rotulo><input id="t-assunto" name="assunto" defaultValue={t?.assunto ?? ""} className="campo" /></div>
      <div><Rotulo htmlFor="t-corpo">Texto *</Rotulo><textarea id="t-corpo" name="corpo" required rows={8} defaultValue={t?.corpo} className={cn("campo leading-relaxed")} /></div>
      {erro && <p role="alert" className="text-[13px] text-white">⚠ {erro}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={aoSalvar} className="btn btn-fantasma btn-sm">Cancelar</button><button disabled={pendente} className="btn btn-primario btn-sm">{pendente ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}
