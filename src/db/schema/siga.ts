import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { QUALITATIVE_LEVELS } from "@/modules/siga/siee-grades/calculator";
import { PERFORMANCE_LEVELS } from "@/modules/siga/siee-grades/scale";
import { academicPeriods, academicYears, courseAssignments, groups, levels, grades as schoolGrades, users } from "./core";
import { createdAt, id, isoDate, timestamptz } from "./_helpers";
import { enrollmentStatus, enrollmentType } from "./enums";

/**
 * Módulo SIGA (docs/secciones/06_MODULO_SIGA.md). Incluye las tablas que la
 * auditoría de secciones encontró faltantes: `period_unlock_windows`,
 * `certificates` e índices únicos parciales de asistencia.
 */

/* ---------------------------------------------------------------------------
   Enums del SIGA
   --------------------------------------------------------------------------- */
export const SIEE_DIMENSIONS = ["SABER", "HACER", "SER", "QUALITATIVE"] as const;
export const OBSERVER_CATEGORIES = ["PRAISE", "ACADEMIC", "TYPE_I", "TYPE_II", "TYPE_III"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export const EXCUSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const CIRCULAR_SCOPES = ["ALL", "LEVEL", "GRADE", "GROUP"] as const;
export const CERTIFICATE_TYPES = ["CONSTANCIA_ESTUDIO", "CERTIFICADO_NOTAS", "PAZ_Y_SALVO"] as const;

export const sieeDimension = pgEnum("siee_dimension", SIEE_DIMENSIONS);
export const performanceLevel = pgEnum("performance_level", PERFORMANCE_LEVELS);
export const qualitativeLevel = pgEnum("qualitative_level", QUALITATIVE_LEVELS);
export const observerCategory = pgEnum("observer_category", OBSERVER_CATEGORIES);
export const attendanceStatus = pgEnum("attendance_status", ATTENDANCE_STATUSES);
export const excuseStatus = pgEnum("excuse_status", EXCUSE_STATUSES);
export const circularScope = pgEnum("circular_scope", CIRCULAR_SCOPES);
export const certificateType = pgEnum("certificate_type", CERTIFICATE_TYPES);

/* ---------------------------------------------------------------------------
   Matrícula
   --------------------------------------------------------------------------- */
export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    status: enrollmentStatus("status").notNull().default("ACTIVE"),
    enrollmentType: enrollmentType("enrollment_type").notNull(),
    enrolledAt: timestamptz("enrolled_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_student_year_uq").on(t.studentId, t.academicYearId),
    index("enrollments_group_idx").on(t.groupId, t.status),
  ],
);

/* ---------------------------------------------------------------------------
   Motor SIEE: dimensiones (logros), columnas de la planilla y notas
   --------------------------------------------------------------------------- */
export const sieeCompetencies = pgTable(
  "siee_competencies",
  {
    id: id(),
    courseAssignmentId: uuid("course_assignment_id")
      .notNull()
      .references(() => courseAssignments.id, { onDelete: "cascade" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    dimension: sieeDimension("dimension").notNull(),
    /** Logro / indicador / DBA que aparece en el boletín. */
    description: text("description").notNull().default(""),
    weightPercent: numeric("weight_percent", { precision: 5, scale: 2, mode: "number" }).notNull(),
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("siee_competencies_course_period_dimension_uq").on(
      t.courseAssignmentId,
      t.periodId,
      t.dimension,
    ),
  ],
);

export const sieeGradeColumns = pgTable(
  "siee_grade_columns",
  {
    id: id(),
    courseAssignmentId: uuid("course_assignment_id")
      .notNull()
      .references(() => courseAssignments.id, { onDelete: "cascade" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    competencyId: uuid("competency_id")
      .notNull()
      .references(() => sieeCompetencies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Peso de la columna dentro de su dimensión (las de una dimensión suman ≤ 100). */
    weightPercent: numeric("weight_percent", { precision: 5, scale: 2, mode: "number" }).notNull(),
    /** Tarea o cuestionario del Aula Virtual vinculado (FK se agrega en la Fase 3). */
    linkedActivityId: uuid("linked_activity_id").unique(),
    isPublished: boolean("is_published").notNull().default(true),
    displayOrder: smallint("display_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("siee_grade_columns_course_period_idx").on(t.courseAssignmentId, t.periodId)],
);

export const studentGrades = pgTable(
  "student_grades",
  {
    id: id(),
    columnId: uuid("column_id")
      .notNull()
      .references(() => sieeGradeColumns.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    numericScore: numeric("numeric_score", { precision: 2, scale: 1, mode: "number" }),
    qualitativeLevel: qualitativeLevel("qualitative_level"),
    performanceLevel: performanceLevel("performance_level"),
    feedback: text("feedback"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("student_grades_column_enrollment_uq").on(t.columnId, t.enrollmentId),
    index("student_grades_enrollment_idx").on(t.enrollmentId),
  ],
);

/**
 * Ventana temporal de edición sobre un periodo cerrado (docs/secciones/05 §3).
 * `courseAssignmentId` nulo = aplica a todas las cargas del periodo.
 */
export const periodUnlockWindows = pgTable(
  "period_unlock_windows",
  {
    id: id(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    courseAssignmentId: uuid("course_assignment_id").references(() => courseAssignments.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull(),
    openedBy: uuid("opened_by").references(() => users.id, { onDelete: "set null" }),
    opensAt: timestamptz("opens_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
    closedAt: timestamptz("closed_at"),
  },
  (t) => [index("period_unlock_windows_period_idx").on(t.periodId, t.expiresAt)],
);

/* ---------------------------------------------------------------------------
   Observador del estudiante (debido proceso)
   --------------------------------------------------------------------------- */
export const observerRecords = pgTable(
  "observer_records",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").references(() => academicPeriods.id, { onDelete: "set null" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    category: observerCategory("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    studentStatement: text("student_statement"),
    studentStatementAt: timestamptz("student_statement_at"),
    commitment: text("commitment"),
    guardianAcknowledgedAt: timestamptz("guardian_acknowledged_at"),
    guardianAcknowledgedBy: uuid("guardian_acknowledged_by").references(() => users.id, {
      onDelete: "set null",
    }),
    guardianComment: text("guardian_comment"),
    createdAt: createdAt(),
  },
  (t) => [
    index("observer_records_enrollment_idx").on(t.enrollmentId, t.createdAt),
    index("observer_records_category_idx").on(t.category, t.createdAt),
  ],
);

/* ---------------------------------------------------------------------------
   Asistencia y excusas
   --------------------------------------------------------------------------- */
export const attendanceLogs = pgTable(
  "attendance_logs",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    /** Nulo = asistencia por jornada; con valor = asistencia por clase. */
    courseAssignmentId: uuid("course_assignment_id").references(() => courseAssignments.id, {
      onDelete: "cascade",
    }),
    date: isoDate("date").notNull(),
    status: attendanceStatus("status").notNull(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Índices únicos parciales: los NULL no colisionan en un índice único normal.
    uniqueIndex("attendance_logs_class_uq")
      .on(t.enrollmentId, t.courseAssignmentId, t.date)
      .where(sql`${t.courseAssignmentId} is not null`),
    uniqueIndex("attendance_logs_day_uq")
      .on(t.enrollmentId, t.date)
      .where(sql`${t.courseAssignmentId} is null`),
    index("attendance_logs_date_status_idx").on(t.date, t.status),
  ],
);

export const attendanceExcuses = pgTable(
  "attendance_excuses",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id").references(() => users.id, { onDelete: "set null" }),
    fromDate: isoDate("from_date").notNull(),
    toDate: isoDate("to_date").notNull(),
    reasonType: text("reason_type").notNull(),
    description: text("description"),
    /** Llave en el almacenamiento privado (nunca una ruta de `public/`). */
    attachmentKey: text("attachment_key"),
    status: excuseStatus("status").notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamptz("reviewed_at"),
    reviewNotes: text("review_notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("attendance_excuses_enrollment_idx").on(t.enrollmentId, t.status),
    index("attendance_excuses_status_idx").on(t.status, t.fromDate),
  ],
);

/* ---------------------------------------------------------------------------
   Boletines y certificados verificables por QR
   --------------------------------------------------------------------------- */
export const reportCards = pgTable(
  "report_cards",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    verificationCode: text("verification_code").notNull().unique(),
    averageScore: numeric("average_score", { precision: 2, scale: 1, mode: "number" }),
    performanceLevel: performanceLevel("performance_level"),
    directorObservations: text("director_observations"),
    storageKey: text("storage_key"),
    /** Se marca al cambiar una nota del periodo: el PDF cacheado debe regenerarse. */
    isStale: boolean("is_stale").notNull().default(false),
    issuedAt: timestamptz("issued_at"),
  },
  (t) => [uniqueIndex("report_cards_enrollment_period_uq").on(t.enrollmentId, t.periodId)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    type: certificateType("type").notNull(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    verificationCode: text("verification_code").notNull().unique(),
    storageKey: text("storage_key"),
    issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamptz("issued_at").notNull().defaultNow(),
    revokedAt: timestamptz("revoked_at"),
  },
  (t) => [index("certificates_enrollment_idx").on(t.enrollmentId)],
);

/* ---------------------------------------------------------------------------
   Agenda y circulares
   --------------------------------------------------------------------------- */
export const circulars = pgTable(
  "circulars",
  {
    id: id(),
    title: text("title").notNull(),
    bodySanitized: text("body_sanitized").notNull(),
    targetScope: circularScope("target_scope").notNull().default("ALL"),
    /** Nivel, grado o grupo según `targetScope`. */
    targetLevelId: uuid("target_level_id").references(() => levels.id),
    targetGradeId: uuid("target_grade_id").references(() => schoolGrades.id),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamptz("published_at"),
    createdAt: createdAt(),
  },
  (t) => [index("circulars_published_idx").on(t.publishedAt)],
);

export const circularReads = pgTable(
  "circular_reads",
  {
    id: id(),
    circularId: uuid("circular_id")
      .notNull()
      .references(() => circulars.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamptz("read_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("circular_reads_uq").on(t.circularId, t.userId)],
);
