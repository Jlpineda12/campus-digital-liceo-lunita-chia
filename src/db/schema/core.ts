import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, isoDate, timestamptz } from "./_helpers";
import {
  assessmentMode,
  documentType,
  guardianRelationship,
  levelCode,
  stheamiPillar,
  userRole,
} from "./enums";

/* ---------------------------------------------------------------------------
   Identidad y acceso
   --------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: id(),
    documentType: documentType("document_type").notNull(),
    /** Llave de unificación de identidad entre SIGA y Moodle (PLAN_MIGRACION §2.1). */
    documentNumber: text("document_number").notNull().unique(),
    /** Siempre en minúsculas. */
    email: text("email").unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: userRole("role").notNull(),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("users_role_idx").on(t.role)],
);

/** Sesiones HTTP-only. El token en claro solo vive en la cookie; aquí se guarda su SHA-256. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: createdAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

/**
 * Tokens de recuperación de contraseña: 32 bytes aleatorios, se guarda solo su
 * SHA-256 (columna `id`), vencen a los 15 minutos y son de un solo uso.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
    ipAddress: text("ip_address"),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
);

export const guardianLinks = pgTable(
  "guardian_links",
  {
    id: id(),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    relationship: guardianRelationship("relationship").notNull(),
    isFinancialResponsible: boolean("is_financial_responsible").notNull().default(false),
    canPickUp: boolean("can_pick_up").notNull().default(true),
  },
  (t) => [
    uniqueIndex("guardian_links_pair_uq").on(t.guardianId, t.studentId),
    index("guardian_links_student_idx").on(t.studentId),
  ],
);

/* ---------------------------------------------------------------------------
   Estructura académica
   --------------------------------------------------------------------------- */

export const academicYears = pgTable("academic_years", {
  id: id(),
  year: smallint("year").notNull().unique(),
  name: text("name").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  enrollmentOpen: boolean("enrollment_open").notNull().default(false),
  /** Nota mínima aprobatoria configurable por año lectivo (REGLAS.md §2.1). */
  minPassingScore: numeric("min_passing_score", { precision: 2, scale: 1, mode: "number" })
    .notNull()
    .default(3.5),
  startDate: isoDate("start_date").notNull(),
  endDate: isoDate("end_date").notNull(),
});

export const academicPeriods = pgTable(
  "academic_periods",
  {
    id: id(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
    name: text("name").notNull(),
    weightPercent: numeric("weight_percent", { precision: 5, scale: 2, mode: "number" }).notNull(),
    /** Periodo cerrado: ningún docente puede modificar notas (REGLAS.md §2.3). */
    gradesLocked: boolean("grades_locked").notNull().default(false),
    startDate: isoDate("start_date").notNull(),
    endDate: isoDate("end_date").notNull(),
  },
  (t) => [uniqueIndex("academic_periods_year_number_uq").on(t.academicYearId, t.number)],
);

export const levels = pgTable("levels", {
  id: id(),
  code: levelCode("code").notNull().unique(),
  name: text("name").notNull(),
});

/** Grados escolares (Prejardín … Undécimo). No confundir con calificaciones. */
export const grades = pgTable(
  "grades",
  {
    id: id(),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id),
    name: text("name").notNull(),
    displayOrder: smallint("display_order").notNull(),
    /** Código SIMAT: -2 Prejardín, -1 Jardín, 0 Transición, 1…11. */
    simatCode: text("simat_code").notNull().unique(),
    assessmentMode: assessmentMode("assessment_mode").notNull().default("NUMERIC"),
  },
  (t) => [index("grades_level_idx").on(t.levelId)],
);

export const groups = pgTable(
  "groups",
  {
    id: id(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    gradeId: uuid("grade_id")
      .notNull()
      .references(() => grades.id),
    name: text("name").notNull(),
    directorTeacherId: uuid("director_teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    capacity: smallint("capacity").notNull().default(25),
  },
  (t) => [
    uniqueIndex("groups_year_name_uq").on(t.academicYearId, t.name),
    index("groups_grade_idx").on(t.gradeId),
    index("groups_director_idx").on(t.directorTeacherId),
  ],
);

export const subjects = pgTable("subjects", {
  id: id(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  stheamiPillar: stheamiPillar("stheami_pillar").notNull(),
  weeklyHours: integer("weekly_hours").notNull(),
});

/** Una asignatura dictada a un grupo por un docente (misma entidad en SIGA y Aula Virtual). */
export const courseAssignments = pgTable(
  "course_assignments",
  {
    id: id(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("course_assignments_group_subject_uq").on(t.groupId, t.subjectId),
    index("course_assignments_teacher_idx").on(t.teacherId, t.academicYearId),
  ],
);
