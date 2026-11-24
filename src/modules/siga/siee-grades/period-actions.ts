"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { academicPeriods, courseAssignments, periodUnlockWindows } from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requirePermission } from "@/modules/core/auth/guards";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";

/** Cerrar o abrir un periodo completo (Coordinación / Secretaría / Rectoría). */
export async function setPeriodLockAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("structure.edit.academic");
  const parsed = z
    .object({ periodId: z.uuid(), locked: z.enum(["true", "false"]) })
    .safeParse({ periodId: formText(formData, "periodId"), locked: formText(formData, "locked") });
  if (!parsed.success) return;
  const locked = parsed.data.locked === "true";

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ gradesLocked: academicPeriods.gradesLocked, name: academicPeriods.name })
      .from(academicPeriods)
      .where(eq(academicPeriods.id, parsed.data.periodId))
      .limit(1);
    if (!before || before.gradesLocked === locked) return;

    await tx
      .update(academicPeriods)
      .set({ gradesLocked: locked })
      .where(eq(academicPeriods.id, parsed.data.periodId));
    if (locked) {
      // Al cerrar, cualquier ventana temporal pendiente pierde vigencia.
      await tx
        .update(periodUnlockWindows)
        .set({ closedAt: new Date() })
        .where(and(eq(periodUnlockWindows.periodId, parsed.data.periodId), isNull(periodUnlockWindows.closedAt)));
    }
    await recordAudit(
      {
        actorUserId: actor.id,
        action: locked ? "PERIOD_LOCKED" : "PERIOD_OPENED",
        entityType: "academic_period",
        entityId: parsed.data.periodId,
        before: { gradesLocked: before.gradesLocked },
        after: { gradesLocked: locked, period: before.name },
        ipAddress: ip,
      },
      tx,
    );
  });
  refresh();
}

export interface UnlockFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const unlockSchema = z.object({
  periodId: z.uuid(),
  courseAssignmentId: z.uuid().optional(),
  reason: z
    .string({ error: "Escribe el motivo de la reapertura." })
    .trim()
    .min(10, "Describe el motivo (mínimo 10 caracteres).")
    .max(300, "Usa máximo 300 caracteres."),
  hours: z.coerce.number().int().min(1, "Mínimo 1 hora.").max(72, "Máximo 72 horas."),
});

/** Ventana temporal de edición sobre un periodo cerrado, con motivo obligatorio y vencimiento. */
export async function openUnlockWindowAction(
  _prev: UnlockFormState,
  formData: FormData,
): Promise<UnlockFormState> {
  const actor = await requirePermission("periods.unlock");
  const parsed = unlockSchema.safeParse({
    periodId: formText(formData, "periodId"),
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    reason: formText(formData, "reason"),
    hours: formText(formData, "hours"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const [period] = await db
    .select({ gradesLocked: academicPeriods.gradesLocked, academicYearId: academicPeriods.academicYearId })
    .from(academicPeriods)
    .where(eq(academicPeriods.id, input.periodId))
    .limit(1);
  if (!period) return { status: "error", message: "El periodo no existe." };
  if (!period.gradesLocked) return { status: "error", message: "El periodo está abierto: no requiere ventana." };

  if (input.courseAssignmentId) {
    const [course] = await db
      .select({ academicYearId: courseAssignments.academicYearId })
      .from(courseAssignments)
      .where(eq(courseAssignments.id, input.courseAssignmentId))
      .limit(1);
    if (!course || course.academicYearId !== period.academicYearId) {
      return { status: "error", message: "La carga académica no corresponde a este año." };
    }
  }

  const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000);
  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [window] = await tx
      .insert(periodUnlockWindows)
      .values({
        periodId: input.periodId,
        courseAssignmentId: input.courseAssignmentId ?? null,
        reason: input.reason,
        openedBy: actor.id,
        expiresAt,
      })
      .returning({ id: periodUnlockWindows.id });
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "PERIOD_UNLOCKED",
        entityType: "academic_period",
        entityId: input.periodId,
        after: {
          windowId: window!.id,
          reason: input.reason,
          expiresAt: expiresAt.toISOString(),
          courseAssignmentId: input.courseAssignmentId ?? null,
        },
        ipAddress: ip,
      },
      tx,
    );
  });
  refresh();
  return { status: "success", message: `Ventana abierta por ${input.hours} h.` };
}

export async function closeUnlockWindowAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("periods.unlock");
  const parsed = z.object({ windowId: z.uuid() }).safeParse({ windowId: formText(formData, "windowId") });
  if (!parsed.success) return;

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [window] = await tx
      .update(periodUnlockWindows)
      .set({ closedAt: new Date() })
      .where(and(eq(periodUnlockWindows.id, parsed.data.windowId), isNull(periodUnlockWindows.closedAt)))
      .returning({ periodId: periodUnlockWindows.periodId });
    if (!window) return;
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "PERIOD_UNLOCK_CLOSED",
        entityType: "academic_period",
        entityId: window.periodId,
        after: { windowId: parsed.data.windowId },
        ipAddress: ip,
      },
      tx,
    );
  });
  refresh();
}
