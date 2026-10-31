import "server-only";
import { decifrar } from "@/lib/ai/cofre";

/*
 * Cliente do WAHA (WhatsApp HTTP API — https://waha.devlike.pro).
 * Auth por header X-Api-Key (nunca na query string). Uma sessão por conexão.
 * Config de sessão no padrão do DeskcommCRM: webhook assinado por sessão, com
 * retentativa, filtro do que o CRM não atende e store do NOWEB (resolve @lid).
 */

export type Conexao = {
  id: string;
  org_id: string;
  user_id: string;
  distribuicao: "manual" | "rodizio";
  base_url: string;
  api_key_cifrada: string | null;
  sessao: string;
  token: string;
  status: string;
  numero: string | null;
  ia_ativa: boolean;
  ia_instrucoes: string;
  /** Atendente de IA deste número (null = o padrão da empresa). */
  atendente_id?: string | null;
};

/** message.ack = enviada/entregue/lida; message.revoked = apagada pelo contato. */
export const EVENTOS_WEBHOOK = ["message.any", "message.ack", "message.revoked", "session.status"];

/*
 * Estados, difusão, canais e grupos: o Inbox descarta tudo isso na entrada. O
 * `ignore` corta na fonte — o WAHA nem processa nem guarda (medido no
 * DeskcommCRM: a maior parte do volume de eventos era isso).
 */
const IGNORAR = { status: true, broadcast: true, channels: true, groups: true };

export function urlWebhook(token: string) {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${app}/api/v1/waha/${token}`;
}

/** Segredo do HMAC dos webhooks (mesmo valor dos dois lados). Curto demais = não configurado. */
export function segredoHmac(): string | null {
  const s = (process.env.WAHA_HMAC_SECRET ?? "").trim();
  return s.length >= 16 ? s : null;
}

/** URL e API key vêm do .env do servidor; a linha no banco é só fallback local. */
export function configWaha(c: Pick<Conexao, "base_url" | "api_key_cifrada">): { base: string; chave: string | null } {
  const baseEnv = (process.env.WAHA_BASE_URL || (process.env.WAHA_DOMAIN ? `https://${process.env.WAHA_DOMAIN}` : "")).replace(/\/+$/, "");
  const base = baseEnv || (c.base_url ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("WAHA não configurado no servidor (defina WAHA_BASE_URL ou WAHA_DOMAIN no .env).");
  const chave = process.env.WAHA_API_KEY || (c.api_key_cifrada ? decifrar(c.api_key_cifrada) : null);
  return { base, chave };
}

export const wahaServidorPronto = () =>
  !!(process.env.WAHA_BASE_URL || process.env.WAHA_DOMAIN);

const sessaoUrl = (c: Pick<Conexao, "sessao">) => encodeURIComponent(c.sessao);

async function chamar<T = unknown>(c: Conexao, metodo: string, caminho: string, corpo?: unknown, tetoMs = 20_000): Promise<T> {
  const { base, chave } = configWaha(c);
  const res = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      Accept: "application/json",
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(chave ? { "X-Api-Key": chave } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(tetoMs),
    cache: "no-store",
  });
  const txt = await res.text();
  if (!res.ok) throw new ErroWaha(res.status, txt.slice(0, 300));
  try { return (txt ? JSON.parse(txt) : null) as T; } catch { return txt as T; }
}

export class ErroWaha extends Error {
  constructor(public status: number, public detalhe: string) {
    super(status === 401 ? "WAHA recusou a API key." : status === 404 ? "Sessão não encontrada no WAHA." : `WAHA respondeu ${status}${detalhe ? `: ${detalhe}` : ""}`);
  }
}

export type Sessao = {
  name: string;
  status: string;
  engine?: { engine?: string } | null;
  me?: { id: string; pushName?: string } | null;
  config?: Record<string, unknown> | null;
};

export const lerSessao = (c: Conexao) => chamar<Sessao>(c, "GET", `/api/sessions/${sessaoUrl(c)}`);

/** Webhook do Tappo para esta conexão: assinado (HMAC SHA-512) e com retentativa exponencial. */
function webhookDoTappo(c: Conexao) {
  const segredo = segredoHmac();
  return {
    url: urlWebhook(c.token),
    events: EVENTOS_WEBHOOK,
    // O WHATSAPP_HOOK_HMAC_KEY do compose só assina o webhook GLOBAL; o de sessão
    // precisa da chave aqui, senão chega sem assinatura e a verificação nunca roda.
    ...(segredo ? { hmac: { key: segredo } } : {}),
    retries: { policy: "exponential", delaySeconds: 2, attempts: 6 },
  };
}

/*
 * Config que o Tappo quer na sessão. O PUT do WAHA SUBSTITUI a config inteira,
 * então partimos da atual e só enxertamos webhook + filtro. O `noweb.store` só é
 * ligado na criação: a doc do NOWEB avisa que mudá-lo depois do QR pode perder o
 * histórico. Com ele ligado, `GET /lids/{lid}` traduz contato @lid em telefone.
 */
function configDesejada(c: Conexao, atual: Sessao | null) {
  const base = (atual?.config && typeof atual.config === "object" ? { ...atual.config } : {}) as Record<string, unknown>;
  const outros = Array.isArray(base.webhooks)
    ? (base.webhooks as { url?: string }[]).filter((w) => w?.url && !w.url.includes("/api/v1/waha/"))
    : [];
  const ignoreAtual = base.ignore && typeof base.ignore === "object" ? base.ignore as Record<string, unknown> : {};
  const config: Record<string, unknown> = {
    ...base,
    webhooks: [...outros, webhookDoTappo(c)],
    ignore: { ...ignoreAtual, ...IGNORAR },
  };
  if (!atual && (process.env.WAHA_ENGINE ?? "").toUpperCase() === "NOWEB") {
    config.noweb = { store: { enabled: true, fullSync: false } };
  }
  return config;
}

/** Cria (ou reconfigura) a sessão com o webhook do Tappo e inicia. */
export async function iniciarSessao(c: Conexao) {
  let atual: Sessao | null = null;
  try { atual = await lerSessao(c); } catch (e) { if (!(e instanceof ErroWaha && e.status === 404)) throw e; }
  if (!atual) {
    await chamar(c, "POST", "/api/sessions", { name: c.sessao, start: true, config: configDesejada(c, null) });
    return;
  }
  // PUT numa sessão ativa reinicia com a config nova, sem QR (credenciais ficam em disco)
  await chamar(c, "PUT", `/api/sessions/${sessaoUrl(c)}`, { name: c.sessao, config: configDesejada(c, atual) });
  const s = await lerSessao(c);
  if (s.status === "STOPPED" || s.status === "FAILED") await chamar(c, "POST", `/api/sessions/${sessaoUrl(c)}/start`);
}

/** Inicia uma sessão parada (sem mexer na config). Usado pelo vigia de saúde. */
export const religarSessao = (c: Conexao) => chamar(c, "POST", `/api/sessions/${sessaoUrl(c)}/start`);

/** A sessão já está com o webhook do Tappo, os eventos certos e (se houver segredo) assinatura? */
export function sessaoConfigurada(c: Conexao, s: Sessao): boolean {
  const ws = Array.isArray(s.config?.webhooks)
    ? s.config.webhooks as { url?: string; events?: string[]; hmac?: { key?: string } | null }[]
    : [];
  const w = ws.find((x) => x?.url === urlWebhook(c.token));
  if (!w) return false;
  if (!EVENTOS_WEBHOOK.every((e) => w.events?.includes(e))) return false;
  return !segredoHmac() || !!w.hmac?.key;
}

/** QR code como data URL (só quando status = SCAN_QR_CODE). */
export async function lerQr(c: Conexao): Promise<string | null> {
  const r = await chamar<{ mimetype?: string; data?: string }>(c, "GET", `/api/${sessaoUrl(c)}/auth/qr?format=image`);
  return r?.data ? `data:${r.mimetype ?? "image/png"};base64,${r.data}` : null;
}

/** Código de 8 caracteres para vincular sem QR (WhatsApp → Aparelhos conectados → Conectar com número). */
export async function codigoDePareamento(c: Conexao, telefone: string): Promise<string | null> {
  const r = await chamar<{ code?: string }>(c, "POST", `/api/${sessaoUrl(c)}/auth/request-code`, { phoneNumber: telefone });
  return r?.code ?? null;
}

export const desconectar = (c: Conexao) => chamar(c, "POST", `/api/sessions/${sessaoUrl(c)}/logout`);

/** Apaga a sessão no WAHA (ao excluir a conexão) — senão ela segue viva mandando webhook para um token morto. */
export async function apagarSessao(c: Conexao) {
  try { await chamar(c, "DELETE", `/api/sessions/${sessaoUrl(c)}`); }
  catch (e) { if (!(e instanceof ErroWaha && e.status === 404)) throw e; }
}

export async function enviarTexto(c: Conexao, chatId: string, texto: string) {
  return chamar<{ id?: string | { _serialized?: string } }>(c, "POST", "/api/sendText", { session: c.sessao, chatId, text: texto });
}

export async function marcarLida(c: Conexao, chatId: string) {
  await chamar(c, "POST", "/api/sendSeen", { session: c.sessao, chatId }).catch(() => null);
}

export async function digitando(c: Conexao, chatId: string, ligado: boolean) {
  await chamar(c, "POST", ligado ? "/api/startTyping" : "/api/stopTyping", { session: c.sessao, chatId }).catch(() => null);
}

export function idDaMensagem(r: { id?: string | { _serialized?: string } } | null | undefined): string | null {
  if (!r?.id) return null;
  return typeof r.id === "string" ? r.id : r.id._serialized ?? null;
}

/*
 * O WAHA é assimétrico: o envio pode devolver o id cru (`3EB0…`) e o webhook o
 * completo (`true_5511…@c.us_3EB0…`). Para casar ack e eco com a linha gravada,
 * procuramos pelas duas formas.
 */
export function idsEquivalentes(id: string): string[] {
  const cru = id.split("_").pop() ?? id;
  return cru && cru !== id ? [id, cru] : [id];
}

/** "5511999998888@c.us" → "5511999998888". Outros formatos (@lid) → null. */
export function telefoneDoChat(chatId: string): string | null {
  const m = chatId.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/);
  return m ? m[1] : null;
}

/**
 * Telefone real de um contato @lid (número protegido pelo WhatsApp).
 * Precisa do store ligado (NOWEB) ou de WEBJS/GOWS recentes; falha → null.
 */
export async function telefoneDoLid(c: Conexao, chatId: string): Promise<string | null> {
  if (!chatId.endsWith("@lid")) return null;
  try {
    const r = await chamar<{ pn?: string | null }>(c, "GET", `/api/${sessaoUrl(c)}/lids/${encodeURIComponent(chatId)}`, undefined, 8_000);
    return r?.pn ? telefoneDoChat(r.pn) : null;
  } catch {
    return null;
  }
}

/** Telefone digitado → chatId do WhatsApp (assume Brasil se vier sem DDI). */
export function chatDoTelefone(fone: string): string | null {
  let d = fone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length <= 11) d = `55${d}`;
  return `${d}@c.us`;
}

/*
 * Mídia: o WAHA anuncia a URL com o endereço DELE (às vezes interno, ex.
 * http://localhost:3000) e o arquivo exige X-Api-Key — o navegador não abre.
 * O proxy do Tappo reconstrói a URL sobre a base do .env aproveitando só o
 * caminho (o host nunca vem do payload → sem SSRF) e só aceita /api/files/.
 */
export function urlDaMidia(c: Pick<Conexao, "base_url" | "api_key_cifrada">, anunciada: string): { url: string; chave: string | null } | null {
  let caminho: string;
  try {
    const u = new URL(anunciada);
    caminho = u.pathname + u.search;
  } catch {
    return null;
  }
  if (!caminho.startsWith("/api/files/") || caminho.includes("..")) return null;
  const { base, chave } = configWaha(c);
  return { url: `${base}${caminho}`, chave };
}
