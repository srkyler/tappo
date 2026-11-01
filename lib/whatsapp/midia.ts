import "server-only";
import { urlDaMidia, type Conexao } from "./waha";
import { baixarMidiaCloud, ehCloud } from "./cloud";

/**
 * Baixa a mídia de uma mensagem pelo provedor da conexão (WAHA ou Cloud API).
 * WAHA: URL reconstruída sobre a base do .env (sem SSRF). Cloud: "cloud:<media_id>".
 * null = indisponível (expirou, URL fora do provedor, etc.).
 */
export async function buscarMidia(c: Conexao, midiaUrl: string, tetoMs = 30_000): Promise<Response | null> {
  if (midiaUrl.startsWith("cloud:")) {
    if (!ehCloud(c)) return null;
    return baixarMidiaCloud(c, midiaUrl.slice(6), tetoMs);
  }
  if (ehCloud(c)) return null;
  const alvo = urlDaMidia(c, midiaUrl);
  if (!alvo) return null;
  const res = await fetch(alvo.url, {
    headers: alvo.chave ? { "X-Api-Key": alvo.chave } : {},
    signal: AbortSignal.timeout(tetoMs),
    cache: "no-store",
  }).catch(() => null);
  return res?.ok && res.body ? res : null;
}
