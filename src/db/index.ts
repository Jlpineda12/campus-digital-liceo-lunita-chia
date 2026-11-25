import "server-only";
import { createDatabase, type Database } from "./client";

/**
 * Conexión única de la aplicación. Solo importable desde código de servidor
 * (módulos en `src/modules/*`), nunca desde componentes de cliente.
 */
const globalForDb = globalThis as unknown as { __lunitaDb?: Database };

export const db: Database = globalForDb.__lunitaDb ?? createDatabase();
globalForDb.__lunitaDb = db;

export type { Database };
