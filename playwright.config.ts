import { defineConfig, devices } from "@playwright/test";

/*
 * Testes de navegador (plano 1.3) — o roteiro de docs/ROTEIRO-TESTE.md no que dá
 * para automatizar sem celular. Rodam contra um app já no ar:
 *   E2E_URL=http://localhost:3000 npm run e2e
 * Sem E2E_URL, sobe `npm run dev` sozinho. A parte logada só roda com
 * E2E_EMAIL/E2E_SENHA de uma conta de TESTE (nunca de produção com dados reais).
 */
const url = process.env.E2E_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // a suíte logada cria dados em sequência
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: url, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /publico\.spec\.ts|celular\.spec\.ts/ },
  ],
  webServer: process.env.E2E_URL ? undefined : { command: "npm run dev", url, reuseExistingServer: true, timeout: 180_000 },
});
