import { sql } from "drizzle-orm";
import { createDatabase, isLocalDatabase, resolveDatabaseUrl } from "../client";
import { runSeed } from "../seed";
import { loadScriptEnv } from "./env";
import { runMigrations } from "./migrate";

/**
 * Borra TODO el contenido de la base local (esquemas `public` y `drizzle`),
 * aplica migraciones y carga el seed. Solo desarrollo y solo en localhost.
 */
async function main(): Promise<void> {
  loadScriptEnv();
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset está deshabilitado en producción.");
  }
  const url = resolveDatabaseUrl();
  if (!isLocalDatabase(url)) {
    throw new Error(`db:reset solo opera sobre bases en localhost. Host actual: ${new URL(url).host}`);
  }

  const db = createDatabase(url);
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    console.log(`✔ Base local vaciada: ${new URL(url).pathname.slice(1)}`);
  } finally {
    await db.$client.end();
  }

  await runMigrations();

  const seedDb = createDatabase(url);
  try {
    await runSeed(seedDb);
  } finally {
    await seedDb.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error("✖ Error en db:reset:", error);
  process.exit(1);
});
