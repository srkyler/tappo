import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteAtivo, type Agente } from "./agentes";
import { decifrar } from "./cofre";

/*
 * IA que entende mídia: transcreve áudio (API compatível com OpenAI
 * /audio/transcriptions — Groq whisper-large-v3, OpenAI…) e descreve imagem com
 * um modelo de visão (Claude ou qualquer /chat/completions que aceite image_url).
 * Configuração em ia_midia_config — só o admin da plataforma mexe.
 */

export type MidiaConfig = {
  transcricao_ativa: boolean;
  transcricao_base_url: string;
  transcricao_modelo: string;
  transcricao_chave: string | null;
  visao_ativa: boolean;
  visao_agent_id: string | null;
};

export async function midiaConfig(db: SupabaseClient): Promise<MidiaConfig | null> {
  const { data } = await db.from("ia_midia_config").select("*").eq("id", true).maybeSingle();
  return (data as MidiaConfig | null) ?? null;
}

const EXTENSAO: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/webm": "webm", "audio/amr": "amr",
};

/** Áudio → texto. WhatsApp manda voz em ogg/opus, que o Whisper aceita direto. */
export async function transcrever(cfg: MidiaConfig, bytes: ArrayBuffer, mime: string): Promise<string> {
  if (!cfg.transcricao_ativa) throw new Error("Transcrição desligada no /admin.");
  const base = cfg.transcricao_base_url.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("URL da transcrição inválida.");
  const tipo = mime.split(";")[0].trim() || "audio/ogg";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: tipo }), `audio.${EXTENSAO[tipo] ?? "ogg"}`);
  form.append("model", cfg.transcricao_modelo);
  form.append("language", "pt");
  form.append("response_format", "json");
  const chave = cfg.transcricao_chave ? decifrar(cfg.transcricao_chave) : null;
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: chave ? { Authorization: `Bearer ${chave}` } : {},
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Transcrição respondeu ${res.status}: ${txt.slice(0, 300)}`);
  try { return String((JSON.parse(txt) as { text?: string }).text ?? "").trim(); } catch { return txt.trim(); }
}

const PEDIDO_IMAGEM = "Descreva esta imagem enviada por um cliente no atendimento, em português, em até 4 frases objetivas. Se tiver texto (comprovante, print, documento, etiqueta), transcreva os dados importantes (valores, datas, nomes, códigos). Não invente.";
const MIME_IMAGEM_CLAUDE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Imagem → descrição em texto (a IA de atendimento lê a descrição). */
export async function descreverImagem(db: SupabaseClient, cfg: MidiaConfig, bytes: ArrayBuffer, mime: string): Promise<string> {
  if (!cfg.visao_ativa) throw new Error("Leitura de imagem desligada no /admin.");
  let agente: Agente | null = null;
  if (cfg.visao_agent_id) {
    const { data } = await db.from("ai_agents").select("*").eq("id", cfg.visao_agent_id).maybeSingle();
    agente = data as Agente | null;
  }
  agente ??= await agenteAtivo();
  if (!agente) throw new Error("Nenhum agente para ler imagens.");
  const tipo = mime.split(";")[0].trim() || "image/jpeg";
  const b64 = Buffer.from(bytes).toString("base64");
  const chave = agente.api_key_cifrada ? decifrar(agente.api_key_cifrada) : null;

  if (agente.provedor === "anthropic") {
    if (!MIME_IMAGEM_CLAUDE.has(tipo)) throw new Error(`Formato de imagem não suportado: ${tipo}`);
    const client = chave ? new Anthropic({ apiKey: chave }) : new Anthropic();
    const r = await client.messages.create({
      model: agente.modelo,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo as "image/jpeg", data: b64 } },
          { type: "text", text: PEDIDO_IMAGEM },
        ],
      }],
    });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  }

  const base = (agente.base_url ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("URL base do agente de visão inválida.");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(chave ? { Authorization: `Bearer ${chave}` } : {}) },
    body: JSON.stringify({
      model: agente.modelo,
      max_tokens: 500,
      messages: [{ role: "user", content: [
        { type: "text", text: PEDIDO_IMAGEM },
        { type: "image_url", image_url: { url: `data:${tipo};base64,${b64}` } },
      ] }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Modelo de visão respondeu ${res.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt) as { choices?: { message?: { content?: string } }[] };
  return (j.choices?.[0]?.message?.content ?? "").trim();
}
