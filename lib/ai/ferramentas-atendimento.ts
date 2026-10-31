import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { FerramentaNeutra } from "./ferramentas";
import { buscarConhecimento, type FerramentasLigadas } from "./assistente";
import type { Horario } from "./assistente-tipos";
import { criarEvento, deBrasilia, horarioCabe, horariosLivres, rotuloHorario, type ConfigAgenda } from "@/lib/google/agenda";

/*
 * Ferramentas do assistente no atendimento (WhatsApp, Telegram, e-mail, teste).
 * Rodam com a service role — o contato do outro lado controla o texto que chega à IA,
 * então TODA ferramenta fica presa a esta empresa e a esta conversa: nada de ids
 * vindos do modelo, nada de leitura de outros contatos. No modo teste nada é gravado.
 */

export type ConversaIA = {
  id: string | null;        // null no teste
  user_id: string;          // dono da conexão — vira user_id dos registros criados
  chat_id: string | null;
  canal: string;
  nome: string | null;
  telefone: string | null;
  lead_id: string | null;
  atribuido_a: string | null;
  /** Atendente de IA para quem a conversa foi passada (sobrepõe o do canal). */
  atendente_id?: string | null;
};

export type RegistroExecucao = {
  ferramentas: string[];
  conhecimento: Map<string, string>; // id → título (fontes usadas na resposta)
  transferir: { motivo: string } | null;
  /** Conversa passada para outro atendente de IA (multiagente, estilo DeskcommCRM). */
  outroAtendente: { id: string; nome: string } | null;
};

/** Outro atendente de IA da empresa para quem esta IA pode passar a conversa. */
export type ColegaIA = { id: string; nome: string; funcao: string };

type Ctx = {
  db: SupabaseClient;
  orgId: string;
  conversa: ConversaIA;
  contato: string | null;   // chave da memória (telefone ou chat_id)
  teste: boolean;
  ligadas: FerramentasLigadas;
  registro: RegistroExecucao;
  /** Outros atendentes de IA ativos da empresa (sem o atual). Vazio = ferramenta some. */
  colegas?: ColegaIA[];
  /** Google Agenda conectada e ligada: liga ver_horarios_livres/agendar_reuniao. */
  agenda?: { cfg: ConfigAgenda; horario: Horario } | null;
};

const SCHEMAS = {
  buscar_conhecimento: z.object({ consulta: z.string().min(2).max(300) }),
  ver_cliente: z.object({}),
  salvar_cliente: z.object({
    nome: z.string().min(1).max(120),
    empresa: z.string().max(120).optional(),
    email: z.string().max(160).optional(),
    interesse: z.string().max(500).optional(),
  }),
  lembrar_sobre_cliente: z.object({ fato: z.string().min(3).max(300) }),
  criar_tarefa_equipe: z.object({
    titulo: z.string().min(3).max(140),
    detalhes: z.string().max(800).optional(),
    quando: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "use AAAA-MM-DD ou AAAA-MM-DDTHH:MM").optional(),
  }),
  transferir_para_humano: z.object({ motivo: z.string().min(3).max(300) }),
  transferir_para_atendente: z.object({ atendente: z.string().min(1).max(60), motivo: z.string().min(3).max(300) }),
  ver_horarios_livres: z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").optional() }),
  agendar_reuniao: z.object({
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "use AAAA-MM-DDTHH:MM"),
    assunto: z.string().min(3).max(140),
    email_cliente: z.string().email().max(160).optional(),
  }),
} as const;
type Nome = keyof typeof SCHEMAS;

const DEFINICOES: Record<Nome, { description: string; parameters: Record<string, unknown> }> = {
  buscar_conhecimento: {
    description: "Busca na base de conhecimento da empresa (FAQs e documentos: produtos, preços, políticas, procedimentos). Use antes de responder qualquer dúvida cuja resposta não esteja no seu contexto.",
    parameters: { type: "object", properties: { consulta: { type: "string", description: "Palavras-chave ou a dúvida do cliente" } }, required: ["consulta"] },
  },
  ver_cliente: {
    description: "Ficha deste cliente no CRM (se já cadastrado): status, notas, próximos contatos, atividades e tarefas recentes.",
    parameters: { type: "object", properties: {} },
  },
  salvar_cliente: {
    description: "Cadastra este cliente no CRM (ou completa o cadastro existente) para a equipe acompanhar. O telefone da conversa é usado automaticamente.",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        empresa: { type: "string", description: "Empresa do cliente, se houver" },
        email: { type: "string" },
        interesse: { type: "string", description: "Resumo do que o cliente procura" },
      },
      required: ["nome"],
    },
  },
  lembrar_sobre_cliente: {
    description: "Guarda um fato curto sobre este cliente para os próximos atendimentos (ex.: 'Prefere contato à tarde', 'Orçamento de até R$ 5 mil').",
    parameters: { type: "object", properties: { fato: { type: "string" } }, required: ["fato"] },
  },
  criar_tarefa_equipe: {
    description: "Cria uma tarefa para a equipe humana sobre este cliente (retorno, ligação, visita, envio de proposta).",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        detalhes: { type: "string" },
        quando: { type: "string", description: "AAAA-MM-DD ou AAAA-MM-DDTHH:MM (horário de Brasília)" },
      },
      required: ["titulo"],
    },
  },
  transferir_para_humano: {
    description: "Passa a conversa para um atendente humano. Use junto com uma mensagem avisando o cliente.",
    parameters: { type: "object", properties: { motivo: { type: "string", description: "Por que precisa de um humano" } }, required: ["motivo"] },
  },
  transferir_para_atendente: {
    description: "Passa a conversa para outro atendente de IA da empresa, mais adequado ao assunto (a lista de colegas e a função de cada um está nas suas instruções). Use junto com uma mensagem avisando o cliente.",
    parameters: {
      type: "object",
      properties: {
        atendente: { type: "string", description: "Nome exato do colega" },
        motivo: { type: "string", description: "Assunto que o colega vai tratar" },
      },
      required: ["atendente", "motivo"],
    },
  },
  ver_horarios_livres: {
    description: "Horários livres na agenda da empresa para uma reunião/atendimento. Sem 'dia', traz as próximas opções; com 'dia', as opções daquele dia. Ofereça 2 ou 3 ao cliente — nunca invente horários.",
    parameters: { type: "object", properties: { dia: { type: "string", description: "AAAA-MM-DD (opcional)" } } },
  },
  agendar_reuniao: {
    description: "Marca a reunião na agenda da empresa num horário que o cliente ESCOLHEU entre os livres, e cria a tarefa para a equipe. Confirme data e hora com o cliente antes.",
    parameters: {
      type: "object",
      properties: {
        inicio: { type: "string", description: "AAAA-MM-DDTHH:MM (horário de Brasília), exatamente um dos horários livres" },
        assunto: { type: "string", description: "Do que se trata (ex.: 'Demonstração do produto')" },
        email_cliente: { type: "string", description: "E-mail do cliente para receber o convite (opcional)" },
      },
      required: ["inicio", "assunto"],
    },
  },
};

export const ROTULO_FERRAMENTA_ATENDIMENTO: Record<string, string> = {
  buscar_conhecimento: "Consultando a base de conhecimento",
  ver_cliente: "Abrindo a ficha do cliente",
  salvar_cliente: "Salvando o cliente no CRM",
  lembrar_sobre_cliente: "Guardando na memória",
  criar_tarefa_equipe: "Criando tarefa para a equipe",
  transferir_para_humano: "Transferindo para um humano",
  transferir_para_atendente: "Passando para outro atendente",
  ver_horarios_livres: "Consultando a agenda",
  agendar_reuniao: "Marcando a reunião",
};

function disponiveis(l: FerramentasLigadas, temColegas: boolean, temAgenda: boolean): Nome[] {
  return (Object.keys(DEFINICOES) as Nome[]).filter((n) =>
    (n !== "salvar_cliente" || l.lead) && (n !== "criar_tarefa_equipe" || l.tarefa) && (n !== "lembrar_sobre_cliente" || l.memoria)
    && (n !== "transferir_para_atendente" || temColegas)
    && ((n !== "ver_horarios_livres" && n !== "agendar_reuniao") || temAgenda));
}
const MAX_REUNIOES_FUTURAS_POR_CONVERSA = 2;

const TIPO_TAREFA: Record<string, string> = { whatsapp: "whatsapp", telegram: "outro", email: "email" };
const MAX_MEMORIAS_POR_CONTATO = 40;
const ok = (v: unknown) => JSON.stringify(v, (_k, val) => (val === null || val === "" ? undefined : val));

async function executar(ctx: Ctx, nome: string, entrada: unknown): Promise<string> {
  if (!(nome in SCHEMAS) || !disponiveis(ctx.ligadas, !!ctx.colegas?.length, !!ctx.agenda).includes(nome as Nome)) throw new Error(`Ferramenta indisponível: ${nome}`);
  const p = SCHEMAS[nome as Nome].safeParse(entrada);
  if (!p.success) throw new Error(`Entrada inválida: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const i = p.data as Record<string, string | undefined>;
  const { db, orgId, conversa, teste } = ctx;
  ctx.registro.ferramentas.push(nome);

  switch (nome as Nome) {
    case "buscar_conhecimento": {
      const trechos = await buscarConhecimento(db, i.consulta!, orgId, 4);
      trechos.forEach((t) => ctx.registro.conhecimento.set(t.conhecimento_id, t.titulo));
      return trechos.length
        ? ok(trechos.map((t) => ({ titulo: t.titulo, conteudo: t.trecho })))
        : "Nada encontrado na base de conhecimento. Não invente: diga que vai confirmar com a equipe.";
    }
    case "ver_cliente": {
      if (!conversa.lead_id) return "Este cliente ainda não está cadastrado no CRM.";
      const [{ data: lead }, { data: ativ }, { data: tarefas }] = await Promise.all([
        db.from("leads").select("nome, empresa, cargo, email, status, notas, proximo_contato_em").eq("org_id", orgId).eq("id", conversa.lead_id).maybeSingle(),
        db.from("activities").select("tipo, descricao, ocorreu_em").eq("org_id", orgId).eq("lead_id", conversa.lead_id).order("ocorreu_em", { ascending: false }).limit(5),
        db.from("tarefas").select("titulo, vence_em").eq("org_id", orgId).eq("lead_id", conversa.lead_id).is("concluida_em", null).limit(5),
      ]);
      if (!lead) return "Este cliente ainda não está cadastrado no CRM.";
      return ok({ ...lead, notas: lead.notas?.slice(0, 600), atividades: ativ ?? [], tarefas_abertas: tarefas ?? [] });
    }
    case "salvar_cliente": {
      const nota = i.interesse ? `Interesse (via assistente): ${i.interesse}` : null;
      if (teste) return ok({ simulado: true, mensagem: "Teste: o cliente seria salvo no CRM." });
      if (conversa.lead_id) {
        const { data: atual } = await db.from("leads").select("email, notas").eq("org_id", orgId).eq("id", conversa.lead_id).maybeSingle();
        if (atual) {
          const campos: Record<string, string> = {};
          if (i.email && !atual.email) campos.email = i.email;
          if (nota && !(atual.notas ?? "").includes(nota)) campos.notas = [atual.notas, nota].filter(Boolean).join("\n");
          if (Object.keys(campos).length) await db.from("leads").update(campos).eq("org_id", orgId).eq("id", conversa.lead_id);
          return ok({ atualizado: true });
        }
      }
      const { data: lead, error } = await db.from("leads").insert({
        org_id: orgId, user_id: conversa.user_id, nome: i.nome, empresa: i.empresa?.trim() || i.nome,
        email: i.email ?? null, telefone: conversa.telefone, origem: "Outro", notas: nota,
      }).select("id").single();
      if (error) throw error;
      conversa.lead_id = lead.id;
      if (conversa.id) await db.from("wa_conversas").update({ lead_id: lead.id }).eq("org_id", orgId).eq("id", conversa.id);
      return ok({ cadastrado: true });
    }
    case "lembrar_sobre_cliente": {
      if (!ctx.contato) return "Não há como identificar este contato para guardar memória.";
      if (teste) return ok({ simulado: true, mensagem: "Teste: o fato seria guardado na memória do cliente." });
      const { data: existentes } = await db.from("ia_memoria").select("id, fato").eq("org_id", orgId).eq("escopo", "contato").eq("contato", ctx.contato)
        .order("created_at", { ascending: true });
      const fato = i.fato!.trim();
      if (existentes?.some((m) => m.fato.toLowerCase() === fato.toLowerCase())) return ok({ ja_sabido: true });
      // Memória com teto: descarta os fatos mais antigos que a IA aprendeu
      if ((existentes?.length ?? 0) >= MAX_MEMORIAS_POR_CONTATO) {
        await db.from("ia_memoria").delete().eq("org_id", orgId).eq("id", existentes![0].id);
      }
      const { error } = await db.from("ia_memoria").insert({
        org_id: orgId, escopo: "contato", contato: ctx.contato, lead_id: conversa.lead_id, conversa_id: conversa.id,
        fato, origem: "ia", created_by: null,
      });
      if (error) throw error;
      return ok({ guardado: true });
    }
    case "criar_tarefa_equipe": {
      if (teste) return ok({ simulado: true, mensagem: "Teste: a tarefa seria criada para a equipe." });
      // "quando" vem em horário de Brasília; sem hora = 09:00
      const vence = i.quando ? new Date(`${i.quando.length === 10 ? `${i.quando}T09:00` : i.quando}:00-03:00`) : null;
      const { error } = await db.from("tarefas").insert({
        org_id: orgId, user_id: conversa.user_id, responsavel_id: conversa.atribuido_a ?? conversa.user_id,
        lead_id: conversa.lead_id, conversa_id: conversa.id, titulo: i.titulo,
        descricao: [i.detalhes, `Criada pelo assistente de IA${conversa.nome ? ` no atendimento de ${conversa.nome}` : ""}.`].filter(Boolean).join("\n\n"),
        tipo: TIPO_TAREFA[conversa.canal] ?? "outro", prioridade: "media",
        vence_em: vence && !Number.isNaN(vence.getTime()) ? vence.toISOString() : null,
      });
      if (error) throw error;
      return ok({ tarefa_criada: true });
    }
    case "transferir_para_humano": {
      ctx.registro.transferir = { motivo: i.motivo! };
      return "Transferência registrada. Avise o cliente, numa frase, que um atendente vai continuar a conversa.";
    }
    case "transferir_para_atendente": {
      const alvo = ctx.colegas?.find((c) => c.nome.toLowerCase() === i.atendente!.trim().toLowerCase());
      if (!alvo) throw new Error(`Não há colega chamado "${i.atendente}". Colegas: ${(ctx.colegas ?? []).map((c) => c.nome).join(", ")}`);
      if (!teste && conversa.id) {
        const { error } = await db.from("wa_conversas").update({ atendente_id: alvo.id }).eq("id", conversa.id).eq("org_id", orgId);
        if (error) throw error;
      }
      ctx.registro.outroAtendente = { id: alvo.id, nome: alvo.nome };
      return `Conversa passada para ${alvo.nome}${teste ? " (teste: nada foi gravado)" : ""}. Avise o cliente, numa frase, que ${alvo.nome} vai continuar o atendimento a partir da próxima mensagem.`;
    }
    case "ver_horarios_livres": {
      const { cfg, horario } = ctx.agenda!;
      const livres = await horariosLivres(db, cfg, horario, { dia: i.dia });
      if (!livres.length) return ok({ livres: [], aviso: i.dia ? "Sem horários livres nesse dia. Ofereça outro dia." : "Sem horários livres nos próximos dias. Ofereça transferir para a equipe." });
      return ok({ duracao_min: cfg.duracao_min, livres: livres.map((t) => ({ inicio: new Date(t - 3 * 3_600_000).toISOString().slice(0, 16), quando: rotuloHorario(t) })) });
    }
    case "agendar_reuniao": {
      const { cfg, horario } = ctx.agenda!;
      const inicio = deBrasilia(i.inicio!);
      const problema = await horarioCabe(db, cfg, horario, inicio);
      if (problema) return ok({ agendado: false, motivo: `${problema} Consulte ver_horarios_livres e ofereça outro.` });
      if (teste) return ok({ simulado: true, quando: rotuloHorario(inicio), mensagem: "Teste: a reunião seria marcada na agenda e a tarefa criada." });
      // O contato do outro lado controla o texto: no máximo N reuniões futuras por conversa
      if (conversa.id) {
        const { count } = await db.from("tarefas").select("id", { count: "exact", head: true })
          .eq("org_id", orgId).eq("conversa_id", conversa.id).not("google_evento_id", "is", null).is("concluida_em", null)
          .gt("vence_em", new Date().toISOString());
        if ((count ?? 0) >= MAX_REUNIOES_FUTURAS_POR_CONVERSA) return ok({ agendado: false, motivo: "Este cliente já tem reuniões marcadas. Para remarcar, transfira para a equipe." });
      }
      const quem = [conversa.nome, conversa.telefone ? `+${conversa.telefone}` : null].filter(Boolean).join(" · ") || "cliente";
      const titulo = `${i.assunto} — ${conversa.nome ?? "cliente"}`;
      const evento = await criarEvento(db, cfg, {
        inicio, titulo,
        descricao: `Marcado pelo assistente de IA do Tappo (${conversa.canal}).\nCliente: ${quem}${i.email_cliente ? `\nE-mail: ${i.email_cliente}` : ""}`,
        convidado: i.email_cliente ?? null,
      });
      const { error } = await db.from("tarefas").insert({
        org_id: orgId, user_id: conversa.user_id, responsavel_id: conversa.atribuido_a ?? conversa.user_id,
        lead_id: conversa.lead_id, conversa_id: conversa.id, titulo,
        descricao: `Reunião marcada pelo assistente de IA (Google Agenda).\nCliente: ${quem}`,
        tipo: "reuniao", prioridade: "alta", vence_em: new Date(inicio).toISOString(), google_evento_id: evento.id,
      });
      if (error) throw error;
      return ok({ agendado: true, quando: rotuloHorario(inicio), duracao_min: cfg.duracao_min, convite_enviado: !!i.email_cliente });
    }
  }
}

export function ferramentasAtendimento(ctx: Ctx): {
  definicoes: FerramentaNeutra[];
  rotulos: Record<string, string>;
  executar: (nome: string, entrada: unknown) => Promise<string>;
} {
  return {
    definicoes: disponiveis(ctx.ligadas, !!ctx.colegas?.length, !!ctx.agenda).map((name) => ({ name, description: DEFINICOES[name].description, parameters: DEFINICOES[name].parameters })),
    rotulos: ROTULO_FERRAMENTA_ATENDIMENTO,
    executar: (nome, entrada) => executar(ctx, nome, entrada),
  };
}
