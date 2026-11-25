import { execSync } from "node:child_process";

/**
 * Script de compilación inteligente para despliegues en la nube (Vercel + Neon):
 * 1. Si hay base de datos configurada (`DATABASE_URL` o `POSTGRES_URL`), aplica
 *    automáticamente las migraciones Drizzle pendientes.
 * 2. Si `ALLOW_DEMO_SEED=true` (solo entornos demo), siembra los datos iniciales
 *    de forma 100% idempotente (no duplica si ya hay usuarios).
 * 3. Ejecuta `npm run build`.
 */
function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const hasDb = Boolean(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim());

if (hasDb) {
  run("npm run db:migrate");
  if (process.env.ALLOW_DEMO_SEED === "true") {
    run("npm run db:seed");
  }
} else {
  console.log("ℹ Sin DATABASE_URL/POSTGRES_URL en tiempo de build; omitiendo migraciones.");
}

run("npm run build");
