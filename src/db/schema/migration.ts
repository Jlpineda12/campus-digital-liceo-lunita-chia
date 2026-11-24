import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { academicYears, users } from "./core";
import { createdAt, id } from "./_helpers";

export const MIGRATION_SOURCE_KINDS = [
  "STUDENTS_FAMILIES",
  "HISTORICAL_GRADES",
  "BILLING_BALANCES",
  "MOODLE_QUIZ_XML",
] as const;
export type MigrationSourceKind = (typeof MIGRATION_SOURCE_KINDS)[number];

/**
 * Bitácora auditable de lotes de migración ejecutados desde SIGA, planillas Excel
 * de cartera o bancos XML de Moodle (Fase 5).
 */
export const migrationBatches = pgTable(
  "migration_batches",
  {
    id: id(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").$type<MigrationSourceKind>().notNull(),
    fileName: text("file_name").notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    summaryJson: jsonb("summary_json"),
    executedBy: uuid("executed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("migration_batches_year_created_idx").on(t.academicYearId, t.createdAt)],
);
