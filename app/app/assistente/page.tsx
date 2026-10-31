import { Suspense } from "react";
import { Cabecalho, Pagina } from "@/components/ui/base";
import { AvisoBanco } from "@/components/dashboard/aviso-banco";
import { AssistenteView } from "@/components/assistente/assistente-view";
import { empresaAtual } from "@/lib/data/empresa";
import { usuarioAtual } from "@/lib/data/queries";
import { ehGestor } from "@/lib/segmentos";
import { createAdminClient } from "@/lib/supabase/admin";
import { agenteAtivoPublico } from "@/lib/ai/agentes";
import { perfilDaEmpresa } from "@/lib/ai/assistente";
import type { Atendente, Execucao, ItemConhecimento, Memoria } from "@/lib/ai/assistente-tipos";
import type { CanalAtendente } from "@/components/assistente/atendentes";
import type { AgendaIA } from "@/components/assistente/google-agenda";
import { googleConfigurado } from "@/lib/google/agenda";

export const metadata = { title: "Assistente IA — Tappo" };

async function Conteudo() {
  const empresa = await empresaAtual();
  if (!empresa) return <AvisoBanco />;
  const { supabase } = await usuarioAtual();
  const gestor = ehGestor(empresa.papel);
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const contar = (t: string) => supabase.from(t).select("id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("ia_ativa", true);

  const [perfil, conhecimento, memorias, execucoes, limite, usados, agente, wa, tg, em, qualificacao, atendentes, waCanais, tgCanais, emCanais, gAgenda] = await Promise.all([
    perfilDaEmpresa(supabase, empresa.id),
    supabase.from("ia_conhecimento").select("id, tipo, titulo, conteudo, status, origem, usos, ultimo_uso_em, updated_at")
      .eq("org_id", empresa.id).order("updated_at", { ascending: false }).limit(500),
    supabase.from("ia_memoria").select("id, escopo, contato, lead_id, fato, origem, valido_ate, created_at")
      .eq("org_id", empresa.id).order("created_at", { ascending: false }).limit(300),
    gestor
      ? supabase.from("ia_execucoes").select("id, conversa_id, canal, teste, pergunta, resposta, ferramentas, conhecimento_ids, transferiu, motivo, tokens, ms, erro, created_at")
        .eq("org_id", empresa.id).order("created_at", { ascending: false }).limit(150)
      : Promise.resolve({ data: [] }),
    supabase.from("ia_limites_org").select("teto_tokens_mes, bloqueado").eq("org_id", empresa.id).maybeSingle(),
    // Consumo é lido com a service role (ai_uso não tem leitura pela sessão), sempre filtrado pela empresa
    createAdminClient().rpc("ia_tokens_org", { org: empresa.id, desde: inicioMes }),
    agenteAtivoPublico(),
    contar("wa_conexoes"), contar("telegram_conexoes"), contar("email_conexoes"),
    supabase.from("chatbot_qualificacao").select("id", { count: "exact", head: true })
      .eq("org_id", empresa.id).eq("segmento", empresa.segmento).eq("ativa", true),
    supabase.from("ia_atendentes").select("id, org_id, nome, funcao, saudacao, tom, objetivo, instrucoes, transferir_quando, ativo, padrao")
      .eq("org_id", empresa.id).order("created_at"),
    supabase.from("wa_conexoes").select("id, apelido, numero, status, atendente_id").eq("org_id", empresa.id).order("criado_at"),
    supabase.from("telegram_conexoes").select("id, bot_username, status, atendente_id").eq("org_id", empresa.id),
    supabase.from("email_conexoes").select("id, endereco_recebe, atendente_id").eq("org_id", empresa.id),
    // google_agenda é só da service role: lido aqui sem o token, filtrado pela empresa
    createAdminClient().from("google_agenda").select("email, duracao_min, antecedencia_horas, dias_a_frente, ativo").eq("org_id", empresa.id).maybeSingle(),
  ]);
  const agenda: AgendaIA = { disponivel: googleConfigurado(), conectada: gAgenda.data ?? null };
  // Sem a migration dos atendentes, as colunas atendente_id não existem: a aba aparece vazia
  const canais: CanalAtendente[] = [
    ...(waCanais.data ?? []).map((c) => ({ canal: "whatsapp" as const, id: c.id, nome: `WhatsApp ${c.apelido ?? ""}${c.numero ? ` (+${c.numero})` : ""}`.trim(), status: c.status, atendente_id: c.atendente_id })),
    ...(tgCanais.data ?? []).map((c) => ({ canal: "telegram" as const, id: c.id, nome: `Telegram${c.bot_username ? ` @${c.bot_username}` : ""}`, status: c.status, atendente_id: c.atendente_id })),
    ...(emCanais.data ?? []).filter((c) => c.endereco_recebe).map((c) => ({ canal: "email" as const, id: c.id, nome: `E-mail ${c.endereco_recebe}`, status: null, atendente_id: c.atendente_id })),
  ];

  if (conhecimento.error) {
    return (
      <div className="painel p-6 text-[14px] text-gray-300">
        As tabelas do assistente ainda não existem. Rode <code className="rounded bg-gray-800 px-1.5 font-mono text-[12px] text-white">supabase/setup_completo.sql</code> no SQL Editor do Supabase.
      </div>
    );
  }

  return (
    <AssistenteView
      gestor={gestor}
      nomeEmpresa={empresa.nome}
      perfil={perfil}
      conhecimento={(conhecimento.data ?? []) as ItemConhecimento[]}
      memorias={(memorias.data ?? []) as Memoria[]}
      execucoes={(execucoes.data ?? []) as Execucao[]}
      plataformaAtiva={!!agente}
      bloqueado={!!limite.data?.bloqueado}
      tokensMes={Number(usados.data ?? 0)}
      tetoMes={limite.data?.teto_tokens_mes ?? null}
      canaisComIA={(wa.count ?? 0) + (tg.count ?? 0) + (em.count ?? 0)}
      perguntasQualificacao={qualificacao.count ?? 0}
      atendentes={(atendentes.data ?? []) as Atendente[]}
      canais={canais}
      agenda={agenda}
    />
  );
}

export default function AssistentePage() {
  return (
    <Pagina>
      <Cabecalho
        rotulo="IA & Atendimento"
        titulo="Assistente IA"
        descricao="Ensine ao seu assistente tudo sobre a empresa: o que vocês vendem, como atendem, as regras e quando chamar alguém da equipe. Ele usa isso para responder seus clientes no WhatsApp, Telegram e e-mail."
      />
      <Suspense fallback={<div className="esqueleto h-[70vh]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}
