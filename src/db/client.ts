import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** Base local de desarrollo (PostgreSQL de Homebrew; ver README). */
export const DEFAULT_DATABASE_URL = "postgresql://campus:campus_dev@localhost:5432/campus_lunita";

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL es obligatoria en producción.");
  }
  return DEFAULT_DATABASE_URL;
}

/** Hosts locales: los únicos sobre los que se permite borrar la base (db:reset). */
export function isLocalDatabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Crea una conexión Drizzle sobre un pool de `pg` dimensionado para flujos de
 * 1.000+ usuarios (picos en boletines, asistencia y evaluaciones). En producción,
 * apuntar DATABASE_URL a un pooler (PgBouncer, Neon o Supabase en modo transacción).
 */
export function createDatabase(url: string = resolveDatabaseUrl()) {
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: "campus-lunita",
  });
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
