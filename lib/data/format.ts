import type { ActivityTipo } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pt-BR");

export const formatBRL = (v: number) => brl.format(v);
export const formatNum = (v: number) => num.format(v);

/** "2026-10-16" → "16/10/2026" (sem fuso — datas puras do banco) */
export function formatData(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/** Data de hoje em America/Sao_Paulo no formato YYYY-MM-DD */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export const ICONE_ATIVIDADE: Record<ActivityTipo, string> = {
  ligacao: "☎",
  email: "✉",
  whatsapp: "◍",
  linkedin: "in",
  reuniao: "◷",
  nota: "✎",
  importacao: "⇪",
  movimentacao: "➜",
  proposta: "§",
  campanha: "◈",
  outro: "•",
};

/** Lê string de FormData; vazia vira null */
export function campo(fd: FormData, nome: string): string | null {
  const v = fd.get(nome);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function traduzErro(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/User already registered/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/Password should be at least/i.test(msg)) return "A senha é muito curta.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/violates foreign key|deals_stage/i.test(msg)) return "Registro vinculado a outro item — remova os vínculos antes.";
  if (/duplicate key/i.test(msg)) return "Este registro já existe.";
  return msg;
}

/** ISO de N dias atrás (para filtros de período no servidor) */
export function isoDiasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString();
}
