import { afterEach, describe, expect, it, vi } from "vitest";
import { chatDoTelefone, idsEquivalentes, telefoneDoChat, urlDaMidia } from "@/lib/whatsapp/waha";

describe("ids do WAHA", () => {
  it("casa id completo com o cru", () => {
    expect(idsEquivalentes("true_5511999998888@c.us_3EB0ABC")).toEqual(["true_5511999998888@c.us_3EB0ABC", "3EB0ABC"]);
    expect(idsEquivalentes("3EB0ABC")).toEqual(["3EB0ABC"]);
  });
});

describe("telefones", () => {
  it("extrai telefone de c.us e s.whatsapp.net, não de @lid/@g.us", () => {
    expect(telefoneDoChat("5511999998888@c.us")).toBe("5511999998888");
    expect(telefoneDoChat("5511999998888@s.whatsapp.net")).toBe("5511999998888");
    expect(telefoneDoChat("100000000000001@lid")).toBeNull();
    expect(telefoneDoChat("120363@g.us")).toBeNull();
  });
  it("monta chatId assumindo Brasil", () => {
    expect(chatDoTelefone("(11) 99999-8888")).toBe("5511999998888@c.us");
    expect(chatDoTelefone("+55 11 99999-8888")).toBe("5511999998888@c.us");
    expect(chatDoTelefone("123")).toBeNull();
  });
});

describe("proxy de mídia", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reconstrói a URL na base do .env (host do payload é descartado)", () => {
    vi.stubEnv("WAHA_BASE_URL", "https://waha.exemplo.com");
    vi.stubEnv("WAHA_API_KEY", "k");
    const r = urlDaMidia({ base_url: "", api_key_cifrada: null }, "http://localhost:3000/api/files/sessao/abc.oga");
    expect(r).toEqual({ url: "https://waha.exemplo.com/api/files/sessao/abc.oga", chave: "k" });
  });
  it("recusa caminho fora de /api/files e travessia", () => {
    vi.stubEnv("WAHA_BASE_URL", "https://waha.exemplo.com");
    expect(urlDaMidia({ base_url: "", api_key_cifrada: null }, "http://evil.com/api/sessions")).toBeNull();
    expect(urlDaMidia({ base_url: "", api_key_cifrada: null }, "http://x/api/files/../sessions")).toBeNull();
    expect(urlDaMidia({ base_url: "", api_key_cifrada: null }, "não é url")).toBeNull();
  });
});
