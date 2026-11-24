import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/db/client";
import { loadScriptEnv } from "./src/db/scripts/env";

loadScriptEnv();

/** PostgreSQL en desarrollo y producción: un solo esquema (`src/db/schema`, pg-core). */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
