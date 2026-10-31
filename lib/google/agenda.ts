import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrar, decifrar } from "@/lib/ai/cofre";
import { iguaisTempoConstante } from "@/lib/auth/rate-limit";
import type { Horario } from "@/lib/ai/assistente-tipos";

/*
 * Google Agenda por empresa. O app OAuth é da plataforma (GOOGLE_CLIENT_ID/SECRET);
 * cada empresa autoriza a própria conta e o refresh token fica cifrado em
 * public.google_agenda (só service role). A IA usa isso para ver horários livres e
 * marcar reuniões; a tela Calendário mostra os eventos ao lado das tarefas.
 *
 * Fuso: America/Sao_Paulo é UTC-3 fixo desde 2019 (sem horário de verão).
 */

const ESCOPOS = [
  "openid", "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");
const FUSO = "America/Sao_Paulo";
const OFFSET_MS = 3 * 3_600_000;
const HORARIO_PADRAO: Horario = { "1": ["09:00", "18:00"], "2": ["09:00", "18:00"], "3": ["09:00", "18:00"], "4": ["09:00", "18:00"], "5": ["09:00", "18:00"] };

export type ConfigAgenda = {
  org_id: string;
  email: string | null;
  refresh_token_cifrado: string;
  agenda_id: string;
  duracao_min: number;
  antecedencia_horas: number;
  dias_a_frente: number;
  ativo: boolean;
};

export const googleConfigurado = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const urlRetorno = () => `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/api/integracoes/google/callback`;

/* ---------------- OAuth (state assinado + nonce em cookie) ---------------- */

function chaveEstado() {
  const s = process.env.AI_KEYS_SECRET;
  if (!s || s.length < 32) throw new Error("AI_KEYS_SECRET ausente no servidor.");
  return createHmac("sha256", s).update("google-oauth-state").digest();
}
const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function inicioOAuth(orgId: string, userId: string): { url: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const corpo = b64(JSON.stringify({ o: orgId, u: userId, n: nonce, e: Date.now() + 10 * 60_000 }));
  const state = `${corpo}.${createHmac("sha256", chaveEstado()).update(corpo).digest("base64url")}`;
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: urlRetorno(), response_type: "code",
    scope: ESCOPOS, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, nonce };
}

export function lerEstado(state: string, nonceCookie: string | undefined): { orgId: string; userId: string } | null {
  const [corpo, sig] = state.split(".");
  if (!corpo || !sig || !nonceCookie) return null;
  if (!iguaisTempoConstante(sig, createHmac("sha256", chaveEstado()).update(corpo).digest("base64url"))) return null;
  try {
    const v = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { o: string; u: string; n: string; e: number };
    if (v.e < Date.now() || !iguaisTempoConstante(v.n, nonceCookie)) return null;
    return { orgId: v.o, userId: v.u };
  } catch { return null; }
}

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string; scope?: string };
  if (!res.ok || !j.access_token) throw Object.assign(new Error(`Google recusou: ${j.error ?? res.status}`), { codigo: j.error });
  return j;
}

/** Troca o code pelo refresh token e grava (cifrado) para a empresa. */
export async function concluirOAuth(db: SupabaseClient, orgId: string, userId: string, code: string) {
  const t = await token({ grant_type: "authorization_code", code, redirect_uri: urlRetorno() });
  if (!t.refresh_token) throw new Error("O Google não devolveu acesso offline. Tente conectar de novo.");
  if (!t.scope?.includes("calendar")) throw new Error("Permissão da agenda não concedida. Marque a opção da agenda na tela do Google.");
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(t.id_token!.split(".")[1], "base64url").toString("utf8")).email ?? null; } catch { /* sem e-mail, segue */ }
  const { error } = await db.from("google_agenda").upsert({
    org_id: orgId, email, refresh_token_cifrado: cifrar(t.refresh_token), ativo: true, conectado_por: userId, updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  if (error) throw error;
  cacheAcesso.delete(orgId);
}

export async function desconectarAgenda(db: SupabaseClient, orgId: string) {
  const cfg = await configAgenda(db, orgId, true);
  if (cfg) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decifrar(cfg.refresh_token_cifrado))}`, { method: "POST", signal: AbortSignal.timeout(10_000) });
    } catch { /* revogar é cortesia; apagar o token já corta o acesso */ }
  }
  cacheAcesso.delete(orgId);
  await db.from("google_agenda").delete().eq("org_id", orgId);
}

/* ---------------- API da agenda ---------------- */

export async function configAgenda(db: SupabaseClient, orgId: string, mesmoInativa = false): Promise<ConfigAgenda | null> {
  const { data } = await db.from("google_agenda").select("*").eq("org_id", orgId).maybeSingle();
  if (!data || (!mesmoInativa && !data.ativo)) return null;
  return data as ConfigAgenda;
}

const cacheAcesso = new Map<string, { token: string; vale: number }>();

async function acesso(db: SupabaseClient, cfg: ConfigAgenda): Promise<string> {
  const c = cacheAcesso.get(cfg.org_id);
  if (c && c.vale > Date.now() + 60_000) return c.token;
  try {
    const t = await token({ grant_type: "refresh_token", refresh_token: decifrar(cfg.refresh_token_cifrado) });
    cacheAcesso.set(cfg.org_id, { token: t.access_token!, vale: Date.now() + (t.expires_in ?? 3600) * 1000 });
    return t.access_token!;
  } catch (e) {
    // Acesso revogado na conta Google: desliga para a IA parar de oferecer horários
    if ((e as { codigo?: string }).codigo === "invalid_grant") await db.from("google_agenda").update({ ativo: false }).eq("org_id", cfg.org_id);
    throw e;
  }
}

async function google<T>(db: SupabaseClient, cfg: ConfigAgenda, caminho: string, init?: { method?: string; body?: unknown; query?: Record<string, string> }): Promise<T> {
  const q = init?.query ? `?${new URLSearchParams(init.query)}` : "";
  const res = await fetch(`https://www.googleapis.com/calendar/v3${caminho}${q}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${await acesso(db, cfg)}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Agenda respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

type Intervalo = { inicio: number; fim: number };

async function ocupados(db: SupabaseClient, cfg: ConfigAgenda, de: number, ate: number): Promise<Intervalo[]> {
  const r = await google<{ calendars: Record<string, { busy?: { start: string; end: string }[] }> }>(db, cfg, "/freeBusy", {
    method: "POST",
    body: { timeMin: new Date(de).toISOString(), timeMax: new Date(ate).toISOString(), timeZone: FUSO, items: [{ id: cfg.agenda_id }] },
  });
  return (r.calendars[cfg.agenda_id]?.busy ?? []).map((b) => ({ inicio: Date.parse(b.start), fim: Date.parse(b.end) }));
}

/** "AAAA-MM-DDTHH:MM" em Brasília → epoch ms. */
export function deBrasilia(local: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + OFFSET_MS;
}
/** epoch ms → partes em Brasília. */
function emBrasilia(ms: number) {
  const d = new Date(ms - OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    dia: d.getUTCDay(),
    data: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hhmm: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function rotuloHorario(ms: number) {
  const b = emBrasilia(ms);
  return `${SEMANA[b.dia]} ${b.data.slice(8, 10)}/${b.data.slice(5, 7)} às ${b.hhmm}`;
}

/** Janelas de atendimento (horário da empresa) entre `de` e `ate`. */
function janelas(horario: Horario, de: number, ate: number): Intervalo[] {
  const h = Object.keys(horario).length ? horario : HORARIO_PADRAO;
  const out: Intervalo[] = [];
  for (let t = de - 86_400_000; t < ate + 86_400_000; t += 86_400_000) {
    const b = emBrasilia(t);
    const faixa = h[String(b.dia)];
    if (!faixa) continue;
    const ini = deBrasilia(`${b.data}T${faixa[0]}`), fim = deBrasilia(`${b.data}T${faixa[1]}`);
    if (fim > de && ini < ate) out.push({ inicio: Math.max(ini, de), fim: Math.min(fim, ate) });
  }
  return out;
}

const PASSO = 30 * 60_000;
const sobrepoe = (a: Intervalo, b: Intervalo) => a.inicio < b.fim && b.inicio < a.fim;

/** Horários livres (no máximo 3 por dia, até `max`), já respeitando antecedência e expediente. */
export async function horariosLivres(db: SupabaseClient, cfg: ConfigAgenda, horario: Horario, opcoes: { dia?: string; max?: number } = {}) {
  const dur = cfg.duracao_min * 60_000;
  const minimo = Math.ceil((Date.now() + cfg.antecedencia_horas * 3_600_000) / PASSO) * PASSO;
  let de = minimo, ate = Date.now() + cfg.dias_a_frente * 86_400_000;
  if (opcoes.dia) {
    de = Math.max(minimo, deBrasilia(`${opcoes.dia}T00:00`));
    ate = Math.min(ate, deBrasilia(`${opcoes.dia}T00:00`) + 86_400_000);
    if (!(ate > de)) return [];
  }
  const busy = await ocupados(db, cfg, de, ate);
  const porDia = new Map<string, number>();
  const livres: number[] = [];
  const max = opcoes.max ?? 9;
  for (const j of janelas(horario, de, ate)) {
    for (let t = Math.ceil(j.inicio / PASSO) * PASSO; t + dur <= j.fim; t += PASSO) {
      const slot = { inicio: t, fim: t + dur };
      if (busy.some((b) => sobrepoe(b, slot))) continue;
      const d = emBrasilia(t).data;
      if ((porDia.get(d) ?? 0) >= (opcoes.dia ? 8 : 3)) continue;
      porDia.set(d, (porDia.get(d) ?? 0) + 1);
      livres.push(t);
      if (livres.length >= max) return livres;
      t += dur - PASSO; // espaça as sugestões: próximo horário só depois do fim deste
    }
  }
  return livres;
}

/** Confere se o horário pedido cabe (expediente, antecedência, agenda livre). */
export async function horarioCabe(db: SupabaseClient, cfg: ConfigAgenda, horario: Horario, inicio: number): Promise<string | null> {
  const fim = inicio + cfg.duracao_min * 60_000;
  if (Number.isNaN(inicio)) return "Horário em formato inválido (use AAAA-MM-DDTHH:MM).";
  if (inicio < Date.now() + cfg.antecedencia_horas * 3_600_000) return `É preciso marcar com pelo menos ${cfg.antecedencia_horas}h de antecedência.`;
  if (inicio > Date.now() + cfg.dias_a_frente * 86_400_000) return `Só dá para marcar nos próximos ${cfg.dias_a_frente} dias.`;
  if (!janelas(horario, inicio, fim).some((j) => j.inicio <= inicio && j.fim >= fim)) return "Fora do horário de atendimento da empresa.";
  if ((await ocupados(db, cfg, inicio, fim)).some((b) => sobrepoe(b, { inicio, fim }))) return "Esse horário acabou de ser ocupado.";
  return null;
}

export async function criarEvento(db: SupabaseClient, cfg: ConfigAgenda, e: { inicio: number; titulo: string; descricao: string; convidado?: string | null }) {
  const fim = e.inicio + cfg.duracao_min * 60_000;
  const r = await google<{ id: string; htmlLink?: string }>(db, cfg, `/calendars/${encodeURIComponent(cfg.agenda_id)}/events`, {
    method: "POST",
    query: { sendUpdates: e.convidado ? "all" : "none" },
    body: {
      summary: e.titulo.slice(0, 200), description: e.descricao.slice(0, 4000),
      start: { dateTime: new Date(e.inicio).toISOString(), timeZone: FUSO },
      end: { dateTime: new Date(fim).toISOString(), timeZone: FUSO },
      ...(e.convidado ? { attendees: [{ email: e.convidado }] } : {}),
      source: { title: "Tappo", url: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "") },
    },
  });
  return { id: r.id, fim };
}

export type EventoAgenda = { id: string; titulo: string; inicio: string; fim: string; diaInteiro: boolean; link: string | null };

export async function eventosEntre(db: SupabaseClient, cfg: ConfigAgenda, de: Date, ate: Date): Promise<EventoAgenda[]> {
  const r = await google<{ items?: { id: string; summary?: string; htmlLink?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }[] }>(
    db, cfg, `/calendars/${encodeURIComponent(cfg.agenda_id)}/events`,
    { query: { timeMin: de.toISOString(), timeMax: ate.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" } },
  );
  return (r.items ?? []).map((i) => ({
    id: i.id, titulo: i.summary ?? "(sem título)", link: i.htmlLink ?? null,
    diaInteiro: !i.start.dateTime,
    inicio: i.start.dateTime ?? `${i.start.date}T00:00:00-03:00`,
    fim: i.end.dateTime ?? `${i.end.date}T00:00:00-03:00`,
  }));
}
