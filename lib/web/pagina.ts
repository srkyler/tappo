import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/*
 * Baixa páginas públicas de um site informado pelo cliente (importar perfil da
 * empresa). A URL vem do usuário: sem cuidado vira SSRF (ler o metadata da nuvem,
 * o WAHA interno, o Supabase…). Por isso: só http(s), porta padrão, todo host é
 * resolvido e IP privado/reservado é recusado — inclusive depois de cada redirect.
 */

const TETO_BYTES = 1_500_000;

function ipPrivado(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPrivado(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function urlSegura(bruta: string): Promise<URL> {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(bruta) ? bruta : `https://${bruta}`); } catch { throw new Error("Endereço do site inválido."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Use um endereço http ou https.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Use o endereço público do site (sem porta).");
  if (u.username || u.password) throw new Error("Endereço com usuário/senha não é aceito.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new Error("Não encontrei esse site. Confira o endereço.");
  if (ips.some(ipPrivado)) throw new Error("Esse endereço não é um site público.");
  return u;
}

/** HTML → texto legível (sem script/style/nav), com espaços normalizados. */
export function textoDoHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export async function baixarPagina(endereco: string): Promise<{ url: URL; html: string }> {
  let u = await urlSegura(endereco);
  for (let saltos = 0; saltos < 4; saltos++) {
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "User-Agent": "TappoBot/1.0 (+importar perfil da empresa)", Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = await urlSegura(new URL(res.headers.get("location")!, u).toString()); // redirect também passa pela checagem
      continue;
    }
    if (!res.ok) throw new Error(`O site respondeu ${res.status}.`);
    if (!(res.headers.get("content-type") ?? "").includes("html")) throw new Error("Esse endereço não é uma página de site.");
    const buf = await res.arrayBuffer();
    return { url: u, html: new TextDecoder().decode(buf.slice(0, TETO_BYTES)) };
  }
  throw new Error("Redirecionamentos demais.");
}

/** Links internos que costumam ter o que interessa (sobre, serviços, preços, FAQ, contato). */
export function linksUteis(html: string, base: URL, max = 3): string[] {
  const achados = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let u: URL;
    try { u = new URL(m[1], base); } catch { continue; }
    if (u.hostname !== base.hostname) continue;
    if (/sobre|quem-somos|about|servi[cç]o|produto|pre[cç]o|planos|faq|duvida|perguntas|contato/i.test(u.pathname)) {
      achados.add(u.origin + u.pathname);
      if (achados.size >= max) break;
    }
  }
  return [...achados];
}
