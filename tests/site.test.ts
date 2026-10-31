import { describe, expect, it } from "vitest";
import { linksUteis, textoDoHtml } from "@/lib/web/pagina";

describe("leitura do site", () => {
  it("tira script/style e mantém o texto", () => {
    const t = textoDoHtml("<html><script>alert(1)</script><style>p{}</style><h1>Clínica &amp; Spa</h1><p>Atendemos de seg a sáb</p></html>");
    expect(t).toContain("Clínica & Spa");
    expect(t).toContain("Atendemos de seg a sáb");
    expect(t).not.toContain("alert");
  });
  it("só segue links internos úteis", () => {
    const html = '<a href="/sobre">Sobre</a><a href="https://outro.com/precos">x</a><a href="/blog/post">b</a><a href="/servicos#a">s</a>';
    expect(linksUteis(html, new URL("https://empresa.com.br/"))).toEqual(["https://empresa.com.br/sobre", "https://empresa.com.br/servicos"]);
  });
});
