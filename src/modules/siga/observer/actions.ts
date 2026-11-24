"use server";

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import {
  academicPeriods,
  academicYears,
  auditLogs,
  courseAssignments,
  enrollments,
  groups,
  observerRecords,
} from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { canAccessStudent } from "@/modules/core/auth/policies";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { canGuardianAcknowledge, canStudentAddStatement } from "./meta";
import { createObserverSchema, guardianAcknowledgeSchema, studentStatementSchema } from "./schemas";

export interface ObserverActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Crea una o varias anotaciones en el Observador (soporta felicitaciones grupales).
 * Verifica en bloque que cada matrícula pertenezca al año vigente y al alcance del actor.
 */
export async function createObserverRecordAction(
  _prev: ObserverActionState,
  formData: FormData,
): Promise<ObserverActionState> {
  const actor = await requirePermission("observer.create");

  const rawEnrollments = formData
    .getAll("enrollmentIds")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const parsed = createObserverSchema.safeParse({
    enrollmentIds: [...new Set(rawEnrollments)],
    periodId: formText(formData, "periodId"),
    category: formText(formData, "category"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    commitment: formText(formData, "commitment"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los campos del formulario." };
  }
  const input = parsed.data;

  const [currentYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!currentYear) return { status: "error", message: "No hay un año lectivo vigente." };

  if (input.periodId) {
    const [period] = await db
      .select({ id: academicPeriods.id })
      .from(academicPeriods)
      .where(and(eq(academicPeriods.id, input.periodId), eq(academicPeriods.academicYearId, currentYear.id)))
      .limit(1);
    if (!period) return { status: "error", message: "El periodo elegido no corresponde al año vigente." };
  }

  const targetEnrollments = await db
    .select({ id: enrollments.id, groupId: enrollments.groupId, studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.id, input.enrollmentIds),
        eq(enrollments.academicYearId, currentYear.id),
        eq(enrollments.status, "ACTIVE"),
      ),
    );
  if (targetEnrollments.length !== input.enrollmentIds.length) {
    return { status: "error", message: "Alguno de los estudiantes seleccionados no tiene matrícula activa." };
  }

  // Alcance RBAC: un docente solo puede anotar a estudiantes de los grupos que dicta o dirige.
  if (!can(actor.role, "observer.review")) {
    const groupIds = [...new Set(targetEnrollments.map((e) => e.groupId))];
    const allowed = await db
      .selectDistinct({ groupId: groups.id })
      .from(groups)
      .leftJoin(
        courseAssignments,
        and(eq(courseAssignments.groupId, groups.id), eq(courseAssignments.teacherId, actor.id)),
      )
      .where(
        and(
          inArray(groups.id, groupIds),
          eq(groups.academicYearId, currentYear.id),
          or(eq(groups.directorTeacherId, actor.id), eq(courseAssignments.teacherId, actor.id)),
        ),
      );
    if (allowed.length !== groupIds.length) {
      return { status: "error", message: "No tienes permiso para registrar anotaciones en ese grupo." };
    }
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(observerRecords)
      .values(
        targetEnrollments.map((e) => ({
          enrollmentId: e.id,
          periodId: input.periodId ?? null,
          authorId: actor.id,
          category: input.category,
          title: input.title,
          description: input.description,
          commitment: input.commitment ?? null,
        })),
      )
      .returning({ id: observerRecords.id, enrollmentId: observerRecords.enrollmentId });

    await tx.insert(auditLogs).values(
      inserted.map((rec) => ({
        actorUserId: actor.id,
        action: "OBSERVER_CREATED" as const,
        entityType: "observer_record",
        entityId: rec.id,
        afterJson: {
          enrollmentId: rec.enrollmentId,
          category: input.category,
          title: input.title,
          batchSize: inserted.length,
        },
        ipAddress: ip,
      })),
    );
  });

  refresh();
  return {
    status: "success",
    message:
      targetEnrollments.length === 1
        ? "Anotación registrada en el Observador."
        : `Anotación registrada para ${targetEnrollments.length} estudiantes.`,
  };
}

/**
 * Derecho a descargos del estudiante (REGLAS.md §2.4): se registra una sola vez
 * en anotaciones de seguimiento académico o convivencia.
 */
export async function submitStudentStatementAction(
  _prev: ObserverActionState,
  formData: FormData,
): Promise<ObserverActionState> {
  const actor = await requirePermission("observer.statement");
  const parsed = studentStatementSchema.safeParse({
    recordId: formText(formData, "recordId"),
    statement: formText(formData, "statement"),
    commitment: formText(formData, "commitment"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa tus descargos." };
  }
  const input = parsed.data;

  const [row] = await db
    .select({
      id: observerRecords.id,
      category: observerRecords.category,
      studentStatement: observerRecords.studentStatement,
      commitment: observerRecords.commitment,
      guardianAcknowledgedAt: observerRecords.guardianAcknowledgedAt,
      studentId: enrollments.studentId,
    })
    .from(observerRecords)
    .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
    .where(eq(observerRecords.id, input.recordId))
    .limit(1);

  if (!row || row.studentId !== actor.id) {
    return { status: "error", message: "No encontramos esta anotación en tu observador." };
  }
  if (!canStudentAddStatement(row)) {
    return { status: "error", message: "Esta anotación ya tiene descargos registrados o no requiere descargos." };
  }

  const now = new Date();
  const { ip } = await getRequestMeta();
  const nextCommitment = row.commitment ?? input.commitment ?? null;

  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(observerRecords)
      .set({
        studentStatement: input.statement,
        studentStatementAt: now,
        commitment: nextCommitment,
      })
      .where(and(eq(observerRecords.id, row.id), isNull(observerRecords.studentStatement)))
      .returning({ id: observerRecords.id });
    if (!saved) return false;

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "OBSERVER_STATEMENT_RECORDED",
        entityType: "observer_record",
        entityId: row.id,
        before: { studentStatement: null, commitment: row.commitment },
        after: { studentStatement: input.statement, commitment: nextCommitment },
        ipAddress: ip,
      },
      tx,
    );
    return true;
  });

  if (!updated) {
    return { status: "error", message: "Esta anotación ya tiene descargos registrados." };
  }

  refresh();
  return { status: "success", message: "Tus descargos quedaron registrados." };
}

/**
 * Confirmación de lectura ("Enterado") del acudiente con sello de fecha y hora
 * e IP en la auditoría (REGLAS.md §2.4).
 */
export async function acknowledgeObserverAction(
  _prev: ObserverActionState,
  formData: FormData,
): Promise<ObserverActionState> {
  const actor = await requirePermission("observer.acknowledge");
  const parsed = guardianAcknowledgeSchema.safeParse({
    recordId: formText(formData, "recordId"),
    comment: formText(formData, "comment"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el comentario." };
  }
  const input = parsed.data;

  const [row] = await db
    .select({
      id: observerRecords.id,
      category: observerRecords.category,
      studentStatement: observerRecords.studentStatement,
      guardianAcknowledgedAt: observerRecords.guardianAcknowledgedAt,
      studentId: enrollments.studentId,
    })
    .from(observerRecords)
    .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
    .where(eq(observerRecords.id, input.recordId))
    .limit(1);

  if (!row || !(await canAccessStudent(actor, row.studentId))) {
    return { status: "error", message: "No tienes permiso para confirmar esta anotación." };
  }
  if (!canGuardianAcknowledge(row)) {
    return { status: "error", message: "Esta anotación ya fue confirmada anteriormente." };
  }

  const now = new Date();
  const { ip } = await getRequestMeta();

  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(observerRecords)
      .set({
        guardianAcknowledgedAt: now,
        guardianAcknowledgedBy: actor.id,
        guardianComment: input.comment ?? null,
      })
      .where(and(eq(observerRecords.id, row.id), isNull(observerRecords.guardianAcknowledgedAt)))
      .returning({ id: observerRecords.id });
    if (!saved) return false;

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "OBSERVER_ACKNOWLEDGED",
        entityType: "observer_record",
        entityId: row.id,
        after: { acknowledgedAt: now.toISOString(), comment: input.comment ?? null },
        ipAddress: ip,
      },
      tx,
    );
    return true;
  });

  if (!updated) {
    return { status: "error", message: "Esta anotación ya fue confirmada anteriormente." };
  }

  refresh();
  return { status: "success", message: "Lectura confirmada (Enterado)." };
}
