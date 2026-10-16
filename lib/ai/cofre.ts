import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/*
 * Cofre de chaves de API: AES-256-GCM com segredo do servidor (AI_KEYS_SECRET).
 * O banco guarda só o texto cifrado; sem o segredo, a chave não pode ser lida.
 */

function segredo(): Buffer {
  const s = process.env.AI_KEYS_SECRET;
  if (!s || s.length < 32) throw new Error("AI_KEYS_SECRET ausente ou curto (mínimo 32 caracteres) no .env.local.");
  return createHash("sha256").update(s).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", segredo(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(".");
}

export function decifrar(pacote: string): string {
  const [v, iv, tag, dados] = pacote.split(".");
  if (v !== "v1" || !iv || !tag || !dados) throw new Error("Chave cifrada em formato inválido.");
  const d = createDecipheriv("aes-256-gcm", segredo(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
}

export const finalDaChave = (k: string) => (k.length > 8 ? `…${k.slice(-4)}` : "…");
