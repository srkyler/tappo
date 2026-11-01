import { expect, test, type Page } from "@playwright/test";

/*
 * Roteiro logado (docs/ROTEIRO-TESTE.md, partes 2, 4 e 6 sem celular).
 * Precisa de uma conta de TESTE: E2E_EMAIL e E2E_SENHA. Sem elas, pula.
 */
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;
test.skip(!EMAIL || !SENHA, "defina E2E_EMAIL e E2E_SENHA (conta de teste) para rodar a parte logada");

const marca = `E2E ${Date.now().toString(36)}`;

async function entrar(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(EMAIL!);
  await page.locator('input[name="senha"]').fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app(\/|$|\?)/);
}

test.describe.configure({ mode: "serial" });

test("entra e abre o início sem erro", async ({ page }) => {
  await entrar(page);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/Application error|Erro inesperado/i)).toHaveCount(0);
});

test("importa CSV com acento e vírgula no nome (3 linhas)", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/leads");
  await page.getByRole("button", { name: /Importar CSV/ }).click();
  const csv = [
    "Nome;Empresa;E-mail;Telefone",
    `João Ação ${marca};Padaria São José;joao.${Date.now()}@teste.dev;11 91111-0001`,
    `"Silva, Maria ${marca}";Ótica Visão;maria.${Date.now()}@teste.dev;11 91111-0002`,
    `Zé ${marca};Mercadinho;ze.${Date.now()}@teste.dev;11 91111-0003`,
  ].join("\n");
  await page.locator('input[type="file"]').setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await expect(page.getByText("leads.csv")).toBeVisible();
  await page.getByRole("button", { name: /Importar 3 leads/ }).click();
  await expect(page.getByText("Criados")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.reload();
  await page.getByLabel("Buscar leads").fill(marca);
  await expect(page.getByText(`Silva, Maria ${marca}`).first()).toBeVisible();
  await expect(page.getByText(`João Ação ${marca}`).first()).toBeVisible();
});

test("pipeline e tarefas abrem", async ({ page }) => {
  await entrar(page);
  for (const tela of ["/app/pipeline", "/app/tarefas", "/app/calendario", "/app/propostas", "/app/automacoes"]) {
    const r = await page.goto(tela);
    expect(r?.status(), tela).toBeLessThan(400);
    await expect(page.getByText(/Application error/i), tela).toHaveCount(0);
  }
});

test("assistente abre sem aviso de tabela faltando e sem mostrar o modelo de IA", async ({ page }) => {
  await entrar(page);
  await page.goto("/app/assistente");
  await expect(page.getByText(/tabela .* não existe|migration pendente/i)).toHaveCount(0);
  // O modelo/provedor é do admin da plataforma: nunca aparece para a empresa
  await expect(page.getByText(/claude-|gpt-4|gpt-5|anthropic|openai/i)).toHaveCount(0);
});

test("usuário comum não entra no /admin", async ({ page }) => {
  test.skip(process.env.E2E_ADMIN === "true", "a conta de teste é admin");
  await entrar(page);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin$/);
});
