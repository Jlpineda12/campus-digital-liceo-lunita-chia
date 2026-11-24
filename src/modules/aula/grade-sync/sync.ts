import "server-only";
import { and, eq } from "drizzle-orm";
import {
  academicPeriods,
  reportCards,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
} from "@/db/schema";
import { recordAudit, type DbExecutor } from "@/modules/core/audit/service";
import { remainingWeight, type SieeDimension } from "@/modules/siga/siee-grades/calculator";
import { getEditState, getScaleForYear } from "@/modules/siga/siee-grades/queries";
import { getPerformanceLevel } from "@/modules/siga/siee-grades/scale";
import { normalizeToSieeScore } from "../sanitize";

/**
 * Crea la columna vinculada en `siee_grade_columns` cuando una actividad del
 * Aula Virtual activa `syncToSiga = true`. Se ejecuta dentro de la transacción
 * de creación de la actividad.
 */
export async function createLinkedSieeColumn(
  tx: DbExecutor,
  options: {
    activityId: string;
    courseAssignmentId: string;
    periodId: string;
    dimension: SieeDimension;
    title: string;
    weightPercent: number;
    actorUserId: string;
    ipAddress: string | null;
  },
): Promise<{ ok: true; columnId: string } | { ok: false; message: string }> {
  const [competency] = await tx
    .select({ id: sieeCompetencies.id, dimension: sieeCompetencies.dimension })
    .from(sieeCompetencies)
    .where(
      and(
        eq(sieeCompetencies.courseAssignmentId, options.courseAssignmentId),
        eq(sieeCompetencies.periodId, options.periodId),
        eq(sieeCompetencies.dimension, options.dimension),
      ),
    )
    .limit(1);

  if (!competency) {
    return { ok: false, message: "No encontramos la dimensión SIEE en este periodo." };
  }

  const siblings = await tx
    .select({ weightPercent: sieeGradeColumns.weightPercent })
    .from(sieeGradeColumns)
    .where(eq(sieeGradeColumns.competencyId, competency.id));

  const available = remainingWeight(siblings);
  if (options.weightPercent > available) {
    return {
      ok: false,
      message: `En esa dimensión solo queda ${available}% disponible en la planilla SIGA.`,
    };
  }

  const [created] = await tx
    .insert(sieeGradeColumns)
    .values({
      courseAssignmentId: options.courseAssignmentId,
      periodId: options.periodId,
      competencyId: competency.id,
      title: options.title.slice(0, 60),
      weightPercent: options.weightPercent,
      linkedActivityId: options.activityId,
      displayOrder: siblings.length,
      createdBy: options.actorUserId,
    })
    .returning({ id: sieeGradeColumns.id });

  await recordAudit(
    {
      actorUserId: options.actorUserId,
      action: "GRADE_COLUMN_CREATED",
      entityType: "siee_grade_column",
      entityId: created!.id,
      after: {
        title: options.title.slice(0, 60),
        weightPercent: options.weightPercent,
        dimension: competency.dimension,
        linkedActivityId: options.activityId,
      },
      ipAddress: options.ipAddress,
    },
    tx,
  );

  return { ok: true, columnId: created!.id };
}

/**
 * Puente transaccional Aula Virtual → SIGA (docs/secciones/07 §3.3).
 * Al calificar una tarea sincronizada, actualiza `student_grades`, marca el
 * boletín como `isStale: true` y registra auditoría en la misma transacción.
 */
export async function syncSubmissionScoreToSiee(
  tx: DbExecutor,
  options: {
    activityId: string;
    enrollmentId: string;
    rawScore: number;
    maxScore: number;
    actorUserId: string;
    ipAddress: string | null;
    now: Date;
  },
): Promise<{ synced: boolean; warning?: string }> {
  const [column] = await tx
    .select({
      id: sieeGradeColumns.id,
      courseAssignmentId: sieeGradeColumns.courseAssignmentId,
      periodId: sieeGradeColumns.periodId,
      academicYearId: academicPeriods.academicYearId,
      gradesLocked: academicPeriods.gradesLocked,
    })
    .from(sieeGradeColumns)
    .innerJoin(academicPeriods, eq(academicPeriods.id, sieeGradeColumns.periodId))
    .where(eq(sieeGradeColumns.linkedActivityId, options.activityId))
    .limit(1);

  if (!column) return { synced: false };

  const editState = await getEditState(
    { id: column.periodId, gradesLocked: column.gradesLocked },
    column.courseAssignmentId,
  );
  if (!editState.editable) {
    return {
      synced: false,
      warning:
        "Nota guardada en Órbita Virtual, pero el periodo ya está cerrado en SIGA y no se modificó la planilla.",
    };
  }

  const scale = await getScaleForYear(column.academicYearId);
  const sieeScore = normalizeToSieeScore(options.rawScore, options.maxScore);
  const level = getPerformanceLevel(sieeScore, scale);

  const [previous] = await tx
    .select({ numericScore: studentGrades.numericScore })
    .from(studentGrades)
    .where(
      and(eq(studentGrades.columnId, column.id), eq(studentGrades.enrollmentId, options.enrollmentId)),
    )
    .limit(1);

  await tx
    .insert(studentGrades)
    .values({
      columnId: column.id,
      enrollmentId: options.enrollmentId,
      numericScore: sieeScore,
      qualitativeLevel: null,
      performanceLevel: level,
      updatedBy: options.actorUserId,
      updatedAt: options.now,
    })
    .onConflictDoUpdate({
      target: [studentGrades.columnId, studentGrades.enrollmentId],
      set: {
        numericScore: sieeScore,
        performanceLevel: level,
        updatedBy: options.actorUserId,
        updatedAt: options.now,
      },
    });

  await recordAudit(
    {
      actorUserId: options.actorUserId,
      action: "GRADE_UPDATED",
      entityType: "student_grade",
      entityId: `${column.id}:${options.enrollmentId}`,
      before: { score: previous?.numericScore ?? null },
      after: { score: sieeScore, source: "AULA_VIRTUAL", activityId: options.activityId },
      ipAddress: options.ipAddress,
    },
    tx,
  );

  await tx
    .update(reportCards)
    .set({ isStale: true })
    .where(and(eq(reportCards.enrollmentId, options.enrollmentId), eq(reportCards.periodId, column.periodId)));

  return { synced: true };
}
