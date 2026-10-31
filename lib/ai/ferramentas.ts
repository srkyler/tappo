import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ACTIVITY_TIPO, LEAD_ORIGEM, LEAD_STATUS } from "@/lib/data/types";
import { hojeISO } from "@/lib/data/format";
import { buscarConhecimento } from "./assistente";

/*
 * Ferramentas do Agente Tappo. Todas rodam com o cliente Supabase DO USUÁRIO,
 * então o RLS garante que o agente só enxerga e altera dados de quem está conversando.
 */

/** Formato neutro (JSON Schema) — cada adaptador converte para o seu provedor. */
export type FerramentaNeutra = { name: string; description: string; parameters: Record<string, unknown> };

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");

const SCHEMAS = {
  buscar_leads: z.object({
    busca: z.string().optional(),
    status: z.enum(LEAD_STATUS).optional(),
    limite: z.number().int().min(1).max(100).optional(),
  }),
  contatos_de_hoje: z.object({}),
  ver_lead: z.object({ lead_id: z.string().uuid() }),
  criar_lead: z.object({
    nome: z.string().min(1),
    empresa: z.string().min(1),
    cargo: z.string().optional(),
    email: z.string().optional(),
    telefone: z.string().optional(),
    segmento: z.string().optional(),
    origem: z.enum(LEAD_ORIGEM).optional(),
    notas: z.string().optional(),
    proximo_contato_em: data.optional(),
  }),
  atualizar_lead: z.object({
    lead_id: z.string().uuid(),
    status: z.enum(LEAD_STATUS).optional(),
    notas: z.string().optional(),
    proximo_contato_em: data.nullable().optional(),
  }),
  resumo_metricas: z.object({ dias: z.number().int().min(1).max(365).optional() }),
  listar_pipeline: z.object({}),
  criar_negocio: z.object({
    titulo: z.string().min(1),
    empresa: z.string().min(1),
    valor: z.number().min(0).optional(),
    etapa: z.string().optional(),
    lead_id: z.string().uuid().optional(),
    contato: z.string().optional(),
  }),
  mover_negocio: z.object({ negocio_id: z.string().uuid(), etapa: z.string().min(1) }),
  listar_campanhas: z.object({}),
  listar_respostas: z.object({}),
  registrar_atividade: z.object({
    tipo: z.enum(ACTIVITY_TIPO),
    descricao: z.string().min(1),
    lead_id: z.string().uuid().optional(),
  }),
  buscar_conhecimento: z.object({ consulta: z.string().min(2).max(300) }),
} as const;

type Nome = keyof typeof SCHEMAS;
const ESCRITA: Nome[] = ["criar_lead", "atualizar_lead", "criar_negocio", "mover_negocio", "registrar_atividade"];

const DEFINICOES: Record<Nome, { description: string; input_schema: Record<string, unknown> }> = {
  buscar_leads: {
    description: "Lista leads do usuário. Filtra por texto (nome, empresa, cargo, segmento, e-mail) e/ou status. Use antes de atualizar um lead para obter o lead_id.",
    input_schema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Texto livre" },
        status: { type: "string", enum: [...LEAD_STATUS] },
        limite: { type: "integer", minimum: 1, maximum: 100, description: "Padrão 15" },
      },
    },
  },
  contatos_de_hoje: {
    description: "Leads com próximo contato hoje ou atrasado, e leads de campanhas cujo próximo passo vence hoje ou antes.",
    input_schema: { type: "object", properties: {} },
  },
  ver_lead: {
    description: "Detalhes completos de um lead, incluindo notas, histórico recente de atividades e campanhas em que está.",
    input_schema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
  },
  criar_lead: {
    description: "Cadastra um novo lead na base do usuário.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" }, empresa: { type: "string" }, cargo: { type: "string" },
        email: { type: "string" }, telefone: { type: "string" }, segmento: { type: "string" },
        origem: { type: "string", enum: [...LEAD_ORIGEM] }, notas: { type: "string" },
        proximo_contato_em: { type: "string", description: "AAAA-MM-DD" },
      },
      required: ["nome", "empresa"],
    },
  },
  atualizar_lead: {
    description: "Atualiza status, notas (substitui o texto) ou data do próximo contato de um lead.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        status: { type: "string", enum: [...LEAD_STATUS] },
        notas: { type: "string" },
        proximo_contato_em: { type: ["string", "null"], description: "AAAA-MM-DD ou null para limpar" },
      },
      required: ["lead_id"],
    },
  },
  resumo_metricas: {
    description: "Métricas agregadas do período: leads novos, respostas, reuniões, ganhos, funil por etapa, top campanhas.",
    input_schema: { type: "object", properties: { dias: { type: "integer", minimum: 1, maximum: 365, description: "Padrão 30" } } },
  },
  listar_pipeline: {
    description: "Etapas do pipeline com os negócios de cada uma (valor, dias parado na etapa).",
    input_schema: { type: "object", properties: {} },
  },
  criar_negocio: {
    description: "Abre um negócio (deal) no pipeline. 'etapa' é o nome da etapa (padrão: a primeira).",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" }, empresa: { type: "string" }, valor: { type: "number" },
        etapa: { type: "string" }, lead_id: { type: "string" }, contato: { type: "string" },
      },
      required: ["titulo", "empresa"],
    },
  },
  mover_negocio: {
    description: "Move um negócio para outra etapa do pipeline, pelo nome da etapa.",
    input_schema: { type: "object", properties: { negocio_id: { type: "string" }, etapa: { type: "string" } }, required: ["negocio_id", "etapa"] },
  },
  listar_campanhas: {
    description: "Campanhas com status, etapas da cadência e quantidade de leads por status.",
    input_schema: { type: "object", properties: {} },
  },
  listar_respostas: {
    description: "Modelos de mensagem (respostas rápidas) do usuário, com variáveis {{nome}}, {{empresa}}, {{cargo}}. Use como base ao redigir mensagens.",
    input_schema: { type: "object", properties: {} },
  },
  registrar_atividade: {
    description: "Registra uma atividade (ligação, e-mail, reunião, nota…) na linha do tempo, opcionalmente ligada a um lead.",
    input_schema: {
      type: "object",
      properties: { tipo: { type: "string", enum: [...ACTIVITY_TIPO] }, descricao: { type: "string" }, lead_id: { type: "string" } },
      required: ["tipo", "descricao"],
    },
  },
  buscar_conhecimento: {
    description: "Busca na base de conhecimento da empresa (FAQs e documentos cadastrados em Assistente IA: produtos, preços, políticas, argumentos de venda). Use ao redigir mensagens ou responder dúvidas sobre a empresa.",
    input_schema: { type: "object", properties: { consulta: { type: "string", description: "Palavras-chave ou pergunta" } }, required: ["consulta"] },
  },
};

export const ROTULO_FERRAMENTA: Record<string, string> = {
  buscar_leads: "Buscando leads",
  contatos_de_hoje: "Vendo a agenda de hoje",
  ver_lead: "Abrindo ficha do lead",
  criar_lead: "Cadastrando lead",
  atualizar_lead: "Atualizando lead",
  resumo_metricas: "Calculando métricas",
  listar_pipeline: "Lendo o pipeline",
  criar_negocio: "Abrindo negócio",
  mover_negocio: "Movendo negócio",
  listar_campanhas: "Lendo campanhas",
  listar_respostas: "Lendo respostas rápidas",
  registrar_atividade: "Registrando atividade",
  buscar_conhecimento: "Consultando a base de conhecimento",
};

export function definirFerramentas(podeEditar: boolean): FerramentaNeutra[] {
  return (Object.keys(DEFINICOES) as Nome[])
    .filter((n) => podeEditar || !ESCRITA.includes(n))
    .map((name) => ({ name, description: DEFINICOES[name].description, parameters: DEFINICOES[name].input_schema }));
}

/** Economia de tokens: corta resultados longos antes de devolver ao modelo. */
const LIMITE_RESULTADO = 6000;
function enxugar(json: string) {
  return json.length <= LIMITE_RESULTADO ? json : `${json.slice(0, LIMITE_RESULTADO)}…[cortado: refine o filtro]`;
}

export function ehEscrita(nome: string) {
  return ESCRITA.includes(nome as Nome);
}

async function etapaPorNome(sb: SupabaseClient, nome?: string) {
  const { data } = await sb.from("pipeline_stages").select("id, nome").order("ordem");
  if (!data?.length) throw new Error("Usuário não tem etapas de pipeline.");
  if (!nome) return data[0];
  const alvo = data.find((e) => e.nome.toLowerCase() === nome.toLowerCase().trim());
  if (!alvo) throw new Error(`Etapa "${nome}" não existe. Etapas: ${data.map((e) => e.nome).join(", ")}`);
  return alvo;
}

/** Executa a ferramenta. Retorna texto (JSON) para o tool_result; lança erro em falha. */
export async function executarFerramenta(sb: SupabaseClient, nome: string, entrada: unknown, podeEditar: boolean): Promise<string> {
  if (!(nome in SCHEMAS)) throw new Error(`Ferramenta desconhecida: ${nome}`);
  if (ehEscrita(nome) && !podeEditar) throw new Error("Este agente está configurado como somente leitura.");
  const parsed = SCHEMAS[nome as Nome].safeParse(entrada);
  if (!parsed.success) {
    throw new Error(`Entrada inválida: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const i = parsed.data as Record<string, unknown>;
  const hoje = hojeISO();
  const ok = (v: unknown) => enxugar(JSON.stringify(v, (_k, val) => (val === null || val === "" ? undefined : val)));

  switch (nome as Nome) {
    case "buscar_leads": {
      let q = sb.from("leads").select("id, nome, empresa, cargo, segmento, status, proximo_contato_em")
        .order("created_at", { ascending: false }).limit((i.limite as number) ?? 15);
      if (i.status) q = q.eq("status", i.status);
      if (i.busca) {
        const t = String(i.busca).replace(/[%,()]/g, " ").trim();
        q = q.or(["nome", "empresa", "cargo", "segmento", "email", "cod"].map((c) => `${c}.ilike.%${t}%`).join(","));
      }
      const { data, error } = await q;
      if (error) throw error;
      return ok({ total: data.length, leads: data });
    }
    case "contatos_de_hoje": {
      const [{ data: leads, error }, { data: cad }] = await Promise.all([
        sb.from("leads").select("id, nome, empresa, status, proximo_contato_em").lte("proximo_contato_em", hoje).neq("status", "Perdido").order("proximo_contato_em"),
        sb.from("campaign_leads").select("id, etapas_concluidas, proximo_passo_em, lead:leads(nome, empresa), campanha:campaigns(nome, status)").eq("status", "Ativo").lte("proximo_passo_em", hoje),
      ]);
      if (error) throw error;
      return ok({ hoje, leads: leads ?? [], cadencias: cad ?? [] });
    }
    case "ver_lead": {
      const [{ data: lead, error }, { data: ativ }, { data: camp }] = await Promise.all([
        sb.from("leads").select("*").eq("id", i.lead_id).maybeSingle(),
        sb.from("activities").select("tipo, descricao, ocorreu_em").eq("lead_id", i.lead_id).order("ocorreu_em", { ascending: false }).limit(8),
        sb.from("campaign_leads").select("status, etapas_concluidas, campanha:campaigns(nome)").eq("lead_id", i.lead_id),
      ]);
      if (error) throw error;
      if (!lead) throw new Error("Lead não encontrado.");
      return ok({ lead, atividades: ativ ?? [], campanhas: camp ?? [] });
    }
    case "criar_lead": {
      const { data, error } = await sb.from("leads").insert({ ...i, origem: i.origem ?? "Prospecção" }).select("id, cod, nome, empresa, status").single();
      if (error) throw error;
      return ok({ criado: data });
    }
    case "atualizar_lead": {
      const { lead_id, ...campos } = i;
      if (!Object.keys(campos).length) throw new Error("Nada para atualizar.");
      const { data, error } = await sb.from("leads").update(campos).eq("id", lead_id).select("id, nome, status, proximo_contato_em").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Lead não encontrado.");
      return ok({ atualizado: data });
    }
    case "resumo_metricas": {
      const { data, error } = await sb.rpc("analytics_resumo", { dias: (i.dias as number) ?? 30 });
      if (error) throw error;
      return ok(data);
    }
    case "listar_pipeline": {
      const [{ data: etapas }, { data: deals, error }] = await Promise.all([
        sb.from("pipeline_stages").select("id, nome, ordem, probabilidade, tipo").order("ordem"),
        sb.from("deals").select("id, titulo, empresa, contato, valor, stage_id, etapa_entrada_em, data_fechamento_previsto"),
      ]);
      if (error) throw error;
      const agora = Date.now();
      return ok((etapas ?? []).map((e) => ({
        ...e,
        negocios: (deals ?? []).filter((d) => d.stage_id === e.id).map(({ stage_id: _s, etapa_entrada_em, ...d }) => ({
          ...d, dias_na_etapa: Math.floor((agora - new Date(etapa_entrada_em).getTime()) / 86400000),
        })),
      })));
    }
    case "criar_negocio": {
      const etapa = await etapaPorNome(sb, i.etapa as string | undefined);
      const { etapa: _e, ...resto } = i;
      const { data, error } = await sb.from("deals").insert({ ...resto, valor: (i.valor as number) ?? 0, stage_id: etapa.id }).select("id, titulo, valor").single();
      if (error) throw error;
      return ok({ criado: data, etapa: etapa.nome });
    }
    case "mover_negocio": {
      const etapa = await etapaPorNome(sb, i.etapa as string);
      const { data, error } = await sb.from("deals").update({ stage_id: etapa.id }).eq("id", i.negocio_id).select("id, titulo").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Negócio não encontrado.");
      return ok({ movido: data, etapa: etapa.nome });
    }
    case "listar_campanhas": {
      const { data, error } = await sb.from("campaigns").select("id, nome, descricao, status, iniciada_em, passos:campaign_steps(ordem, dia, canal, acao), leads:campaign_leads(status)");
      if (error) throw error;
      return ok((data ?? []).map((c) => ({
        ...c,
        passos: [...(c.passos ?? [])].sort((a, b) => a.ordem - b.ordem),
        leads: (c.leads ?? []).reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }), {}),
      })));
    }
    case "listar_respostas": {
      const { data, error } = await sb.from("templates").select("titulo, canal, assunto, corpo").order("usos", { ascending: false }).limit(10);
      if (error) throw error;
      return ok(data ?? []);
    }
    case "registrar_atividade": {
      const { error } = await sb.from("activities").insert(i);
      if (error) throw error;
      return ok({ registrado: true });
    }
    case "buscar_conhecimento": {
      // org null = empresa da sessão; o RLS garante que só a base da própria empresa aparece
      const trechos = await buscarConhecimento(sb, i.consulta as string, null, 5);
      return trechos.length ? ok(trechos.map((t) => ({ titulo: t.titulo, conteudo: t.trecho }))) : "Nada encontrado na base de conhecimento da empresa.";
    }
  }
}
