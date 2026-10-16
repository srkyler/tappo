// Junta supabase/migrations/2026*.sql (em ordem) em supabase/setup_completo.sql
// Uso: npm run db:setup
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const arquivos = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
const cabecalho = [
  "-- =============================================================",
  "-- Tappo — SETUP COMPLETO",
  "-- Cole tudo no Supabase > SQL Editor > Run. Pode rodar mais de uma vez.",
  "-- Gerado a partir de supabase/migrations/*.sql (em ordem) — não edite à mão.",
  "-- =============================================================",
].join("\n");
const corpo = arquivos.map((f) => `\n\n-- >>>>> ${f}\n\n${readFileSync(join(dir, f), "utf8")}`).join("");
writeFileSync("supabase/setup_completo.sql", `${cabecalho}\n${corpo}`);
console.log(`setup_completo.sql gerado com ${arquivos.length} migrações: ${arquivos.join(", ")}`);
