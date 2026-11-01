import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { bloqueada, telaConfiguravel } from "@/lib/telas";
import { lerEmailAutomacao, preencherVariaveis } from "@/lib/automacoes";

describe("permissões por tela", () => {
  it("bloqueia a tela e as subpáginas, sem pegar prefixo parecido", () => {
    expect(bloqueada("/app/leads", ["/app/leads"])).toBe(true);
    expect(bloqueada("/app/leads/123", ["/app/leads"])).toBe(true);
    expect(bloqueada("/app/leadsx", ["/app/leads"])).toBe(false);
    expect(bloqueada("/app", ["/app/leads"])).toBe(false);
  });
  it("só aceita telas conhecidas", () => {
    expect(telaConfiguravel("/app/pipeline")).toBe(true);
    expect(telaConfiguravel("/admin")).toBe(false);
  });
});

describe("e-mail da automação", () => {
  it("lê o JSON e recusa formato inválido", () => {
    expect(lerEmailAutomacao(JSON.stringify({ assunto: "Oi", texto: "Olá" }))).toEqual({ assunto: "Oi", texto: "Olá" });
    expect(lerEmailAutomacao("texto solto")).toBeNull();
    expect(lerEmailAutomacao(JSON.stringify({ assunto: " ", texto: "x" }))).toBeNull();
  });
  it("preenche variáveis", () => {
    expect(preencherVariaveis("Olá {{primeiro_nome}} da {{ empresa }} ({{nome}})", { nome: "Ana Souza", empresa: "Acme" })).toBe("Olá Ana da Acme (Ana Souza)");
  });
});
