import { describe, expect, it } from "vitest";
import { conteudoDaMensagem } from "@/lib/ai/atendimento";
import { dentroDoHorario } from "@/lib/ai/assistente";
import { perfilComAtendente } from "@/lib/ai/atendentes";
import { perfilPadrao, type Atendente } from "@/lib/ai/assistente-tipos";

describe("mídia no histórico da IA", () => {
  it("usa a transcrição do áudio", () => {
    expect(conteudoDaMensagem({ corpo: null, tipo: "audio", transcricao: "quero um orçamento" })).toBe("[Áudio do cliente, transcrito] quero um orçamento");
  });
  it("sem transcrição, avisa a IA para pedir texto (nunca fica sem resposta)", () => {
    expect(conteudoDaMensagem({ corpo: null, tipo: "audio", transcricao: null })).toMatch(/não consegue ouvir/);
    expect(conteudoDaMensagem({ corpo: "olha isso", tipo: "imagem", transcricao: null })).toMatch(/não consegue ver[\s\S]*olha isso/);
  });
  it("texto puro passa direto", () => {
    expect(conteudoDaMensagem({ corpo: " oi ", tipo: "texto" })).toBe("oi");
    expect(conteudoDaMensagem({ corpo: null, tipo: "texto" })).toBeNull();
  });
});

describe("horário de atendimento (Brasília)", () => {
  const h = { "1": ["08:00", "18:00"] as [string, string] };
  it("segunda 10h dentro, 19h fora, domingo fechado", () => {
    expect(dentroDoHorario(h, new Date("2026-11-02T13:00:00Z"))).toBe(true);  // seg 10:00 BRT
    expect(dentroDoHorario(h, new Date("2026-11-02T22:00:00Z"))).toBe(false); // seg 19:00 BRT
    expect(dentroDoHorario(h, new Date("2026-11-01T13:00:00Z"))).toBe(false); // domingo
  });
  it("sem horário configurado = null (não restringe)", () => {
    expect(dentroDoHorario({})).toBeNull();
  });
});

describe("vários atendentes", () => {
  const base = { ...perfilPadrao("org"), nome_assistente: "Assistente", regras: "Nunca dar desconto." };
  const ana: Atendente = {
    id: "a", org_id: "org", nome: "Ana", funcao: "vendas", saudacao: "", tom: null, objetivo: "vender",
    instrucoes: "Ofereça o plano anual.", transferir_quando: "", ativo: true, padrao: true,
  };
  it("sobrepõe nome/objetivo e soma as regras da empresa", () => {
    const p = perfilComAtendente(base, ana, [{ id: "b", nome: "Leo", funcao: "suporte" }]);
    expect(p.nome_assistente).toBe("Ana");
    expect(p.objetivo).toBe("vender");
    expect(p.tom).toBe(base.tom);
    expect(p.regras).toContain("Nunca dar desconto.");
    expect(p.regras).toContain("Ofereça o plano anual.");
    expect(p.regras).toContain("Leo: suporte");
  });
  it("sem atendente, o perfil fica igual", () => {
    expect(perfilComAtendente(base, null, [])).toBe(base);
  });
});
