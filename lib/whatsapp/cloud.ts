import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { decifrar } from "@/lib/ai/cofre";
import type { Conexao, Sessao } from "./waha";

/*
 * WhatsApp oficial — Cloud API da Meta (graph.facebook.com). Alternativa ao
 * WAHA por conexão (wa_conexoes.provedor = 'cloud'). O Tappo guarda o chat no
 * mesmo formato do WAHA ("5511999998888@c.us"), então conversas, IA, follow-up e
 * atendentes funcionam igual; aqui só se troca o "fio".
 *
 * Diferenças que importam:
 *  - Janela de 24h: fora dela a Meta só aceita mensagem de modelo (template)
 *    aprovado. O erro 131047 vira uma mensagem clara para o atendente.
 *  - Sem QR: a conexão é validada lendo o número na Graph API.
 *  - Webhook assinado com X-Hub-Signature-256 (HMAC-SHA256 do corpo, app secret).
 */

const VERSAO = () => (process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0").replace(/[^v0-9.]/g, "") || "v23.0";
const GRAPH = () => `https://graph.facebook.com/${VERSAO()}`;

export const ehCloud = (c: Pick<Conexao, "provedor"> | null | undefined) => c?.provedor === "cloud";

function credenciais(c: Conexao): { numeroId: string; token: string } {
  if (!c.cloud_phone_number_id || !c.cloud_token_cifrado) throw new Error("Conexão oficial sem ID do número ou token de acesso.");
  if (!/^\d{5,25}$/.test(c.cloud_phone_number_id)) throw new Error("ID do número inválido.");
  return { numeroId: c.cloud_phone_number_id, token: decifrar(c.cloud_token_cifrado) };
}

export class ErroCloud extends Error {
  constructor(public status: number, public codigo: number | null, detalhe: string) {
    super(
      codigo === 131047 ? "Passaram 24h desde a última mensagem do cliente: o WhatsApp oficial só permite enviar um modelo (template) aprovado."
        : codigo === 190 || status === 401 ? "Token da Meta inválido ou expirado. Gere um token permanente (usuário do sistema) e salve de novo."
        : codigo === 131056 ? "Muitas mensagens para este contato em pouco tempo (limite da Meta). Tente em instantes."
        : `WhatsApp oficial respondeu ${status}${detalhe ? `: ${detalhe}` : ""}`,
    );
  }
}

async function graph<T>(token: string, metodo: string, caminho: string, corpo?: unknown, tetoMs = 20_000): Promise<T> {
  const res = await fetch(`${GRAPH()}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(tetoMs),
    cache: "no-store",
  });
  const txt = await res.text();
  let j: unknown = null;
  try { j = txt ? JSON.parse(txt) : null; } catch { /* não-JSON */ }
  if (!res.ok) {
    const e = (j as { error?: { code?: number; message?: string; error_data?: { details?: string } } } | null)?.error;
    throw new ErroCloud(res.status, e?.code ?? null, (e?.error_data?.details || e?.message || txt).slice(0, 300));
  }
  return j as T;
}

/** "5511999998888@c.us" → "5511999998888" (o "to" da Cloud API é só dígitos com DDI). */
export function destinoDoChat(chatId: string): string {
  const d = chatId.split("@")[0].replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) throw new Error("Contato sem telefone válido para o WhatsApp oficial.");
  return d;
}

/** wa_id da Meta (só dígitos) → chat no formato do Tappo. */
export const chatDoWaId = (waId: string) => `${waId.replace(/\D/g, "")}@c.us`;

export async function enviarTextoCloud(c: Conexao, chatId: string, texto: string): Promise<{ id: string | null }> {
  const { numeroId, token } = credenciais(c);
  const r = await graph<{ messages?: { id: string }[] }>(token, "POST", `/${numeroId}/messages`, {
    messaging_product: "whatsapp", recipient_type: "individual", to: destinoDoChat(chatId),
    type: "text", text: { body: texto.slice(0, 4096), preview_url: false },
  });
  return { id: r?.messages?.[0]?.id ?? null };
}

/** Mensagem de modelo aprovado (para falar fora da janela de 24h). Parâmetros do corpo em ordem: {{1}}, {{2}}… */
export async function enviarTemplateCloud(c: Conexao, chatId: string, nome: string, idioma: string, parametros: string[] = []): Promise<{ id: string | null }> {
  if (!/^[a-z0-9_]{1,512}$/.test(nome)) throw new Error("Nome do modelo inválido (use o nome exato aprovado na Meta).");
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(idioma)) throw new Error("Idioma do modelo inválido (ex.: pt_BR).");
  const { numeroId, token } = credenciais(c);
  const r = await graph<{ messages?: { id: string }[] }>(token, "POST", `/${numeroId}/messages`, {
    messaging_product: "whatsapp", to: destinoDoChat(chatId), type: "template",
    template: {
      name: nome, language: { code: idioma },
      ...(parametros.length ? { components: [{ type: "body", parameters: parametros.slice(0, 20).map((t) => ({ type: "text", text: t.slice(0, 1000) })) }] } : {}),
    },
  });
  return { id: r?.messages?.[0]?.id ?? null };
}

/** Confirma leitura (dois tiques azuis) da mensagem recebida. */
export async function marcarLidaCloud(c: Conexao, mensagemId: string) {
  const { numeroId, token } = credenciais(c);
  await graph(token, "POST", `/${numeroId}/messages`, { messaging_product: "whatsapp", status: "read", message_id: mensagemId }).catch(() => null);
}

/** "Sessão" sintética: valida o número na Graph API (WORKING) ou devolve FAILED com o motivo. */
export async function lerSessaoCloud(c: Conexao): Promise<Sessao> {
  try {
    const { numeroId, token } = credenciais(c);
    const r = await graph<{ display_phone_number?: string; verified_name?: string }>(token, "GET", `/${numeroId}?fields=display_phone_number,verified_name,quality_rating`);
    const numero = (r?.display_phone_number ?? "").replace(/\D/g, "");
    return { name: c.sessao, status: "WORKING", engine: { engine: "CLOUD_API" }, me: numero ? { id: `${numero}@c.us`, pushName: r?.verified_name } : null };
  } catch (e) {
    return { name: c.sessao, status: "FAILED", engine: { engine: "CLOUD_API" }, me: null, config: { erro: e instanceof Error ? e.message : String(e) } };
  }
}

/** Baixa a mídia de uma mensagem (id da Meta). Duas idas: metadados → arquivo, ambos com o token. */
export async function baixarMidiaCloud(c: Conexao, mediaId: string, tetoMs = 30_000): Promise<Response | null> {
  if (!/^\d{5,40}$/.test(mediaId)) return null;
  const { token } = credenciais(c);
  const meta = await graph<{ url?: string; mime_type?: string }>(token, "GET", `/${mediaId}`).catch(() => null);
  if (!meta?.url) return null;
  // A URL vem da Meta: só aceita host da própria Meta (sem SSRF)
  let u: URL;
  try { u = new URL(meta.url); } catch { return null; }
  if (u.protocol !== "https:" || !/(^|\.)(fbcdn\.net|facebook\.com|whatsapp\.net|fbsbx\.com)$/.test(u.hostname)) return null;
  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(tetoMs), cache: "no-store" }).catch(() => null);
  return res?.ok ? res : null;
}

/** Confere X-Hub-Signature-256 com o app secret da conexão (fail-closed). */
export function assinaturaMetaValida(c: Pick<Conexao, "cloud_app_secret_cifrado">, cabecalho: string | null, corpo: string): boolean {
  if (!cabecalho || !c.cloud_app_secret_cifrado) return false;
  let segredo: string;
  try { segredo = decifrar(c.cloud_app_secret_cifrado); } catch { return false; }
  const esperado = createHmac("sha256", segredo).update(corpo, "utf8").digest("hex");
  const recebido = cabecalho.replace(/^sha256=/i, "").trim().toLowerCase();
  if (recebido.length !== esperado.length) return false;
  try { return timingSafeEqual(Buffer.from(recebido, "hex"), Buffer.from(esperado, "hex")); } catch { return false; }
}

export function urlWebhookCloud(token: string) {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${app}/api/v1/whatsapp-cloud/${token}`;
}
