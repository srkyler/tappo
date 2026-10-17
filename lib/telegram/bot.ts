import "server-only";
import { decifrar } from "@/lib/ai/cofre";

/*
 * Cliente mínimo da Bot API do Telegram (https://core.telegram.org/bots/api).
 * Sem sessão/QR como o WhatsApp: um token do @BotFather já é a conexão inteira.
 */

export type ConexaoTelegram = {
  id: string;
  org_id: string;
  user_id: string;
  distribuicao: "manual" | "rodizio";
  bot_token_cifrada: string | null;
  bot_username: string | null;
  webhook_secret: string;
  status: string;
  ia_ativa: boolean;
  ia_instrucoes: string;
};

export function urlWebhookTelegram(webhookSecret: string) {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${app}/api/v1/telegram/${webhookSecret}`;
}

export class ErroTelegram extends Error {
  constructor(public descricao: string) {
    super(`Telegram recusou: ${descricao}`);
  }
}

async function chamar<T = unknown>(botToken: string, metodo: string, corpo?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new ErroTelegram(json?.description ?? `HTTP ${res.status}`);
  return json.result as T;
}

/** Valida o token e devolve o @username do bot (usado ao salvar a conexão). */
export const getMe = (botToken: string) => chamar<{ username: string; id: number }>(botToken, "getMe");

export const definirWebhook = (botToken: string, url: string) =>
  chamar<boolean>(botToken, "setWebhook", { url, allowed_updates: ["message"], drop_pending_updates: false });

export const removerWebhook = (botToken: string) => chamar<boolean>(botToken, "deleteWebhook");

export const enviarTelegram = (botToken: string, chatId: string | number, texto: string) =>
  chamar<{ message_id: number }>(botToken, "sendMessage", { chat_id: chatId, text: texto });

export const digitandoTelegram = (botToken: string, chatId: string | number) =>
  chamar(botToken, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);

/** Token em texto puro a partir da conexão salva (cifrada no banco). */
export function tokenDa(c: Pick<ConexaoTelegram, "bot_token_cifrada">): string {
  if (!c.bot_token_cifrada) throw new Error("Conexão do Telegram sem token salvo.");
  return decifrar(c.bot_token_cifrada);
}
