import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Cabecalho, Kpi, Logo, Pagina } from "@/components/ui/base";
import { AgentesAdmin } from "@/components/admin/agentes-admin";
import { Administradores, type MembroPlataforma } from "@/components/admin/administradores";
import { LimitesOrg, type LinhaLimite } from "@/components/admin/limites-org";
import { AtendentesAdmin, type LinhaAtendente } from "@/components/admin/atendentes-admin";
import { ErrosAdmin, type LinhaErro } from "@/components/admin/erros-admin";
import { SaudeAdmin } from "@/components/admin/saude-admin";
import { MidiaAdmin, type MidiaTela } from "@/components/admin/midia-admin";
import { verificarSaude } from "@/lib/saude";
import { ehSuperAdmin, exigirAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { semSegredo, type Agente } from "@/lib/ai/agentes";
import { formatNum, isoDiasAtras } from "@/lib/data/format";

export const metadata = { title: "Admin — Tappo", robots: { index: false } };

async function Conteudo() {
  const user = await exigirAdmin();
  const db = createAdminClient();
  const desde = isoDiasAtras(30);
  const [{ data: agentes, error }, { data: usos }, { count: membros }] = await Promise.all([
    db.from("ai_agents").select("*").order("created_at"),
    db.from("ai_uso").select("agent_id, tokens_entrada, tokens_cache, tokens_saida").gte("created_at", desde).limit(20000),
    db.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  // Limites de IA por empresa: consumo do mês corrente x teto definido aqui
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const [{ data: orgs }, { data: limites }, { data: usoMes }] = await Promise.all([
    db.from("organizacoes").select("id, nome, plano").order("nome").limit(2000),
    db.from("ia_limites_org").select("org_id, teto_tokens_mes, bloqueado"),
    db.from("ai_uso").select("org_id, tokens_entrada, tokens_saida").gte("created_at", inicioMes).not("org_id", "is", null).limit(50000),
  ]);
  const tokensPorOrg: Record<string, number> = {};
  for (const u of usoMes ?? []) tokensPorOrg[u.org_id as string] = (tokensPorOrg[u.org_id as string] ?? 0) + u.tokens_entrada + u.tokens_saida;
  const linhasLimite: LinhaLimite[] = (orgs ?? []).map((o) => {
    const l = limites?.find((x) => x.org_id === o.id);
    return { id: o.id, nome: o.nome, plano: o.plano, tokens: tokensPorOrg[o.id] ?? 0, teto: l?.teto_tokens_mes ?? null, bloqueado: !!l?.bloqueado };
  });

  // Atendentes de IA de todas as empresas + modelo escolhido; falhas recentes; saúde
  const [{ data: atendentes }, { data: modelos }, { data: erros }, saude, { data: midia }] = await Promise.all([
    db.from("ia_atendentes").select("id, org_id, nome, funcao, ativo").order("created_at").limit(2000),
    db.from("ia_atendente_modelo").select("atendente_id, agent_id"),
    db.from("erros_app").select("id, origem, org_id, mensagem, detalhe, created_at").order("created_at", { ascending: false }).limit(100),
    verificarSaude(db),
    db.from("ia_midia_config").select("*").eq("id", true).maybeSingle(),
  ]);
  const midiaTela: MidiaTela | null = midia ? {
    transcricao_ativa: midia.transcricao_ativa, transcricao_base_url: midia.transcricao_base_url,
    transcricao_modelo: midia.transcricao_modelo, tem_chave: !!midia.transcricao_chave,
    visao_ativa: midia.visao_ativa, visao_agent_id: midia.visao_agent_id,
  } : null;
  const nomeOrg = (id: string | null) => (id ? orgs?.find((o) => o.id === id)?.nome ?? null : null);
  const linhasAtendentes: LinhaAtendente[] = (atendentes ?? []).map((a) => ({
    id: a.id, nome: a.nome, funcao: a.funcao, ativo: a.ativo, empresa: nomeOrg(a.org_id) ?? "—",
    agent_id: modelos?.find((m) => m.atendente_id === a.id)?.agent_id ?? null,
  }));
  const linhasErros: LinhaErro[] = (erros ?? []).map((e) => ({ ...e, empresa: nomeOrg(e.org_id), detalhe: (e.detalhe ?? {}) as Record<string, unknown> }));

  const souSuperAdmin = ehSuperAdmin(user);
  const { data: todosMembros } = souSuperAdmin
    ? await db.from("profiles").select("id, email, nome_completo, papel").order("created_at")
    : { data: null };

  if (error) {
    return (
      <div className="painel p-6 text-[14px] text-gray-300">
        As tabelas de agentes ainda não existem. Rode <code className="rounded bg-gray-800 px-1.5 font-mono text-[12px] text-white">supabase/setup_completo.sql</code> no SQL Editor do Supabase.
      </div>
    );
  }

  const uso: Record<string, { pedidos: number; tokens: number; cache: number }> = {};
  let totalTokens = 0;
  for (const u of usos ?? []) {
    const k = u.agent_id ?? "-";
    uso[k] ??= { pedidos: 0, tokens: 0, cache: 0 };
    uso[k].pedidos++;
    uso[k].tokens += u.tokens_entrada + u.tokens_saida;
    uso[k].cache += u.tokens_cache;
    totalTokens += u.tokens_entrada + u.tokens_saida;
  }

  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi rotulo="Membros" valor={formatNum(membros ?? 0)} />
        <Kpi rotulo="Agentes" valor={formatNum(agentes?.length ?? 0)} />
        <Kpi rotulo="Conversas · 30d" valor={formatNum(usos?.length ?? 0)} />
        <Kpi rotulo="Tokens · 30d" valor={formatNum(totalTokens)} detalhe="entrada + saída (sem cache)" />
      </div>
      <div className="mb-8">
        <SaudeAdmin itens={saude} />
      </div>
      <AgentesAdmin agentes={(agentes as Agente[]).map(semSegredo)} uso={uso} />
      <div className="mt-8">
        <AtendentesAdmin
          linhas={linhasAtendentes}
          agentes={(agentes as Agente[]).map((a) => ({ id: a.id, nome: a.nome, modelo: a.modelo, ativo: a.ativo }))}
        />
      </div>
      <div className="mt-8">
        <MidiaAdmin cfg={midiaTela} agentes={(agentes as Agente[]).map((a) => ({ id: a.id, nome: a.nome, modelo: a.modelo }))} />
      </div>
      <div className="mt-8">
        <ErrosAdmin erros={linhasErros} />
      </div>
      <div className="mt-8">
        <LimitesOrg linhas={linhasLimite} />
      </div>
      {souSuperAdmin && (
        <div className="mt-8">
          <Administradores membros={(todosMembros ?? []) as MembroPlataforma[]} euId={user.id} />
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <div className="min-h-[100svh] bg-black">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-gray-300"><ShieldCheck size={11} /> Admin</span>
          </div>
          <Link href="/app" className="btn btn-fantasma btn-sm"><ArrowLeft size={14} /> Voltar ao app</Link>
        </div>
      </header>
      <Pagina>
        <Cabecalho rotulo="Administração" titulo="Agentes de IA" descricao="Cadastre agentes com qualquer provedor (Claude, NVIDIA NIM, OpenAI, Groq, OpenRouter…), escolha qual fica ativo e defina limites por empresa. Clientes nunca veem nem trocam o modelo — eles só configuram o conhecimento e as regras do próprio assistente em /app/assistente." />
        <Suspense fallback={<div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="esqueleto h-64" />)}</div>}>
          <Conteudo />
        </Suspense>
      </Pagina>
    </div>
  );
}
