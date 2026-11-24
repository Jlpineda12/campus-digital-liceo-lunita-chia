"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  academicPeriods,
  academicYears,
  enrollments,
  groups,
  reportCards,
} from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission, requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { weightedAverage } from "@/modules/siga/siee-grades/calculator";
import { getScaleForYear, getStudentPeriodGrades } from "@/modules/siga/siee-grades/queries";
import { getPerformanceLevel, roundScore } from "@/modules/siga/siee-grades/scale";
import { createReportCardCode } from "./qr";

export interface ReportCardActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

const issueGroupSchema = z.object({
  groupId: z.uuid({ error: "Grupo inválido." }),
  periodId: z.uuid({ error: "Periodo inválido." }),
});

/**
 * Emisión o re-emisión oficial por lote de boletines de un grupo (Secretaría / Rectoría).
 * Calcula promedios SIEE, genera códigos QR criptográficos y registra auditoría en transacción.
 */
export async function issueGroupReportCardsAction(
  _prev: ReportCardActionState,
  formData: FormData,
): Promise<ReportCardActionState> {
  const actor = await requirePermission("reportCards.issue");
  const parsed = issueGroupSchema.safeParse({
    groupId: formText(formData, "groupId"),
    periodId: formText(formData, "periodId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Parámetros inválidos." };
  }
  const { groupId, periodId } = parsed.data;

  const [group] = await db
    .select({
      id: groups.id,
      name: groups.name,
      academicYearId: groups.academicYearId,
      year: academicYears.year,
    })
    .from(groups)
    .innerJoin(academicYears, eq(academicYears.id, groups.academicYearId))
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return { status: "error", message: "El grupo no existe." };

  const [period] = await db
    .select({ id: academicPeriods.id, number: academicPeriods.number, name: academicPeriods.name })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, periodId), eq(academicPeriods.academicYearId, group.academicYearId)))
    .limit(1);
  if (!period) return { status: "error", message: "El periodo no corresponde a este año lectivo." };

  const [roster, scale] = await Promise.all([
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.groupId, group.id),
          eq(enrollments.academicYearId, group.academicYearId),
          eq(enrollments.status, "ACTIVE"),
        ),
      ),
    getScaleForYear(group.academicYearId),
  ]);
  if (roster.length === 0) {
    return { status: "error", message: "Este grupo no tiene estudiantes con matrícula activa." };
  }

  const existing = await db
    .select({
      enrollmentId: reportCards.enrollmentId,
      verificationCode: reportCards.verificationCode,
      directorObservations: reportCards.directorObservations,
    })
    .from(reportCards)
    .where(
      and(
        eq(reportCards.periodId, period.id),
        inArray(
          reportCards.enrollmentId,
          roster.map((r) => r.id),
        ),
      ),
    );
  const existingMap = new Map(existing.map((e) => [e.enrollmentId, e]));

  // Cálculo paralelo de promedios del grupo (<= 35 estudiantes por grupo).
  const summaries = await Promise.all(
    roster.map(async (enr) => {
      const subjects = await getStudentPeriodGrades({
        enrollmentId: enr.id,
        groupId: group.id,
        periodId: period.id,
        scale,
      });
      const finals = subjects.map((s) => s.result.final).filter((f): f is number => f !== null);
      const rawAvg = weightedAverage(finals.map((value) => ({ value, weight: 1 })));
      const averageScore = rawAvg === null ? null : roundScore(rawAvg);
      const performanceLevel = averageScore === null ? null : getPerformanceLevel(averageScore, scale);
      return { enrollmentId: enr.id, averageScore, performanceLevel };
    }),
  );

  const now = new Date();
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    for (const s of summaries) {
      const prev = existingMap.get(s.enrollmentId);
      const verificationCode = prev?.verificationCode ?? createReportCardCode(group.year, period.number);
      await tx
        .insert(reportCards)
        .values({
          enrollmentId: s.enrollmentId,
          periodId: period.id,
          verificationCode,
          averageScore: s.averageScore,
          performanceLevel: s.performanceLevel,
          directorObservations: prev?.directorObservations ?? null,
          isStale: false,
          issuedAt: now,
        })
        .onConflictDoUpdate({
          target: [reportCards.enrollmentId, reportCards.periodId],
          set: {
            averageScore: s.averageScore,
            performanceLevel: s.performanceLevel,
            isStale: false,
            issuedAt: now,
          },
        });
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "REPORT_CARDS_ISSUED",
        entityType: "group",
        entityId: group.id,
        after: {
          groupName: group.name,
          periodId: period.id,
          periodName: period.name,
          issuedCount: summaries.length,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `Boletines habilitados para estudiantes y padres de ${group.name} (${summaries.length} emitidos).`,
  };
}

/**
 * Oculta / retira la habilitación de los boletines de un grupo para estudiantes
 * y acudientes (solo Rectoría / Secretaría). Conserva observaciones y códigos.
 */
export async function hideGroupReportCardsAction(
  _prev: ReportCardActionState,
  formData: FormData,
): Promise<ReportCardActionState> {
  const actor = await requirePermission("reportCards.issue");
  const parsed = issueGroupSchema.safeParse({
    groupId: formText(formData, "groupId"),
    periodId: formText(formData, "periodId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Parámetros inválidos." };
  }
  const { groupId, periodId } = parsed.data;

  const [group] = await db
    .select({ id: groups.id, name: groups.name, academicYearId: groups.academicYearId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return { status: "error", message: "El grupo no existe." };

  const roster = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.groupId, group.id), eq(enrollments.academicYearId, group.academicYearId)));
  if (roster.length === 0) return { status: "error", message: "No hay estudiantes en este grupo." };

  const { ip } = await getRequestMeta();
  const hiddenCount = await db.transaction(async (tx) => {
    const updated = await tx
      .update(reportCards)
      .set({ issuedAt: null })
      .where(
        and(
          eq(reportCards.periodId, periodId),
          inArray(
            reportCards.enrollmentId,
            roster.map((r) => r.id),
          ),
        ),
      )
      .returning({ id: reportCards.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "REPORT_CARDS_HIDDEN",
        entityType: "group",
        entityId: group.id,
        after: { groupName: group.name, periodId, hiddenCount: updated.length },
        ipAddress: ip,
      },
      tx,
    );
    return updated.length;
  });

  refresh();
  return {
    status: "success",
    message: `Se ocultaron ${hiddenCount} boletines de ${group.name}. Estudiantes y padres ya no pueden verlos hasta nueva habilitación de Rectoría.`,
  };
}

const observationSchema = z.object({
  enrollmentId: z.uuid({ error: "Estudiante inválido." }),
  periodId: z.uuid({ error: "Periodo inválido." }),
  observation: z
    .string({ error: "Escribe la observación del director de grupo." })
    .trim()
    .min(5, "Escribe al menos 5 caracteres.")
    .max(800, "Máximo 800 caracteres."),
});

/**
 * Observación general del Director(a) de Grupo para el boletín del periodo.
 * Autorizado para el director del grupo o Secretaría/Coordinación.
 */
export async function saveDirectorObservationAction(
  _prev: ReportCardActionState,
  formData: FormData,
): Promise<ReportCardActionState> {
  const actor = await requireSession();
  const parsed = observationSchema.safeParse({
    enrollmentId: formText(formData, "enrollmentId"),
    periodId: formText(formData, "periodId"),
    observation: formText(formData, "observation"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa la observación." };
  }
  const { enrollmentId, periodId, observation } = parsed.data;

  const [enr] = await db
    .select({
      id: enrollments.id,
      academicYearId: enrollments.academicYearId,
      directorTeacherId: groups.directorTeacherId,
      year: academicYears.year,
    })
    .from(enrollments)
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.status, "ACTIVE")))
    .limit(1);

  if (!enr) return { status: "error", message: "No encontramos la matrícula del estudiante." };

  const allowed =
    can(actor.role, "reportCards.preview") ||
    (actor.role === "TEACHER" && enr.directorTeacherId === actor.id);
  if (!allowed) {
    return { status: "error", message: "Solo el director de grupo o Coordinación pueden editar esta observación." };
  }

  const [period] = await db
    .select({ id: academicPeriods.id, number: academicPeriods.number })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, periodId), eq(academicPeriods.academicYearId, enr.academicYearId)))
    .limit(1);
  if (!period) return { status: "error", message: "Periodo inválido." };

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: reportCards.id, directorObservations: reportCards.directorObservations })
      .from(reportCards)
      .where(and(eq(reportCards.enrollmentId, enrollmentId), eq(reportCards.periodId, periodId)))
      .limit(1);

    if (existing) {
      await tx
        .update(reportCards)
        .set({ directorObservations: observation })
        .where(eq(reportCards.id, existing.id));
    } else {
      await tx.insert(reportCards).values({
        enrollmentId,
        periodId,
        verificationCode: createReportCardCode(enr.year, period.number),
        directorObservations: observation,
        issuedAt: null,
      });
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "REPORT_CARD_OBSERVATION_SAVED",
        entityType: "report_card",
        entityId: `${enrollmentId}:${periodId}`,
        before: { directorObservations: existing?.directorObservations ?? null },
        after: { directorObservations: observation },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Observación guardada en el boletín." };
}
