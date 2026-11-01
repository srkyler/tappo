import { expect, test } from "@playwright/test";

/* Sem login: telas públicas, bloqueios e rotas de webhook. Não cria dado nenhum. */

test("login abre com e-mail e senha", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="senha"]')).toBeVisible();
});

test("área logada sem sessão volta para o login guardando o destino", async ({ page }) => {
  await page.goto("/app/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fleads/);
});

test("/admin sem sessão é barrado", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("link de proposta inválido dá 404 (sem vazar nada)", async ({ request }) => {
  const r = await request.get("/p/token-que-nao-existe-1234567890");
  expect(r.status()).toBe(404);
});

test("webhooks públicos recusam token/assinatura inválidos", async ({ request }) => {
  expect((await request.post("/api/v1/waha/nao-e-token", { data: {} })).status()).toBe(404);
  expect((await request.get("/api/v1/whatsapp-cloud/abc?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1")).status()).toBe(403);
  expect((await request.post("/api/v1/whatsapp-cloud/" + "a".repeat(64), { data: {} })).status()).toBe(404);
});

test("página de captação com token inválido dá 404", async ({ request }) => {
  expect((await request.get("/captar/" + "0".repeat(64))).status()).toBe(404);
});

test("health responde", async ({ request }) => {
  const r = await request.get("/api/health");
  expect([200, 503]).toContain(r.status());
});

test("telas fundidas redirecionam para o destino", async ({ request }) => {
  const r = await request.get("/app/permissoes", { maxRedirects: 0 });
  expect([307, 308]).toContain(r.status());
  expect(r.headers()["location"]).toContain("/app/empresa");
});
