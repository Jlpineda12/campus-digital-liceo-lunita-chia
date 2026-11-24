import { existsSync } from "node:fs";

/** Carga .env.local / .env para scripts de consola (Next.js lo hace solo en la app). */
export function loadScriptEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
