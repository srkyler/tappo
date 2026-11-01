import { describe, expect, it, vi, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));

beforeAll(() => { process.env.AI_KEYS_SECRET = process.env.AI_KEYS_SECRET ?? "x".repeat(48); });

describe("WhatsApp oficial (Cloud API)", () => {
  it("converte chat ↔ número da Meta", async () => {
    const { chatDoWaId, destinoDoChat } = await import("@/lib/whatsapp/cloud");
    expect(chatDoWaId("5511999998888")).toBe("5511999998888@c.us");
    expect(destinoDoChat("5511999998888@c.us")).toBe("5511999998888");
    expect(() => destinoDoChat("123@c.us")).toThrow();
  });

  it("confere a assinatura X-Hub-Signature-256 com o app secret", async () => {
    const { cifrar } = await import("@/lib/ai/cofre");
    const { assinaturaMetaValida } = await import("@/lib/whatsapp/cloud");
    const segredo = "segredo-do-app-123456";
    const c = { cloud_app_secret_cifrado: cifrar(segredo) };
    const corpo = JSON.stringify({ object: "whatsapp_business_account" });
    const sig = "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex");
    expect(assinaturaMetaValida(c, sig, corpo)).toBe(true);
    expect(assinaturaMetaValida(c, sig, corpo + " ")).toBe(false);
    expect(assinaturaMetaValida(c, null, corpo)).toBe(false);
    expect(assinaturaMetaValida({ cloud_app_secret_cifrado: null }, sig, corpo)).toBe(false);
  });
});
