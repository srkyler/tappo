/* Pura — sem "server-only" nem "use client": usada nos dois lados pra decidir
 * se o texto em cima da cor de destaque deve ser preto ou branco (contraste). */

export function corTextoContraste(hex: string): "#000000" | "#FFFFFF" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#000000";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Luminância relativa (WCAG, simplificada em sRGB linear aproximado)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#000000" : "#FFFFFF";
}

export const CORES_RAPIDAS = [
  "#FFFFFF", "#3B82F6", "#22C55E", "#A855F7", "#EC4899", "#F59E0B", "#EF4444", "#06B6D4",
] as const;
