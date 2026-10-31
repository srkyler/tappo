import { describe, expect, it } from "vitest";
import { celulaCsv } from "@/lib/csv";

describe("CSV", () => {
  it("aspas, vírgula e quebra de linha ficam dentro da célula", () => {
    expect(celulaCsv('Ana "Bia", Ltda\nfilial')).toBe('"Ana ""Bia"", Ltda\nfilial"');
  });
  it("neutraliza fórmula do Excel", () => {
    expect(celulaCsv("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(celulaCsv("+5511")).toBe("\"'+5511\"");
    expect(celulaCsv(null)).toBe('""');
  });
});
