import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testes de lib/ (funções puras e regras). "server-only" vira módulo vazio: no
// Next ele barra import no cliente; aqui não há cliente.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/vazio.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
