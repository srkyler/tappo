import "server-only";
import { decifrar } from "@/lib/ai/cofre";

/*
 * Cliente mínimo do WAHA (WhatsApp HTTP API — https://waha.devlike.pro).
 * Auth por header X-Api-Key. Uma sessão por conexão.
 */

export type Conexao = {
  id: string;
  user_id: string;
  base_url: string;
  api_key_cifrada: string | null;
  sessao: string;
  token: string;
  status: string;
  numero: string | null;
  ia_ativa: boolean;
  ia_instrucoes: string;
};

export const EVENTOS_WEBHOOK = ["message.any", "session.status"];

export function urlWebhook(token: string) {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${app}/api/v1/waha/${token}`;
}

async function chamar<T = unknown>(c: Conexao, metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const chave = c.api_key_cifrada ? decifrar(c.api_key_cifrada) : null;
  const res = await fetch(`${c.base_url.replace(/\/+$/, "")}${caminho}`, {
    method: metodo,
    headers: {
      Accept: "application/json",
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(chave ? { "X-Api-Key": chave } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
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

export type Sessao = { name: string; status: string; me?: { id: string; pushName?: string } | null };

export const lerSessao = (c: Conexao) => chamar<Sessao>(c, "GET", `/api/sessions/${c.sessao}`);

/** Cria (ou atualiza) a sessão com o webhook do Tappo e inicia. */
export async function iniciarSessao(c: Conexao) {
  const config = { webhooks: [{ url: urlWebhook(c.token), events: EVENTOS_WEBHOOK }] };
  let existe = true;
  try { await lerSessao(c); } catch (e) { if (e instanceof ErroWaha && e.status === 404) existe = false; else throw e; }
  if (!existe) {
    await chamar(c, "POST", "/api/sessions", { name: c.sessao, start: true, config });
    return;
  }
  await chamar(c, "PUT", `/api/sessions/${c.sessao}`, { name: c.sessao, config });
  const s = await lerSessao(c);
  if (s.status === "STOPPED" || s.status === "FAILED") await chamar(c, "POST", `/api/sessions/${c.sessao}/start`);
}

/** QR code como data URL (só quando status = SCAN_QR_CODE). */
export async function lerQr(c: Conexao): Promise<string | null> {
  const r = await chamar<{ mimetype?: string; data?: string }>(c, "GET", `/api/${c.sessao}/auth/qr?format=image`);
  return r?.data ? `data:${r.mimetype ?? "image/png"};base64,${r.data}` : null;
}

export const desconectar = (c: Conexao) => chamar(c, "POST", `/api/sessions/${c.sessao}/logout`);

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

/** "5511999998888@c.us" → "5511999998888". Outros formatos (@lid) → null. */
export function telefoneDoChat(chatId: string): string | null {
  const m = chatId.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/);
  return m ? m[1] : null;
}

/** Telefone digitado → chatId do WhatsApp (assume Brasil se vier sem DDI). */
export function chatDoTelefone(fone: string): string | null {
  let d = fone.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length <= 11) d = `55${d}`;
  return `${d}@c.us`;
}
