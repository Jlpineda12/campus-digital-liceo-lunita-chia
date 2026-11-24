import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { academicPeriods, courseAssignments, users } from "./core";
import { createdAt, id, timestamptz } from "./_helpers";
import { enrollments } from "./siga";

/**
 * Módulo Aula Virtual — Órbita Virtual (docs/secciones/07_MODULO_AULA_VIRTUAL.md).
 * Reemplazo moderno de Moodle integrado transaccionalmente a las columnas SIEE de SIGA.
 */

export const RESOURCE_TYPES = ["PDF", "VIDEO", "LINK", "RICH_TEXT"] as const;
export const ACTIVITY_TYPES = ["ASSIGNMENT", "QUIZ", "FORUM"] as const;
export const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE", "SHORT_TEXT"] as const;

export const resourceType = pgEnum("resource_type", RESOURCE_TYPES);
export const activityType = pgEnum("activity_type", ACTIVITY_TYPES);
export const questionType = pgEnum("question_type", QUESTION_TYPES);

export const courseUnits = pgTable(
  "course_units",
  {
    id: id(),
    courseAssignmentId: uuid("course_assignment_id")
      .notNull()
      .references(() => courseAssignments.id, { onDelete: "cascade" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => academicPeriods.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    displayOrder: smallint("display_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("course_units_course_period_idx").on(t.courseAssignmentId, t.periodId, t.displayOrder)],
);

export const learningResources = pgTable(
  "learning_resources",
  {
    id: id(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => courseUnits.id, { onDelete: "cascade" }),
    type: resourceType("type").notNull(),
    title: text("title").notNull(),
    /** Texto sanitizado (RICH_TEXT) o URL https segura (VIDEO / LINK). */
    contentTextOrUrl: text("content_text_or_url").notNull().default(""),
    /** Llave en almacenamiento privado (nunca `public/`). */
    storageKey: text("storage_key"),
    fileSizeBytes: integer("file_size_bytes"),
    displayOrder: smallint("display_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("learning_resources_unit_idx").on(t.unitId, t.displayOrder)],
);

export const resourceViews = pgTable(
  "resource_views",
  {
    id: id(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => learningResources.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    viewedAt: timestamptz("viewed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("resource_views_resource_enrollment_uq").on(t.resourceId, t.enrollmentId)],
);

export const activities = pgTable(
  "activities",
  {
    id: id(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => courseUnits.id, { onDelete: "cascade" }),
    type: activityType("type").notNull().default("ASSIGNMENT"),
    title: text("title").notNull(),
    instructionsSanitized: text("instructions_sanitized").notNull().default(""),
    dueDate: timestamptz("due_date"),
    maxScore: numeric("max_score", { precision: 2, scale: 1, mode: "number" }).notNull().default(5.0),
    allowLate: boolean("allow_late").notNull().default(true),
    timeLimitMinutes: smallint("time_limit_minutes"),
    maxAttempts: smallint("max_attempts").notNull().default(1),
    syncToSiga: boolean("sync_to_siga").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_unit_due_idx").on(t.unitId, t.dueDate),
    index("activities_published_due_idx").on(t.isPublished, t.dueDate),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    textResponse: text("text_response").notNull().default(""),
    /** Enlace externo seguro opcional (p. ej. repositorio, documento o evidencia). */
    referenceUrl: text("reference_url"),
    /** Llave en almacenamiento privado (nunca `public/`). */
    attachmentKey: text("attachment_key"),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
    isLate: boolean("is_late").notNull().default(false),
    score: numeric("score", { precision: 2, scale: 1, mode: "number" }),
    rubricJson: jsonb("rubric_json"),
    teacherFeedback: text("teacher_feedback"),
    gradedBy: uuid("graded_by").references(() => users.id, { onDelete: "set null" }),
    gradedAt: timestamptz("graded_at"),
  },
  (t) => [
    uniqueIndex("submissions_activity_enrollment_uq").on(t.activityId, t.enrollmentId),
    index("submissions_enrollment_submitted_idx").on(t.enrollmentId, t.submittedAt),
  ],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: id(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    questionType: questionType("question_type").notNull(),
    promptSanitized: text("prompt_sanitized").notNull(),
    /** Llave privada opcional de imagen de apoyo / ejercicio (nunca `public/`). */
    imageStorageKey: text("image_storage_key"),
    /** Descripción o pie de imagen accesible para la figura del ejercicio. */
    imageAlt: text("image_alt").notNull().default(""),
    optionsJson: jsonb("options_json").notNull(),
    correctAnswerJson: jsonb("correct_answer_json").notNull(),
    points: numeric("points", { precision: 4, scale: 1, mode: "number" }).notNull().default(1.0),
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [index("quiz_questions_activity_idx").on(t.activityId, t.displayOrder)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    attemptNumber: smallint("attempt_number").notNull().default(1),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    submittedAt: timestamptz("submitted_at"),
    answersJson: jsonb("answers_json"),
    autoScore: numeric("auto_score", { precision: 2, scale: 1, mode: "number" }),
    manualScore: numeric("manual_score", { precision: 2, scale: 1, mode: "number" }),
    finalScore: numeric("final_score", { precision: 2, scale: 1, mode: "number" }),
  },
  (t) => [
    uniqueIndex("quiz_attempts_activity_enrollment_num_uq").on(
      t.activityId,
      t.enrollmentId,
      t.attemptNumber,
    ),
  ],
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: id(),
    courseAssignmentId: uuid("course_assignment_id")
      .notNull()
      .references(() => courseAssignments.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").references(() => activities.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    bodySanitized: text("body_sanitized").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("forum_posts_course_created_idx").on(t.courseAssignmentId, t.createdAt)],
);

/** Personalización visual que cada docente configura para su curso en Órbita Virtual. */
export const courseThemes = pgTable("course_themes", {
  courseAssignmentId: uuid("course_assignment_id")
    .primaryKey()
    .references(() => courseAssignments.id, { onDelete: "cascade" }),
  bannerPreset: text("banner_preset").notNull().default("constellation"),
  accentTone: text("accent_tone").notNull().default("cobalt"),
  /** Color hexadecimal personalizado opcional (#RRGGBB) elegido por el docente. */
  customColorHex: text("custom_color_hex"),
  /** Imagen personalizada privada de portada (llave en `.storage/campus/aula/banners/...`). */
  bannerImageKey: text("banner_image_key"),
  iconKey: text("icon_key").notNull().default("book"),
  layoutStyle: text("layout_style").notNull().default("cards"),
  welcomeMessage: text("welcome_message").notNull().default(""),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
