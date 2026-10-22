import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { FerramentaNeutra } from "./ferramentas";

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!(value as z.ZodTypeAny).isOptional()) required.push(key);
    }
    return { type: "object", properties, required: required.length ? required : undefined };
  }
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodNullable) return zodToJsonSchema(schema.unwrap());
  return { type: "string" };
}

/*
 * Ferramentas do Jarvis — assistente de CONFIGURAÇÃO do Tappo (não é o agente
 * que conversa com leads/clientes). Roda com o cliente Supabase do usuário
 * logado (RLS = só a empresa dele), igual o agente principal.
 *
 * Escopo deliberadamente pequeno: diagnóstico, automações, SLA, promoções e
 * convite de equipe. Qualquer coisa fora disso, o Jarvis orienta a pessoa a
 * ir na tela certa — não tenta fingir que configura tudo.
 */

const SCHEMAS = {
  diagnostico_configuracao: z.object({}),
  criar_automacao: z.object({
    nome: z.string().min(1),
    gatilho: z.enum(["lead_mudou_status", "lead_entrou_campanha", "deal_mudou_etapa", "tag_adicionada"]),
    gatilho_valor: z.string().optional(),
    acao: z.enum(["mover_etapa", "adicionar_tag", "atribuir_responsavel", "criar_tarefa"]),
    acao_valor: z.string().optional(),
  }),
  configurar_sla: z.object({
    tempo_resposta_min: z.number().int().min(1).max(1440),
    ativo: z.boolean().optional(),
  }),
  criar_promocao: z.object({
    titulo: z.string().min(1),
    oferta: z.string().optional(),
    descricao: z.string().optional(),
    data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    canal: z.enum(["whatsapp", "email", "instagram", "site", "outro"]).optional(),
  }),
  convidar_membro: z.object({
    email: z.string().email(),
    papel: z.enum(["gestor", "vendedor", "atendente"]),
  }),
} as const;
type Nome = keyof typeof SCHEMAS;

const DEFINICOES: Record<Nome, { description: string }> = {
  diagnostico_configuracao: { description: "Verifica o que já está configurado: equipe, conexões (WhatsApp/Telegram/E-mail), agente de IA ativo, SLA, automações, funis. Use isso ANTES de sugerir o que configurar." },
  criar_automacao: { description: "Cria uma automação QUANDO/SE/ENTÃO. Sempre nasce PAUSADA — avise o usuário que ele precisa ativar na tela /app/automacoes depois de revisar." },
  configurar_sla: { description: "Define o tempo máximo de resposta (minutos) que gera alerta no inbox e no painel do gestor." },
  criar_promocao: { description: "Cria uma promoção/oferta no calendário de marketing." },
  convidar_membro: { description: "Convida alguém por e-mail para a equipe, com o papel escolhido (gestor, vendedor ou atendente). Só funciona se quem está conversando for dono ou gestor." },
};

export const ROTULO_FERRAMENTA_JARVIS: Record<string, string> = {
  diagnostico_configuracao: "Verificando configuração",
  criar_automacao: "Criando automação",
  configurar_sla: "Configurando SLA",
  criar_promocao: "Criando promoção",
  convidar_membro: "Convidando membro",
};

export function definirFerramentasJarvis(): FerramentaNeutra[] {
  return (Object.keys(DEFINICOES) as Nome[]).map((name) => ({
    name,
    description: DEFINICOES[name].description,
    parameters: zodToJsonSchema(SCHEMAS[name]) as Record<string, unknown>,
  }));
}

export async function executarFerramentaJarvis(sb: SupabaseClient, nome: string, entrada: unknown): Promise<string> {
  if (!(nome in SCHEMAS)) throw new Error(`Ferramenta desconhecida: ${nome}`);
  const parsed = SCHEMAS[nome as Nome].safeParse(entrada);
  if (!parsed.success) throw new Error(`Entrada inválida: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const i = parsed.data as Record<string, unknown>;
  const ok = (v: unknown) => JSON.stringify(v, (_k, val) => (val === null || val === "" ? undefined : val));

  switch (nome as Nome) {
    case "diagnostico_configuracao": {
      const [membros, waha, telegram, email, agentes, sla, automacoes, pipelines] = await Promise.all([
        sb.from("org_membros").select("user_id", { count: "exact", head: true }),
        sb.from("wa_conexoes").select("status"),
        sb.from("telegram_conexoes").select("status").maybeSingle(),
        sb.from("email_conexoes").select("endereco_recebe").maybeSingle(),
        sb.from("ai_agents").select("id, nome, ativo"),
        sb.from("sla_config").select("tempo_resposta_min, ativo").maybeSingle(),
        sb.from("automacoes").select("id, ativo"),
        sb.from("pipelines").select("id, nome"),
      ]);
      const agenteAtivo = (agentes.data ?? []).find((a) => a.ativo);
      return ok({
        equipe_membros: membros.count ?? 0,
        whatsapp_conexoes: (waha.data ?? []).length,
        whatsapp_conectado: (waha.data ?? []).some((c) => c.status === "WORKING"),
        telegram_conectado: telegram.data?.status === "WORKING",
        email_configurado: !!email.data?.endereco_recebe,
        agente_ia_ativo: agenteAtivo?.nome ?? null,
        sla: sla.data ?? "não configurado",
        automacoes_total: (automacoes.data ?? []).length,
        automacoes_ativas: (automacoes.data ?? []).filter((a) => a.ativo).length,
        funis: (pipelines.data ?? []).map((p) => p.nome),
      });
    }

    case "criar_automacao": {
      const { data, error } = await sb.from("automacoes").insert({
        nome: i.nome, gatilho: i.gatilho, gatilho_valor: i.gatilho_valor ?? null,
        acao: i.acao, acao_valor: i.acao_valor ?? null, ativo: false,
      }).select("id").single();
      if (error) throw error;
      return ok({ id: data.id, criada: true, status: "pausada — ative em /app/automacoes depois de revisar" });
    }

    case "configurar_sla": {
      const { error } = await sb.from("sla_config").upsert(
        { tempo_resposta_min: i.tempo_resposta_min, ativo: i.ativo ?? true },
        { onConflict: "org_id" },
      );
      if (error) throw error;
      return ok({ configurado: true, tempo_resposta_min: i.tempo_resposta_min });
    }

    case "criar_promocao": {
      const { data, error } = await sb.from("promocoes").insert({
        titulo: i.titulo, oferta: i.oferta ?? null, descricao: i.descricao ?? null,
        data_inicio: i.data_inicio, data_fim: i.data_fim ?? null, canal: i.canal ?? "whatsapp",
      }).select("id").single();
      if (error) throw error;
      return ok({ id: data.id, criada: true });
    }

    case "convidar_membro": {
      const { convidar } = await import("@/app/app/empresa/actions");
      const r = await convidar(i.email as string, i.papel as string);
      if (!r.ok) throw new Error(r.erro);
      return ok({ convidado: true, email: i.email, direto: r.direto });
    }
  }
}
