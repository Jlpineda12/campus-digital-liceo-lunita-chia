"use server";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { academicYears, attendanceExcuses, attendanceLogs, enrollments } from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission } from "@/modules/core/auth/guards";
import { canAccessStudent } from "@/modules/core/auth/policies";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { getCourseContext } from "@/modules/siga/siee-grades/access";
import {
  reviewExcuseSchema,
  saveAttendanceRollSchema,
  submitExcuseSchema,
  type SaveAttendanceRollInput,
} from "./schemas";

export type SaveRollResult =
  | { ok: true; saved: number; savedAt: string }
  | { ok: false; message: string };

/**
 * Guardado masivo del llamado a lista por clase y fecha (Docente titular).
 * Transaccional y auditado; usa el índice único parcial `attendance_logs_class_uq`.
 */
export async function saveAttendanceRollAction(input: SaveAttendanceRollInput): Promise<SaveRollResult> {
  const actor = await requirePermission("attendance.take");
  const parsed = saveAttendanceRollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos de la lista." };
  }
  const { courseAssignmentId, date, entries } = parsed.data;

  const course = await getCourseContext(courseAssignmentId);
  if (!course || course.teacherId !== actor.id) {
    return { ok: false, message: "Solo el docente titular de esta asignatura puede tomar lista." };
  }

  const [year] = await db
    .select({ startDate: academicYears.startDate, endDate: academicYears.endDate })
    .from(academicYears)
    .where(eq(academicYears.id, course.academicYearId))
    .limit(1);
  if (year && (date < year.startDate || date > year.endDate)) {
    return { ok: false, message: "La fecha seleccionada está fuera del calendario del año lectivo." };
  }

  const enrollmentIds = [...new Set(entries.map((e) => e.enrollmentId))];
  const validEnrollments = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.id, enrollmentIds),
        eq(enrollments.groupId, course.groupId),
        eq(enrollments.academicYearId, course.academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    );
  if (validEnrollments.length !== enrollmentIds.length) {
    return { ok: false, message: "Algunos estudiantes no pertenecen a este grupo." };
  }

  const now = new Date();
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    await tx
      .insert(attendanceLogs)
      .values(
        entries.map((e) => ({
          enrollmentId: e.enrollmentId,
          courseAssignmentId,
          date,
          status: e.status,
          notes: e.notes,
          recordedBy: actor.id,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [attendanceLogs.enrollmentId, attendanceLogs.courseAssignmentId, attendanceLogs.date],
        targetWhere: sql`${attendanceLogs.courseAssignmentId} is not null`,
        set: {
          status: sql`excluded.status`,
          notes: sql`excluded.notes`,
          recordedBy: sql`excluded.recorded_by`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "ATTENDANCE_RECORDED",
        entityType: "course_assignment",
        entityId: courseAssignmentId,
        after: {
          date,
          total: entries.length,
          absent: entries.filter((e) => e.status === "ABSENT").length,
          late: entries.filter((e) => e.status === "LATE").length,
          excused: entries.filter((e) => e.status === "EXCUSED").length,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { ok: true, saved: entries.length, savedAt: now.toISOString() };
}

export interface ExcuseFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

/** Radicación de excusa por parte del acudiente (valida vínculo en guardian_links). */
export async function submitExcuseAction(
  _prev: ExcuseFormState,
  formData: FormData,
): Promise<ExcuseFormState> {
  const actor = await requirePermission("attendance.excuses.submit");
  const parsed = submitExcuseSchema.safeParse({
    enrollmentId: formText(formData, "enrollmentId"),
    fromDate: formText(formData, "fromDate"),
    toDate: formText(formData, "toDate"),
    reasonType: formText(formData, "reasonType"),
    description: formText(formData, "description"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos de la excusa." };
  }
  const input = parsed.data;

  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      startDate: academicYears.startDate,
      endDate: academicYears.endDate,
    })
    .from(enrollments)
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .where(and(eq(enrollments.id, input.enrollmentId), eq(enrollments.status, "ACTIVE")))
    .limit(1);
  if (!enrollment || !(await canAccessStudent(actor, enrollment.studentId))) {
    return { status: "error", message: "No tienes permiso para radicar excusas para este estudiante." };
  }
  if (input.fromDate < enrollment.startDate || input.toDate > enrollment.endDate) {
    return { status: "error", message: "Las fechas de la excusa deben estar dentro del año lectivo activo." };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(attendanceExcuses)
      .values({
        enrollmentId: enrollment.id,
        guardianId: actor.id,
        fromDate: input.fromDate,
        toDate: input.toDate,
        reasonType: input.reasonType,
        description: input.description,
      })
      .returning({ id: attendanceExcuses.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "EXCUSE_SUBMITTED",
        entityType: "attendance_excuse",
        entityId: created!.id,
        after: {
          enrollmentId: enrollment.id,
          fromDate: input.fromDate,
          toDate: input.toDate,
          reasonType: input.reasonType,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Excusa radicada. Coordinación la revisará pronto." };
}

/**
 * Aprobación o rechazo de excusa por Coordinación / Secretaría.
 * Al aprobar, convierte automáticamente las fallas (`ABSENT`) existentes en ese
 * rango de fechas a `EXCUSED` dentro de la misma transacción.
 */
export async function reviewExcuseAction(
  _prev: ExcuseFormState,
  formData: FormData,
): Promise<ExcuseFormState> {
  const actor = await requirePermission("attendance.excuses.review");
  const parsed = reviewExcuseSchema.safeParse({
    excuseId: formText(formData, "excuseId"),
    decision: formText(formData, "decision"),
    reviewNotes: formText(formData, "reviewNotes"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa la decisión." };
  }
  const input = parsed.data;
  const now = new Date();
  const { ip } = await getRequestMeta();

  const reviewed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(attendanceExcuses)
      .set({
        status: input.decision,
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNotes: input.reviewNotes ?? null,
      })
      .where(and(eq(attendanceExcuses.id, input.excuseId), eq(attendanceExcuses.status, "PENDING")))
      .returning({
        id: attendanceExcuses.id,
        enrollmentId: attendanceExcuses.enrollmentId,
        fromDate: attendanceExcuses.fromDate,
        toDate: attendanceExcuses.toDate,
      });

    if (!updated) return null;

    let excusedLogs = 0;
    if (input.decision === "APPROVED") {
      const changed = await tx
        .update(attendanceLogs)
        .set({ status: "EXCUSED", updatedAt: now })
        .where(
          and(
            eq(attendanceLogs.enrollmentId, updated.enrollmentId),
            eq(attendanceLogs.status, "ABSENT"),
            gte(attendanceLogs.date, updated.fromDate),
            lte(attendanceLogs.date, updated.toDate),
          ),
        )
        .returning({ id: attendanceLogs.id });
      excusedLogs = changed.length;
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "EXCUSE_REVIEWED",
        entityType: "attendance_excuse",
        entityId: updated.id,
        after: {
          decision: input.decision,
          reviewNotes: input.reviewNotes ?? null,
          excusedLogs,
        },
        ipAddress: ip,
      },
      tx,
    );
    return { excusedLogs };
  });

  if (!reviewed) {
    return { status: "error", message: "Esta excusa ya fue revisada anteriormente." };
  }

  refresh();
  return {
    status: "success",
    message:
      input.decision === "APPROVED"
        ? reviewed.excusedLogs > 0
          ? `Excusa aprobada (${reviewed.excusedLogs} falla${reviewed.excusedLogs === 1 ? "" : "s"} justificada${reviewed.excusedLogs === 1 ? "" : "s"}).`
          : "Excusa aprobada."
        : "Excusa rechazada con observación registrada.",
  };
}
