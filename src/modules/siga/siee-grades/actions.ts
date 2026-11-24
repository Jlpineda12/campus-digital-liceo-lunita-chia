"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  academicPeriods,
  auditLogs,
  enrollments,
  reportCards,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
} from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { canEditGradebook, getCourseContext } from "./access";
import { QUALITATIVE_LEVELS, remainingWeight } from "./calculator";
import { MAX_LOGRO_LENGTH } from "./logros";
import { getEditState, getScaleForYear } from "./queries";
import { getPerformanceLevel, MAX_SCORE, MIN_SCORE } from "./scale";

const LOCKED_MESSAGE =
  "El periodo está cerrado. Solicita una ventana temporal a Coordinación si requieres una corrección.";

/** Carga editable por el actor en el periodo indicado (o el motivo por el que no). */
async function loadEditableContext(courseAssignmentId: string, periodId: string) {
  const actor = await requireSession();
  const course = await getCourseContext(courseAssignmentId);
  if (!course || !canEditGradebook(actor, course)) {
    return { ok: false as const, message: "No tienes permiso para editar esta planilla." };
  }
  const [period] = await db
    .select({
      id: academicPeriods.id,
      gradesLocked: academicPeriods.gradesLocked,
      academicYearId: academicPeriods.academicYearId,
    })
    .from(academicPeriods)
    .where(eq(academicPeriods.id, periodId))
    .limit(1);
  if (!period || period.academicYearId !== course.academicYearId) {
    return { ok: false as const, message: "El periodo no corresponde al año de esta carga." };
  }
  const state = await getEditState(period, courseAssignmentId);
  if (!state.editable) return { ok: false as const, message: LOCKED_MESSAGE };
  return { ok: true as const, actor, course, period };
}

/* ---------------------------------------------------------------------------
   Nueva columna de la planilla
   --------------------------------------------------------------------------- */

export interface ColumnFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const columnSchema = z.object({
  courseAssignmentId: z.uuid(),
  periodId: z.uuid(),
  competencyId: z.uuid({ error: "Elige la dimensión." }),
  title: z
    .string({ error: "Escribe un nombre para la columna." })
    .trim()
    .min(2, "Escribe un nombre para la columna.")
    .max(60, "Usa máximo 60 caracteres."),
  weightPercent: z.coerce
    .number({ error: "Escribe el peso en porcentaje." })
    .min(1, "El peso mínimo es 1 %.")
    .max(100, "El peso máximo es 100 %."),
});

export async function createGradeColumnAction(
  _prev: ColumnFormState,
  formData: FormData,
): Promise<ColumnFormState> {
  const parsed = columnSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    periodId: formText(formData, "periodId"),
    competencyId: formText(formData, "competencyId"),
    title: formText(formData, "title"),
    weightPercent: formText(formData, "weightPercent")?.replace(",", "."),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const context = await loadEditableContext(input.courseAssignmentId, input.periodId);
  if (!context.ok) return { status: "error", message: context.message };

  const [competency] = await db
    .select({ id: sieeCompetencies.id, dimension: sieeCompetencies.dimension })
    .from(sieeCompetencies)
    .where(
      and(
        eq(sieeCompetencies.id, input.competencyId),
        eq(sieeCompetencies.courseAssignmentId, input.courseAssignmentId),
        eq(sieeCompetencies.periodId, input.periodId),
      ),
    )
    .limit(1);
  if (!competency) return { status: "error", message: "La dimensión no pertenece a esta planilla." };

  const { ip } = await getRequestMeta();
  const txResult = await db.transaction(async (tx) => {
    const siblings = await tx
      .select({ weightPercent: sieeGradeColumns.weightPercent })
      .from(sieeGradeColumns)
      .where(eq(sieeGradeColumns.competencyId, competency.id));
    const available = remainingWeight(siblings);
    if (input.weightPercent > available) {
      return {
        status: "error" as const,
        message: `Las columnas de esta dimensión no pueden superar el 100 %. Queda ${available} % disponible.`,
      };
    }

    const [column] = await tx
      .insert(sieeGradeColumns)
      .values({
        courseAssignmentId: input.courseAssignmentId,
        periodId: input.periodId,
        competencyId: competency.id,
        title: input.title,
        weightPercent: input.weightPercent,
        displayOrder: siblings.length,
        createdBy: context.actor.id,
      })
      .returning({ id: sieeGradeColumns.id });
    await recordAudit(
      {
        actorUserId: context.actor.id,
        action: "GRADE_COLUMN_CREATED",
        entityType: "siee_grade_column",
        entityId: column!.id,
        after: { title: input.title, weightPercent: input.weightPercent, dimension: competency.dimension },
        ipAddress: ip,
      },
      tx,
    );
    return { status: "success" as const, message: `Columna “${input.title}” creada.` };
  });

  if (txResult.status === "success") refresh();
  return txResult;
}

/* ---------------------------------------------------------------------------
   Guardado por lotes (autoguardado de la planilla)
   --------------------------------------------------------------------------- */

const saveSchema = z.object({
  courseAssignmentId: z.uuid(),
  periodId: z.uuid(),
  changes: z
    .array(
      z.object({
        columnId: z.uuid(),
        enrollmentId: z.uuid(),
        /** Nota numérica (1.0–5.0, un decimal), nivel cualitativo (Preescolar) o null para borrar. */
        value: z.union([
          z
            .number()
            .min(MIN_SCORE)
            .max(MAX_SCORE)
            .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, { message: "Máximo un decimal." }),
          z.enum(QUALITATIVE_LEVELS),
          z.null(),
        ]),
      }),
    )
    .min(1)
    .max(500),
});

export type SaveGradesInput = z.input<typeof saveSchema>;
export type SaveGradesResult =
  | { ok: true; saved: number; savedAt: string }
  | { ok: false; message: string };

/**
 * Guarda un lote de celdas. En UNA transacción: inserta/actualiza/borra notas,
 * registra cada cambio en `audit_logs` (antes y después) y marca como
 * desactualizados los boletines ya emitidos del periodo (REGLAS.md §2.3).
 */
export async function saveGradesAction(input: SaveGradesInput): Promise<SaveGradesResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Hay notas con formato inválido." };
  const { courseAssignmentId, periodId, changes } = parsed.data;

  const context = await loadEditableContext(courseAssignmentId, periodId);
  if (!context.ok) return { ok: false, message: context.message };

  const columnIds = [...new Set(changes.map((c) => c.columnId))];
  const enrollmentIds = [...new Set(changes.map((c) => c.enrollmentId))];

  const [validColumns, validEnrollments, scale] = await Promise.all([
    db
      .select({ id: sieeGradeColumns.id, dimension: sieeCompetencies.dimension })
      .from(sieeGradeColumns)
      .innerJoin(sieeCompetencies, eq(sieeCompetencies.id, sieeGradeColumns.competencyId))
      .where(
        and(
          inArray(sieeGradeColumns.id, columnIds),
          eq(sieeGradeColumns.courseAssignmentId, courseAssignmentId),
          eq(sieeGradeColumns.periodId, periodId),
        ),
      ),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.id, enrollmentIds),
          eq(enrollments.groupId, context.course.groupId),
          eq(enrollments.status, "ACTIVE"),
        ),
      ),
    getScaleForYear(context.course.academicYearId),
  ]);
  if (validColumns.length !== columnIds.length || validEnrollments.length !== enrollmentIds.length) {
    return { ok: false, message: "Algunas celdas no pertenecen a esta planilla." };
  }
  // Cada columna acepta solo su tipo de valoración.
  const qualitativeColumns = new Set(validColumns.filter((c) => c.dimension === "QUALITATIVE").map((c) => c.id));
  const typeMismatch = changes.some(
    (c) =>
      c.value !== null &&
      (qualitativeColumns.has(c.columnId) ? typeof c.value !== "string" : typeof c.value !== "number"),
  );
  if (typeMismatch) return { ok: false, message: "El tipo de valoración no corresponde a la columna." };

  const { ip } = await getRequestMeta();
  const now = new Date();

  const saved = await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        columnId: studentGrades.columnId,
        enrollmentId: studentGrades.enrollmentId,
        numericScore: studentGrades.numericScore,
        qualitativeLevel: studentGrades.qualitativeLevel,
      })
      .from(studentGrades)
      .where(and(inArray(studentGrades.columnId, columnIds), inArray(studentGrades.enrollmentId, enrollmentIds)));
    const before = new Map(
      existing.map((g) => [`${g.columnId}:${g.enrollmentId}`, g.numericScore ?? g.qualitativeLevel]),
    );

    const effective = changes.filter((c) => (before.get(`${c.columnId}:${c.enrollmentId}`) ?? null) !== c.value);
    if (effective.length === 0) return 0;

    const upserts = effective.filter((c) => c.value !== null);
    if (upserts.length > 0) {
      await tx
        .insert(studentGrades)
        .values(
          upserts.map((c) => ({
            columnId: c.columnId,
            enrollmentId: c.enrollmentId,
            numericScore: typeof c.value === "number" ? c.value : null,
            qualitativeLevel: typeof c.value === "string" ? c.value : null,
            performanceLevel: typeof c.value === "number" ? getPerformanceLevel(c.value, scale) : null,
            updatedBy: context.actor.id,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [studentGrades.columnId, studentGrades.enrollmentId],
          set: {
            numericScore: sql`excluded.numeric_score`,
            qualitativeLevel: sql`excluded.qualitative_level`,
            performanceLevel: sql`excluded.performance_level`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    for (const c of effective.filter((x) => x.value === null)) {
      await tx
        .delete(studentGrades)
        .where(and(eq(studentGrades.columnId, c.columnId), eq(studentGrades.enrollmentId, c.enrollmentId)));
    }

    await tx.insert(auditLogs).values(
      effective.map((c) => ({
        actorUserId: context.actor.id,
        action: "GRADE_UPDATED" as const,
        entityType: "student_grade",
        entityId: `${c.columnId}:${c.enrollmentId}`,
        beforeJson: { score: before.get(`${c.columnId}:${c.enrollmentId}`) ?? null },
        afterJson: { score: c.value, courseAssignmentId, periodId },
        ipAddress: ip,
      })),
    );

    await tx
      .update(reportCards)
      .set({ isStale: true })
      .where(
        and(
          eq(reportCards.periodId, periodId),
          inArray(reportCards.enrollmentId, [...new Set(effective.map((c) => c.enrollmentId))]),
        ),
      );
    return effective.length;
  });

  return { ok: true, saved, savedAt: now.toISOString() };
}

/* ---------------------------------------------------------------------------
   Logros del boletín por asignatura y periodo (Saber / Hacer / Ser / Cualitativa)
   --------------------------------------------------------------------------- */

const saveLogrosSchema = z.object({
  courseAssignmentId: z.uuid(),
  periodId: z.uuid(),
  entries: z
    .array(
      z.object({
        competencyId: z.uuid(),
        description: z.string().trim().max(MAX_LOGRO_LENGTH, `Máximo ${MAX_LOGRO_LENGTH} caracteres por dimensión.`),
      }),
    )
    .min(1)
    .max(6),
});

export type SaveLogrosInput = z.input<typeof saveLogrosSchema>;
export type SaveLogrosResult =
  | { ok: true; updated: number; savedAt: string }
  | { ok: false; message: string };

/**
 * Guarda los logros/indicadores de todas las dimensiones de una asignatura en un
 * periodo en una sola transacción, con auditoría y marca de actualización de boletines.
 */
export async function saveCourseLogrosAction(input: SaveLogrosInput): Promise<SaveLogrosResult> {
  const parsed = saveLogrosSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el texto de los logros." };
  }
  const { courseAssignmentId, periodId, entries } = parsed.data;

  const context = await loadEditableContext(courseAssignmentId, periodId);
  if (!context.ok) return { ok: false, message: context.message };

  const competencyIds = [...new Set(entries.map((e) => e.competencyId))];
  const existing = await db
    .select({
      id: sieeCompetencies.id,
      dimension: sieeCompetencies.dimension,
      description: sieeCompetencies.description,
    })
    .from(sieeCompetencies)
    .where(
      and(
        inArray(sieeCompetencies.id, competencyIds),
        eq(sieeCompetencies.courseAssignmentId, courseAssignmentId),
        eq(sieeCompetencies.periodId, periodId),
      ),
    );

  if (existing.length !== competencyIds.length) {
    return { ok: false, message: "Alguna dimensión no corresponde a esta asignatura y periodo." };
  }

  const beforeMap = new Map(existing.map((c) => [c.id, c]));
  const changed = entries.filter((e) => (beforeMap.get(e.competencyId)?.description ?? "") !== e.description);

  const now = new Date();
  if (changed.length === 0) {
    return { ok: true, updated: 0, savedAt: now.toISOString() };
  }

  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    for (const item of changed) {
      await tx
        .update(sieeCompetencies)
        .set({ description: item.description })
        .where(eq(sieeCompetencies.id, item.competencyId));
    }

    await recordAudit(
      {
        actorUserId: context.actor.id,
        action: "LOGROS_UPDATED",
        entityType: "course_assignment",
        entityId: `${courseAssignmentId}:${periodId}`,
        before: Object.fromEntries(
          changed.map((c) => [beforeMap.get(c.competencyId)!.dimension, beforeMap.get(c.competencyId)!.description]),
        ),
        after: Object.fromEntries(
          changed.map((c) => [beforeMap.get(c.competencyId)!.dimension, c.description]),
        ),
        ipAddress: ip,
      },
      tx,
    );

    const groupEnrollments = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.groupId, context.course.groupId), eq(enrollments.status, "ACTIVE")));
    if (groupEnrollments.length > 0) {
      await tx
        .update(reportCards)
        .set({ isStale: true })
        .where(
          and(
            eq(reportCards.periodId, periodId),
            inArray(
              reportCards.enrollmentId,
              groupEnrollments.map((e) => e.id),
            ),
          ),
        );
    }
  });

  refresh();
  return { ok: true, updated: changed.length, savedAt: now.toISOString() };
}
