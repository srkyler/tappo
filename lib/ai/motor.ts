import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agente } from "./agentes";
import { decifrar } from "./cofre";
import { definirFerramentas, executarFerramenta, ROTULO_FERRAMENTA, type FerramentaNeutra } from "./ferramentas";
import { definirFerramentasJarvis, executarFerramentaJarvis, ROTULO_FERRAMENTA_JARVIS } from "./ferramentas-jarvis";
import { hojeISO } from "@/lib/data/format";

/*
 * Motor do Agente Tappo — um loop de ferramentas, dois adaptadores:
 *  - anthropic: SDK oficial (@anthropic-ai/sdk), cache de prompt, effort, fallback de recusa
 *  - openai:    qualquer API /chat/completions (NVIDIA NIM, OpenAI, Groq, OpenRouter, Ollama…)
 *
 * Economia de tokens:
 *  - histórico cortado (agente.max_historico) e mensagens longas truncadas
 *  - prompt de sistema curto; data/usuário fora do bloco cacheado
 *  - resultados de ferramentas enxutos (sem nulos, limite de linhas e de caracteres)
 *  - max_tokens de saída configurável; teto de iterações de ferramentas
 */

export type Mensagem = { role: "user" | "assistant"; content: string };
export type Evento =
  | { t: "texto"; d: string }
  | { t: "ferramenta"; nome: string; rotulo: string }
  | { t: "erro"; d: string }
  | { t: "meta"; transferiu: boolean; motivo: string | null; fontes: string[] }
  | { t: "fim"; uso: Uso };
export type Uso = { entrada: number; cache: number; saida: number; ferramentas: number };

type Contexto = {
  agente: Agente;
  sb: SupabaseClient | null; // null = teste sem ferramentas
  mensagens: Mensagem[];
  nomeUsuario?: string | null;
  emitir: (e: Evento) => void;
  sinal?: AbortSignal;
  /** "jarvis" = configura o Tappo (sem ferramentas de dados do CRM). Atendimento usa `sistema` + `ferramentas`. */
  modo?: "crm" | "jarvis";
  /** Prompt montado por quem chama (atendimento): `estavel` vai para o cache, `volatil` não. */
  sistema?: { estavel: string; volatil: string };
  /** Ferramentas injetadas por quem chama — substituem as do CRM/Jarvis. */
  ferramentas?: {
    definicoes: FerramentaNeutra[];
    rotulos: Record<string, string>;
    executar: (nome: string, entrada: unknown) => Promise<string>;
  };
};

const MAX_ITERACOES = 6;
const MAX_CHARS_MENSAGEM = 4000;

function prepararHistorico(msgs: Mensagem[], max: number): Mensagem[] {
  let h = msgs.slice(-max).map((m) => ({ ...m, content: m.content.length > MAX_CHARS_MENSAGEM ? `${m.content.slice(0, MAX_CHARS_MENSAGEM)}…` : m.content }));
  while (h.length && h[0].role !== "user") h = h.slice(1);
  return h;
}

function promptJarvis(a: Agente) {
  return [
    `Você é o Jarvis, o assistente de configuração do Tappo. Fala como "${a.nome}" mas seu trabalho aqui é só configurar o sistema — não é o agente que atende cliente.`,
    "Responda em português do Brasil, breve e direto. Use as ferramentas pra fazer de verdade (não só explicar como fazer manualmente).",
    "Antes de criar algo, se não tiver certeza do estado atual, rode diagnostico_configuracao primeiro.",
    "Automações sempre nascem pausadas — depois de criar uma, avise a pessoa que ela precisa revisar e ativar em /app/automacoes.",
    "Seu escopo é: diagnóstico de configuração, automações, SLA, promoções de marketing e convite de equipe. Pra qualquer outra coisa (conectar WhatsApp, mudar plano, etc.), diga exatamente em qual tela a pessoa encontra isso — não invente que você fez algo que não tem ferramenta pra fazer.",
    "O que o assistente de atendimento sabe e como ele atende (dados da empresa, base de conhecimento, memória, regras, horário, transferência para humano) se configura em /app/assistente; ligar/desligar a IA por conexão é em /app/conexoes. O modelo de IA é gerenciado pela plataforma: o cliente não escolhe nem troca.",
  ].join("\n");
}

function promptSistema(a: Agente, comFerramentas: boolean, ctx?: Pick<Contexto, "modo">) {
  if (ctx?.modo === "jarvis") return promptJarvis(a);
  return [
    `Você é "${a.nome}", agente de IA do Tappo (CRM de prospecção B2B).`,
    "Responda em português do Brasil, breve e objetivo. Markdown simples (listas, **negrito**).",
    comFerramentas
      ? "Use as ferramentas para consultar e alterar os dados reais do usuário; nunca invente números, nomes ou registros. Para alterar um registro, busque-o antes para ter o id. Não mostre ids ao usuário."
      : "Você não tem acesso a ferramentas nesta conversa.",
    comFerramentas && !a.pode_editar_dados ? "Você é somente leitura: sugira ações, mas não altere dados." : "",
    a.instrucoes.trim() ? `\nInstruções do administrador:\n${a.instrucoes.trim()}` : "",
  ].filter(Boolean).join("\n");
}

function contextoVolatil(nome?: string | null) {
  return `Hoje: ${hojeISO()} (America/Sao_Paulo).${nome ? ` Usuário: ${nome}.` : ""}`;
}

/** Prompt de sistema em duas partes: estável (cacheável) e volátil. */
function sistemaDo(ctx: Contexto, comFerramentas: boolean) {
  return ctx.sistema ?? { estavel: promptSistema(ctx.agente, comFerramentas, ctx), volatil: contextoVolatil(ctx.nomeUsuario) };
}

function chaveDo(a: Agente): string | null {
  return a.api_key_cifrada ? decifrar(a.api_key_cifrada) : null;
}

async function rodarFerramenta(ctx: Contexto, nome: string, entrada: unknown): Promise<{ conteudo: string; erro: boolean }> {
  const rotulos = ctx.ferramentas?.rotulos ?? (ctx.modo === "jarvis" ? ROTULO_FERRAMENTA_JARVIS : ROTULO_FERRAMENTA);
  ctx.emitir({ t: "ferramenta", nome, rotulo: rotulos[nome] ?? nome });
  try {
    const resultado = ctx.ferramentas
      ? await ctx.ferramentas.executar(nome, entrada)
      : ctx.modo === "jarvis"
        ? await executarFerramentaJarvis(ctx.sb!, nome, entrada)
        : await executarFerramenta(ctx.sb!, nome, entrada, ctx.agente.pode_editar_dados);
    return { conteudo: resultado, erro: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "falha";
    return { conteudo: `Erro: ${msg}`, erro: true };
  }
}

export async function rodarAgente(ctx: Contexto): Promise<Uso> {
  const ferramentas = ctx.ferramentas?.definicoes
    ?? (!ctx.sb ? [] : ctx.modo === "jarvis" ? definirFerramentasJarvis() : definirFerramentas(ctx.agente.pode_editar_dados));
  const historico = prepararHistorico(ctx.mensagens, ctx.agente.max_historico);
  if (!historico.length) throw new Error("Mensagem vazia.");
  return ctx.agente.provedor === "anthropic"
    ? rodarAnthropic(ctx, historico, ferramentas)
    : rodarOpenAI(ctx, historico, ferramentas);
}

/* ------------------------------------------------------------------ */
/* Anthropic (Claude) — SDK oficial                                     */
/* ------------------------------------------------------------------ */

// Fallback de recusa no servidor: disponível para Opus 5.5 e Sonnet 5.5
const COM_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

async function rodarAnthropic(ctx: Contexto, historico: Mensagem[], neutras: FerramentaNeutra[]): Promise<Uso> {
  const a = ctx.agente;
  const chave = chaveDo(a);
  const client = chave ? new Anthropic({ apiKey: chave }) : new Anthropic();
  const uso: Uso = { entrada: 0, cache: 0, saida: 0, ferramentas: 0 };

  const tools: Anthropic.Beta.BetaTool[] = neutras.map((f) => ({
    name: f.name,
    description: f.description,
    input_schema: f.parameters as Anthropic.Beta.BetaTool["input_schema"],
    eager_input_streaming: true,
  }));
  // Prefixo estável (ferramentas + regras) fica em cache; data/usuário/contexto vão depois do breakpoint
  const sis = sistemaDo(ctx, tools.length > 0);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: sis.estavel, cache_control: { type: "ephemeral" } },
    { type: "text", text: sis.volatil },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = historico.map((m) => ({ role: m.role, content: m.content }));
  const fallback = COM_FALLBACK.has(a.modelo);
  let tentativasJson = 0;

  for (let i = 0; i < MAX_ITERACOES; i++) {
    const stream = client.beta.messages.stream(
      {
        model: a.modelo,
        max_tokens: a.max_tokens,
        system,
        messages,
        ...(tools.length ? { tools } : {}),
        output_config: { effort: a.esforco },
        ...(a.temperatura !== null && !a.modelo.startsWith("claude-") ? { temperature: Number(a.temperatura) } : {}),
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      } as unknown as Anthropic.Beta.MessageCreateParams,
      { signal: ctx.sinal },
    );
    stream.on("text", (d) => ctx.emitir({ t: "texto", d }));

    let msg: Anthropic.Beta.BetaMessage;
    try {
      msg = await stream.finalMessage();
      tentativasJson = 0;
    } catch (err) {
      // Só reemite quando a entrada de ferramenta veio malformada; erros da API sobem
      if (err instanceof Anthropic.APIError || tentativasJson++ >= 2) throw err;
      continue;
    }

    uso.entrada += msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0);
    uso.cache += msg.usage.cache_read_input_tokens ?? 0;
    uso.saida += msg.usage.output_tokens;

    if ((msg.stop_reason as string | null) === "refusal") {
      ctx.emitir({ t: "texto", d: "\n\n_Não posso ajudar com esse pedido._" });
      break;
    }
    if ((msg.stop_reason as string | null) === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    const usos = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason === "max_tokens") {
      if (usos.length) ctx.emitir({ t: "erro", d: "Resposta cortada pelo limite de tokens. Aumente “máx. tokens” do agente no admin." });
      break;
    }
    if (!usos.length) break;

    messages.push({ role: "assistant", content: msg.content });
    // Ferramentas em paralelo; todos os resultados voltam numa única mensagem
    const resultados = await Promise.all(usos.map(async (u) => {
      uso.ferramentas++;
      const r = await rodarFerramenta(ctx, u.name, u.input);
      return { type: "tool_result" as const, tool_use_id: u.id, content: r.conteudo, ...(r.erro ? { is_error: true } : {}) };
    }));
    messages.push({ role: "user", content: resultados });
  }
  return uso;
}

/* ------------------------------------------------------------------ */
/* Compatível com OpenAI — NVIDIA NIM, OpenAI, Groq, OpenRouter…        */
/* ------------------------------------------------------------------ */

type MsgOA =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChamadaOA[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ChamadaOA = { id: string; type: "function"; function: { name: string; arguments: string } };

async function rodarOpenAI(ctx: Contexto, historico: Mensagem[], neutras: FerramentaNeutra[]): Promise<Uso> {
  const a = ctx.agente;
  const base = (a.base_url ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("URL base do provedor inválida. Configure no admin.");
  const chave = chaveDo(a);
  const uso: Uso = { entrada: 0, cache: 0, saida: 0, ferramentas: 0 };

  const sisOA = (comFerramentas: boolean) => { const x = sistemaDo(ctx, comFerramentas); return `${x.estavel}\n\n${x.volatil}`; };
  const messages: MsgOA[] = [
    { role: "system", content: sisOA(neutras.length > 0) },
    ...historico.map((m) => ({ role: m.role, content: m.content }) as MsgOA),
  ];
  let tools = neutras.map((f) => ({ type: "function" as const, function: { name: f.name, description: f.description, parameters: f.parameters } }));
  let comUsoNoStream = true;

  for (let i = 0; i < MAX_ITERACOES; i++) {
    const corpo = {
      model: a.modelo,
      messages,
      stream: true,
      max_tokens: a.max_tokens,
      ...(a.temperatura !== null ? { temperature: Number(a.temperatura) } : {}),
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      ...(comUsoNoStream ? { stream_options: { include_usage: true } } : {}),
    };
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(chave ? { Authorization: `Bearer ${chave}` } : {}),
        ...(a.preset === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "X-Title": "Tappo" } : {}),
      },
      body: JSON.stringify(corpo),
      signal: ctx.sinal,
    });

    if (!res.ok || !res.body) {
      const txt = (await res.text().catch(() => "")).slice(0, 400);
      // Provedores que não aceitam stream_options ou ferramentas: tenta de novo sem eles
      if (res.status === 400 && comUsoNoStream) { comUsoNoStream = false; i--; continue; }
      if (res.status === 400 && tools.length && /tool|function/i.test(txt)) {
        tools = [];
        messages[0] = { role: "system", content: sisOA(false) };
        i--; continue;
      }
      throw new Error(`Provedor respondeu ${res.status}${txt ? `: ${txt}` : ""}`);
    }

    // Leitura do SSE
    let texto = "";
    let fim: string | null = null;
    const chamadas: ChamadaOA[] = [];
    const leitor = res.body.getReader();
    const dec = new TextDecoder();
    let resto = "";
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      resto += dec.decode(value, { stream: true });
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      for (const linha of linhas) {
        const l = linha.trim();
        if (!l.startsWith("data:")) continue;
        const dado = l.slice(5).trim();
        if (dado === "[DONE]") continue;
        let j: {
          choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
        };
        try { j = JSON.parse(dado); } catch { continue; }
        if (j.usage) {
          const cache = j.usage.prompt_tokens_details?.cached_tokens ?? 0;
          uso.entrada += (j.usage.prompt_tokens ?? 0) - cache;
          uso.cache += cache;
          uso.saida += j.usage.completion_tokens ?? 0;
        }
        const ch = j.choices?.[0];
        if (!ch) continue;
        if (ch.delta?.content) { texto += ch.delta.content; ctx.emitir({ t: "texto", d: ch.delta.content }); }
        for (const tc of ch.delta?.tool_calls ?? []) {
          const c = (chamadas[tc.index] ??= { id: tc.id ?? `call_${i}_${tc.index}`, type: "function", function: { name: "", arguments: "" } });
          if (tc.id) c.id = tc.id;
          if (tc.function?.name) c.function.name += tc.function.name;
          if (tc.function?.arguments) c.function.arguments += tc.function.arguments;
        }
        if (ch.finish_reason) fim = ch.finish_reason;
      }
    }

    const validas = chamadas.filter(Boolean);
    if (!validas.length) {
      if (fim === "length") ctx.emitir({ t: "erro", d: "Resposta cortada pelo limite de tokens. Aumente “máx. tokens” do agente no admin." });
      break;
    }

    messages.push({ role: "assistant", content: texto || null, tool_calls: validas });
    const resultados = await Promise.all(validas.map(async (c) => {
      uso.ferramentas++;
      let entrada: unknown;
      try { entrada = c.function.arguments ? JSON.parse(c.function.arguments) : {}; }
      catch { return { role: "tool" as const, tool_call_id: c.id, content: "Erro: argumentos não são JSON válido. Tente de novo." }; }
      const r = await rodarFerramenta(ctx, c.function.name, entrada);
      return { role: "tool" as const, tool_call_id: c.id, content: r.conteudo };
    }));
    messages.push(...resultados);
  }
  return uso;
}
