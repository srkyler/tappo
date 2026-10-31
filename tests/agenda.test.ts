import { describe, expect, it } from "vitest";
import { deBrasilia, rotuloHorario } from "@/lib/google/agenda";

describe("Google Agenda — fuso de Brasília", () => {
  it("converte horário local (UTC-3) para UTC", () => {
    expect(new Date(deBrasilia("2026-11-03T10:00")).toISOString()).toBe("2026-11-03T13:00:00.000Z");
    expect(new Date(deBrasilia("2026-11-03T22:30")).toISOString()).toBe("2026-11-04T01:30:00.000Z");
  });
  it("recusa formato inválido", () => {
    expect(Number.isNaN(deBrasilia("03/11/2026 10:00"))).toBe(true);
  });
  it("rotula no fuso local, inclusive perto da meia-noite UTC", () => {
    expect(rotuloHorario(Date.parse("2026-11-04T01:30:00Z"))).toBe("ter 03/11 às 22:30");
  });
});
