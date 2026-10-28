import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_ORIGEM, type LeadOrigem } from "@/lib/data/types";
import { dispararWebhooks } from "@/lib/webhooks/saida";

/*
 * POST /api/v1/webhooks/in/<token> — recebe um lead de landing page, formulário, Zapier, n8n…
 * Aceita JSON ou form-urlencoded. O token identifica a fonte (e o dono). Sem sessão.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Limite por token (por instância): 60 por minuto
const janelas = new Map<string, number[]>();
function permitido(token: string) {
  const agora = Date.now();
  const l = (janelas.get(token) ?? []).filter((t) => agora - t < 60_000);
  if (l.length >= 60) return false;
  l.push(agora);
  janelas.set(token, l);
  return true;
}

const ALIASES: Record<string, string[]> = {
  nome: ["nome", "name", "full_name", "fullname", "nome_completo", "first_name"],
  empresa: ["empresa", "company", "company_name", "organizacao", "organization"],
  email: ["email", "e-mail", "mail"],
  telefone: ["telefone", "phone", "whatsapp", "celular", "tel", "mobile"],
  cargo: ["cargo", "role", "title", "job_title", "funcao"],
  segmento: ["segmento", "segment", "industry", "setor"],
  linkedin_url: ["linkedin", "linkedin_url"],
  notas: ["notas", "mensagem", "message", "obs", "observacoes", "comments"],
  origem: ["origem", "source", "utm_source"],
};

function texto(v: unknown, max = 500) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function pegar(dados: Record<string, unknown>, campo: string, max?: number) {
  const chaves = Object.keys(dados);
  for (const a of ALIASES[campo]) {
    const k = chaves.find((c) => c.toLowerCase() === a);
    if (k) { const v = texto(dados[k], max); if (v) return v; }
  }
  return null;
}

async function lerCorpo(req: Request): Promise<Record<string, unknown> | null> {
  const tipo = req.headers.get("content-type") ?? "";
  const bruto = await req.text();
  if (bruto.length > 20_000) return null;
  try {
    if (tipo.includes("application/json")) return JSON.parse(bruto);
    if (tipo.includes("form")) return Object.fromEntries(new URLSearchParams(bruto));
    return JSON.parse(bruto);
  } catch {
    try { return Object.fromEntries(new URLSearchParams(bruto)); } catch { return null; }
  }
}

const resposta = (status: number, corpo: object) => Response.json(corpo, { status, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) return resposta(404, { ok: false, erro: "Fonte não encontrada." });
  if (!permitido(token)) return resposta(429, { ok: false, erro: "Muitas requisições. Tente em 1 minuto." });

  const db = createAdminClient();
  const { data: fonte } = await db.from("lead_sources").select("id, org_id, user_id, nome, origem, status_inicial, ativo, recebidos").eq("token", token).maybeSingle();
  if (!fonte || !fonte.ativo) return resposta(404, { ok: false, erro: "Fonte não encontrada ou pausada." });

  const dados = await lerCorpo(req);
  const payload = !dados ? null : JSON.stringify(dados).length <= 4000 ? dados : { truncado: true, campos: Object.keys(dados).slice(0, 50) };
  const registrar = (ok: boolean, resultado: string) =>
    db.from("webhook_log").insert({ org_id: fonte.org_id, user_id: fonte.user_id, source_id: fonte.id, ok, resultado, payload });

  if (!dados || typeof dados !== "object") {
    await registrar(false, "Corpo inválido (envie JSON ou formulário).");
    return resposta(400, { ok: false, erro: "Corpo inválido. Envie JSON ou formulário." });
  }

  const email = pegar(dados, "email", 200)?.toLowerCase() ?? null;
  const nome = pegar(dados, "nome", 200) ?? (email ? email.split("@")[0] : null);
  const empresa = pegar(dados, "empresa", 200) ?? (email && !/gmail|hotmail|outlook|yahoo|icloud|live\./.test(email) ? email.split("@")[1] : null) ?? "Não informada";
  if (!nome) {
    await registrar(false, "Faltou o campo nome (ou email).");
    return resposta(422, { ok: false, erro: "Envie pelo menos nome ou email." });
  }

  const origemTxt = pegar(dados, "origem", 40);
  const origem = (LEAD_ORIGEM as readonly string[]).find((o) => o.toLowerCase() === origemTxt?.toLowerCase()) as LeadOrigem | undefined;

  // Mesmo e-mail já na base: não duplica, registra o novo contato no histórico
  if (email) {
    const { data: existente } = await db.from("leads").select("id, cod, nome").eq("org_id", fonte.org_id).ilike("email", email).maybeSingle();
    if (existente) {
      await db.from("activities").insert({ org_id: fonte.org_id, user_id: fonte.user_id, lead_id: existente.id, tipo: "outro", descricao: `${existente.nome} chegou de novo por "${fonte.nome}"${pegar(dados, "notas", 300) ? `: ${pegar(dados, "notas", 300)}` : ""}` });
      await db.from("lead_sources").update({ recebidos: fonte.recebidos + 1, ultimo_em: new Date().toISOString() }).eq("id", fonte.id);
      await registrar(true, `Lead já existia (${existente.cod}) — contato registrado.`);
      return resposta(200, { ok: true, duplicado: true, cod: existente.cod });
    }
  }

  const { data: lead, error } = await db.from("leads").insert({
    org_id: fonte.org_id,
    user_id: fonte.user_id,
    nome,
    empresa,
    email,
    telefone: pegar(dados, "telefone", 40),
    cargo: pegar(dados, "cargo", 120),
    segmento: pegar(dados, "segmento", 120),
    linkedin_url: pegar(dados, "linkedin_url", 300),
    notas: pegar(dados, "notas", 2000),
    origem: origem ?? fonte.origem,
    status: fonte.status_inicial,
    proximo_contato_em: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  }).select("id, cod").single();

  if (error) {
    await registrar(false, `Erro ao salvar: ${error.message.slice(0, 200)}`);
    return resposta(500, { ok: false, erro: "Não foi possível salvar o lead." });
  }

  await db.from("lead_sources").update({ recebidos: fonte.recebidos + 1, ultimo_em: new Date().toISOString() }).eq("id", fonte.id);
  after(() => dispararWebhooks(db, fonte.org_id, "lead.criado", {
    id: lead.id, cod: lead.cod, nome, empresa, email, telefone: pegar(dados, "telefone", 40),
    origem: origem ?? fonte.origem, status: fonte.status_inicial,
  }));
  await registrar(true, `Lead criado: ${lead.cod}`);
  return resposta(201, { ok: true, cod: lead.cod });
}
