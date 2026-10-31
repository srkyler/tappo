import { describe, expect, it } from "vitest";
import { chaveTelefone, lerCsv, sugerirMapeamento } from "@/lib/csv-ler";

describe("importação de leads", () => {
  it("lê CSV do Excel pt-BR (; e aspas)", () => {
    const l = lerCsv('﻿Nome;Empresa;Observações\r\n"Silva, Ana";"Agro ""Lima""";"linha 1\nlinha 2"\r\nBruno;Beta;\r\n');
    expect(l).toEqual([["Nome", "Empresa", "Observações"], ["Silva, Ana", 'Agro "Lima"', "linha 1\nlinha 2"], ["Bruno", "Beta", ""]]);
  });
  it("sugere colunas por sinônimo, sem acento", () => {
    const m = sugerirMapeamento(["Razão Social", "Contato", "E-mail", "Celular", "Observações"]);
    expect(m).toMatchObject({ empresa: 0, nome: 1, email: 2, telefone: 3, notas: 4, cargo: -1 });
  });
  it("compara telefone com e sem 55", () => {
    expect(chaveTelefone("+55 (11) 99999-8888")).toBe(chaveTelefone("11 99999 8888"));
  });
});
