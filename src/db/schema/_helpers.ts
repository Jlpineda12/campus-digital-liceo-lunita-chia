import { date, timestamp, uuid } from "drizzle-orm/pg-core";

/** Llave primaria UUID generada por PostgreSQL (`gen_random_uuid()`). */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** Marca de tiempo con zona horaria. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Fecha y hora de creación. */
export const createdAt = () => timestamptz("created_at").notNull().defaultNow();

/** Fecha de calendario `YYYY-MM-DD` (sin hora ni zona horaria). */
export const isoDate = (name: string) => date(name, { mode: "string" });
