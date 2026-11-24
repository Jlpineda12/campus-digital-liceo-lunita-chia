import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, resolveDatabaseUrl } from "../client";
import { loadScriptEnv } from "./env";

export async function runMigrations(): Promise<void> {
  const url = resolveDatabaseUrl();
  const db = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log(`✔ Migraciones aplicadas en ${new URL(url).host}${new URL(url).pathname}`);
  } finally {
    await db.$client.end();
  }
}

if (require.main === module) {
  loadScriptEnv();
  runMigrations().catch((error: unknown) => {
    console.error("✖ Error aplicando migraciones:", error);
    process.exit(1);
  });
}
