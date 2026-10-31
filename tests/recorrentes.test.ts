import { describe, expect, it } from "vitest";
import { proximaOcorrencia } from "@/lib/tarefas/recorrentes";

describe("tarefas recorrentes", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  it("diária pula para o futuro sem gerar rajada", () => {
    expect(proximaOcorrencia(new Date("2026-11-01T12:00:00Z"), "diaria", agora).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
  it("semanal mantém o dia da semana", () => {
    expect(proximaOcorrencia(new Date("2026-11-09T12:00:00Z"), "semanal", agora).toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });
  it("mensal no dia 31 cai no último dia de fevereiro", () => {
    expect(proximaOcorrencia(new Date("2027-01-31T12:00:00Z"), "mensal", new Date("2027-02-01T00:00:00Z")).toISOString()).toBe("2027-02-28T12:00:00.000Z");
  });
});
