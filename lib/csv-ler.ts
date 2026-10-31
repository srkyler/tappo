/*
 * Leitura de CSV/planilha exportada (Excel, Google Sheets, outros CRMs) para a
 * importação de leads. Roda no navegador e no servidor: sem dependências.
 *  - aspas com vírgula/quebra de linha dentro, aspas duplicadas ("")
 *  - separador detectado: ; , ou tab (Excel em pt-BR usa ;)
 *  - BOM do Excel removido
 */

export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.slice(0, t.search(/\r?\n/) === -1 ? t.length : t.search(/\r?\n/));
  const conta = (c: string) => primeira.split(c).length - 1;
  const sep = [";", ",", "\t"].sort((a, b) => conta(b) - conta(a))[0];

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) { linha.push(campo.trim()); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo.trim()); campo = "";
      if (linha.some((x) => x !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo.trim());
  if (linha.some((x) => x !== "")) linhas.push(linha);
  return linhas;
}

export const CAMPOS_LEAD = ["nome", "empresa", "cargo", "email", "telefone", "segmento", "notas"] as const;
export type CampoLead = (typeof CAMPOS_LEAD)[number];
export const ROTULO_CAMPO: Record<CampoLead, string> = {
  nome: "Nome *", empresa: "Empresa *", cargo: "Cargo", email: "E-mail", telefone: "Telefone / WhatsApp", segmento: "Segmento", notas: "Notas",
};

const SINONIMOS: Record<CampoLead, string[]> = {
  nome: ["nome", "name", "contato", "nome completo", "full name", "cliente", "responsavel", "pessoa", "first name"],
  empresa: ["empresa", "company", "razao social", "nome fantasia", "organizacao", "organization", "conta", "account", "negocio"],
  cargo: ["cargo", "title", "job title", "funcao", "posicao", "position"],
  email: ["email", "e-mail", "e mail", "mail", "endereco de email", "email address"],
  telefone: ["telefone", "phone", "celular", "whatsapp", "fone", "tel", "mobile", "numero", "telefone celular"],
  segmento: ["segmento", "setor", "industry", "ramo", "nicho", "categoria"],
  notas: ["notas", "observacoes", "obs", "notes", "comentarios", "descricao"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Para cada campo do lead, o índice da coluna mais provável (-1 = nenhuma). */
export function sugerirMapeamento(cabecalho: string[]): Record<CampoLead, number> {
  const cab = cabecalho.map(norm);
  const usado = new Set<number>();
  const r = {} as Record<CampoLead, number>;
  for (const campo of CAMPOS_LEAD) {
    let i = cab.findIndex((c, k) => !usado.has(k) && SINONIMOS[campo].includes(c));
    if (i < 0) i = cab.findIndex((c, k) => !usado.has(k) && SINONIMOS[campo].some((s) => s.length > 3 && c.includes(s)));
    r[campo] = i;
    if (i >= 0) usado.add(i);
  }
  return r;
}

export const soDigitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
/** Telefone para comparar duplicados: sem DDI 55 quando vier com ele. */
export function chaveTelefone(t: string | null | undefined): string {
  const d = soDigitos(t);
  return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
}
