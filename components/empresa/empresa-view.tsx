"use client";

import { useState, useTransition } from "react";
import { Building2, Check, Copy, Loader2, Plus, Send, Trash2, Users, Workflow } from "lucide-react";
import { Painel, Rotulo, cn } from "@/components/ui/base";
import {
  aplicarFunilDoSegmento, cancelarConvite, convidar, criarEmpresa, definirAtivo, mudarPapel, salvarEmpresa, trocarEmpresa,
} from "@/app/empresa/actions";
import { PAPEIS, SEGMENTOS, ehGestor, type Papel } from "@/lib/segmentos";
import type { Empresa, Membro } from "@/lib/data/empresa";

export type Convite = { id: string; email: string; papel: string; expira_em: string };

const DESCRICAO_PAPEL: Record<Papel, string> = {
  dono: "Tudo, inclusive cobrança e donos",
  gestor: "Equipe, metas, WhatsApp e painel do gestor",
  vendedor: "Leads, pipeline, tarefas e inbox",
  atendente: "Inbox e tarefas",
};

export function EmpresaView({ empresa, membros, empresas, convites, meuId }: {
  empresa: Empresa; membros: Membro[]; empresas: { id: string; nome: string }[]; convites: Convite[]; meuId: string;
}) {
  const gestor = ehGestor(empresa.papel);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) =>
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, t: sucesso } : { ok: false, t: r.erro ?? "Erro." });
    });

  const [agora] = useState(() => Date.now());
  const diasTeste = Math.ceil((new Date(empresa.teste_ate).getTime() - agora) / 86400000);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {msg && <p role="status" className={cn("rounded-lg border px-3 py-2 text-[13px]", msg.ok ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300")}>{msg.t}</p>}

        <Painel titulo="Empresa" acao={<span className="text-[12px] text-gray-500">Plano {empresa.plano}{empresa.plano === "teste" && diasTeste > 0 ? ` · ${diasTeste} dias restantes` : ""}</span>}>
          <form action={(f) => rodar(() => salvarEmpresa(f), "Empresa salva.")} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Rotulo htmlFor="e-nome">Nome</Rotulo>
                <input id="e-nome" name="nome" defaultValue={empresa.nome} disabled={!gestor} className="campo" />
              </div>
              <div>
                <Rotulo htmlFor="e-seg">Segmento</Rotulo>
                <select id="e-seg" name="segmento" defaultValue={empresa.segmento} disabled={!gestor} className="campo">
                  {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.nome} — {s.exemplos}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[12.5px] text-gray-500">
              O segmento ajusta os termos da tela (ex.: <b className="text-gray-300">{empresa.termos.leads}</b> e <b className="text-gray-300">{empresa.termos.negocios}</b>) e sugere um funil e instruções para a IA.
            </p>
            {gestor && (
              <div className="flex flex-wrap gap-2">
                <button disabled={pendente} className="btn btn-primario btn-sm">{pendente && <Loader2 size={14} className="animate-spin" />} Salvar</button>
                <button type="button" disabled={pendente} onClick={() => { if (confirm("Substituir as etapas do funil pelas do segmento? Só funciona se ainda não houver negócios.")) rodar(aplicarFunilDoSegmento, "Funil do segmento aplicado."); }} className="btn btn-secundario btn-sm"><Workflow size={14} /> Aplicar funil do segmento</button>
              </div>
            )}
          </form>
        </Painel>

        <Painel titulo={`Equipe (${membros.filter((m) => m.ativo).length})`}>
          <ul className="divide-y divide-gray-900">
            {membros.map((m) => (
              <li key={m.user_id} className={cn("flex flex-wrap items-center gap-3 py-3", !m.ativo && "opacity-50")}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[13px] font-semibold text-white">{m.nome[0]?.toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-white">{m.nome}{m.user_id === meuId && <span className="text-gray-500"> (você)</span>}</p>
                  <p className="truncate text-[12px] text-gray-500">{m.email}{!m.ativo && " · removido"}</p>
                </div>
                {gestor && m.user_id !== meuId ? (
                  <div className="flex items-center gap-1.5">
                    <select value={m.papel} disabled={pendente} onChange={(e) => rodar(() => mudarPapel(m.user_id, e.target.value as Papel), "Papel atualizado.")} className="campo h-8 w-auto py-0 text-[13px]" aria-label={`Papel de ${m.nome}`}>
                      {(Object.keys(PAPEIS) as Papel[]).map((p) => <option key={p} value={p}>{PAPEIS[p]}</option>)}
                    </select>
                    <button disabled={pendente} onClick={() => rodar(() => definirAtivo(m.user_id, !m.ativo), m.ativo ? "Membro removido." : "Membro reativado.")} className="btn btn-fantasma btn-sm">{m.ativo ? "Remover" : "Reativar"}</button>
                  </div>
                ) : (
                  <span className="rounded-full border border-gray-800 px-2 py-0.5 text-[12px] text-gray-400">{PAPEIS[m.papel]}</span>
                )}
              </li>
            ))}
          </ul>
        </Painel>

        {gestor && (
          <Painel titulo="Convidar pessoa">
            <form
              action={(f) => iniciar(async () => {
                setLink(null);
                const r = await convidar(String(f.get("email")), String(f.get("papel")));
                if (!r.ok) setMsg({ ok: false, t: r.erro });
                else if (r.direto) setMsg({ ok: true, t: "A pessoa já tinha conta e entrou direto na equipe." });
                else { setMsg({ ok: true, t: "Convite criado. Enviamos por e-mail (se o Resend estiver configurado) — ou copie o link." }); setLink(r.link); }
              })}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input name="email" type="email" required placeholder="email@empresa.com" className="campo flex-1" aria-label="E-mail" />
              <select name="papel" defaultValue="vendedor" className="campo sm:w-40" aria-label="Papel">
                {empresa.papel === "dono" && <option value="gestor">Gestor</option>}
                <option value="vendedor">Vendedor</option>
                <option value="atendente">Atendente</option>
              </select>
              <button disabled={pendente} className="btn btn-primario btn-sm h-10"><Send size={14} /> Convidar</button>
            </form>
            {link && (
              <div className="mt-3 flex gap-2">
                <code className="campo flex items-center overflow-x-auto whitespace-nowrap text-[12px]">{link}</code>
                <button onClick={async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="btn btn-secundario btn-sm h-10 shrink-0" aria-label="Copiar link">{copiado ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
            )}
            {convites.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                <li className="text-[12px] uppercase tracking-wide text-gray-500">Pendentes</li>
                {convites.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-[13px] text-gray-300">
                    <span className="min-w-0 flex-1 truncate">{c.email} · {PAPEIS[c.papel as Papel] ?? c.papel}</span>
                    <span className="text-[12px] text-gray-500">expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}</span>
                    <button disabled={pendente} onClick={() => rodar(() => cancelarConvite(c.id), "Convite cancelado.")} aria-label="Cancelar convite" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        )}
      </div>

      <div className="space-y-4">
        <Painel titulo="Permissões">
          <ul className="space-y-2.5">
            {(Object.keys(PAPEIS) as Papel[]).map((p) => (
              <li key={p} className="text-[13px]"><b className="text-white">{PAPEIS[p]}</b> <span className="text-gray-500">— {DESCRICAO_PAPEL[p]}</span></li>
            ))}
          </ul>
        </Painel>

        <Painel titulo="Minhas empresas">
          <ul className="space-y-1">
            {empresas.map((o) => (
              <li key={o.id}>
                <button disabled={pendente || o.id === empresa.id} onClick={() => rodar(() => trocarEmpresa(o.id), `Agora você está em ${o.nome}.`)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]", o.id === empresa.id ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-white")}>
                  <Building2 size={14} /> <span className="flex-1 truncate">{o.nome}</span> {o.id === empresa.id && <Check size={14} />}
                </button>
              </li>
            ))}
          </ul>
          <NovaEmpresa aoCriar={(nome, seg) => rodar(() => criarEmpresa(nome, seg), "Empresa criada. Você já está nela.")} pendente={pendente} />
        </Painel>

        <Painel titulo="Dica">
          <p className="flex gap-2 text-[13px] text-gray-400"><Users size={16} className="mt-0.5 shrink-0" /> Atendentes cuidam do inbox; vendedores, do funil. Ligue o rodízio em Inbox → ⚙️ para distribuir conversas automaticamente.</p>
        </Painel>
      </div>
    </div>
  );
}

function NovaEmpresa({ aoCriar, pendente }: { aoCriar: (nome: string, seg: string) => void; pendente: boolean }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <button onClick={() => setAberto(true)} className="btn btn-fantasma btn-sm mt-2 w-full"><Plus size={14} /> Nova empresa</button>;
  return (
    <form action={(f) => { aoCriar(String(f.get("nome")), String(f.get("segmento"))); setAberto(false); }} className="mt-3 space-y-2">
      <input name="nome" required placeholder="Nome da empresa" className="campo" aria-label="Nome da nova empresa" />
      <select name="segmento" className="campo" aria-label="Segmento">
        {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className="btn btn-fantasma btn-sm flex-1">Cancelar</button>
        <button disabled={pendente} className="btn btn-primario btn-sm flex-1">Criar</button>
      </div>
    </form>
  );
}
