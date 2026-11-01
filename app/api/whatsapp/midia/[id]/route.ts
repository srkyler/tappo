import { createClient } from "@/lib/supabase/server";
import type { Conexao } from "@/lib/whatsapp/waha";
import { buscarMidia } from "@/lib/whatsapp/midia";

/*
 * GET /api/whatsapp/midia/<mensagem_id> — entrega a foto/áudio/arquivo de uma
 * mensagem do WhatsApp para quem está logado na empresa dela.
 *
 * A URL que o WAHA anuncia aponta para o endereço dele e exige X-Api-Key; o
 * navegador não abre. Aqui: a leitura da mensagem passa pelo RLS (só membro da
 * empresa vê), a URL é reconstruída sobre a base do .env (lib/whatsapp/waha.ts
 * → urlDaMidia, sem SSRF) e a chave nunca sai do servidor.
 */

const TETO_BYTES = 30 * 1024 * 1024;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrada", { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Faça login", { status: 401 });

  const { data: msg } = await supabase.from("wa_mensagens")
    .select("org_id, conversa_id, midia_url, midia_mime, canal").eq("id", id).maybeSingle();
  if (!msg?.midia_url || msg.canal !== "whatsapp") return new Response("Não encontrada", { status: 404 });

  // Conexão que recebeu a conversa; sem ela, uma do mesmo provedor da mídia
  const { data: conv } = await supabase.from("wa_conversas").select("conexao_id").eq("id", msg.conversa_id).maybeSingle();
  let conexao: Conexao | null = null;
  if (conv?.conexao_id) {
    const { data } = await supabase.from("wa_conexoes").select("*").eq("id", conv.conexao_id).maybeSingle();
    conexao = (data as Conexao | null) ?? null;
  }
  if (!conexao) {
    const { data } = await supabase.from("wa_conexoes").select("*").eq("org_id", msg.org_id)
      .eq("provedor", msg.midia_url.startsWith("cloud:") ? "cloud" : "waha").limit(1).maybeSingle();
    conexao = (data as Conexao | null) ?? null;
  }
  if (!conexao) return new Response("Mídia indisponível", { status: 404 });

  let res: Response | null;
  try {
    res = await buscarMidia(conexao, msg.midia_url);
  } catch {
    return new Response("WhatsApp não configurado no servidor", { status: 503 });
  }
  // null = o provedor já apagou o arquivo (WHATSAPP_FILES_LIFETIME / 30 dias na Meta) ou a mídia não baixou
  if (!res?.body) return new Response("Mídia expirada ou indisponível no WhatsApp", { status: 404 });
  const tamanho = Number(res.headers.get("content-length") ?? 0);
  if (tamanho > TETO_BYTES) return new Response("Arquivo grande demais", { status: 413 });

  const tipo = msg.midia_mime || res.headers.get("content-type") || "application/octet-stream";
  return new Response(res.body, {
    headers: {
      "Content-Type": tipo,
      ...(tamanho ? { "Content-Length": String(tamanho) } : {}),
      // Arquivo do cliente: o navegador pode guardar, proxies compartilhados não
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // HTML/SVG enviado por contato nunca roda no domínio do Tappo
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
