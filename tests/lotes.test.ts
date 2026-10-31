import { describe, expect, it } from "vitest";
import { AcaoLote, desfazerAcoes, descreverAcao } from "@/lib/ai/lotes";

const ID = "11111111-1111-4111-8111-111111111111";

describe("lotes do agente", () => {
  it("valida as ações e recusa tipo desconhecido", () => {
    expect(AcaoLote.safeParse({ tipo: "criar_tarefa", titulo: "Ligar", lead_id: ID, quando: "2026-11-05" }).success).toBe(true);
    expect(AcaoLote.safeParse({ tipo: "apagar_tudo" }).success).toBe(false);
    expect(AcaoLote.safeParse({ tipo: "atualizar_lead", lead_id: "x" }).success).toBe(false);
  });
  it("descreve com o nome do registro", () => {
    expect(descreverAcao({ tipo: "mover_negocio", negocio_id: ID, etapa: "Proposta" }, { [ID]: "Site Acme" })).toBe('Mover Site Acme para "Proposta"');
  });
  it("desfaz na ordem inversa", async () => {
    const chamadas: string[] = [];
    const sb = {
      from: (t: string) => ({
        delete: () => ({ eq: (_k: string, id: string) => { chamadas.push(`del ${t} ${id}`); return Promise.resolve({}); } }),
        update: () => ({ eq: (_k: string, id: string) => { chamadas.push(`upd ${t} ${id}`); return Promise.resolve({}); } }),
      }),
    };
    await desfazerAcoes(sb as never, [{ t: "apagar_tarefa", id: "a" }, { t: "lead", id: "b", antes: { status: "Nova" } }]);
    expect(chamadas).toEqual(["upd leads b", "del tarefas a"]);
  });
});
