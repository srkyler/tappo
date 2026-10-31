/**
 * Célula CSV: sempre entre aspas (quebra de linha e vírgula ficam dentro), aspas
 * dobradas, e valor começando com = + - @ prefixado com ' — senão o Excel o
 * executa como fórmula (injeção de CSV com dado vindo de formulário público).
 */
export function celulaCsv(v: unknown) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}
