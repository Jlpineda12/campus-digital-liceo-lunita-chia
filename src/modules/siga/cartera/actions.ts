"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  academicYears,
  billingCharges,
  billingPayments,
  certificates,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
} from "@/db/schema";
import { PAYMENT_CHANNELS } from "@/db/schema/matriculas";
import { sanitizeAulaText } from "@/modules/aula/sanitize";
import { todayInBogota } from "@/modules/core/academic-structure/queries";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { canAccessStudent } from "@/modules/core/auth/policies";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { FEE_SCHEDULE_2027 } from "@/modules/matriculas/catalog";
import {
  computePendingAmount,
  deriveChargeStatus,
  SCHOOL_MONTH_LABELS,
  summarizeAccount,
} from "./calculator";

export interface CarteraActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** Genera cobros de Matrícula y Pensión del año vigente para todos los matriculados (idempotente). */
export async function generateYearChargesAction(
  _prev: CarteraActionState,
  formData: FormData,
): Promise<CarteraActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "billing.manage")) {
    return { status: "error", message: "Solo Secretaría o Tesorería pueden generar cartera." };
  }

  const academicYearId = formText(formData, "academicYearId") ?? "";
  if (!z.uuid().safeParse(academicYearId).success) {
    return { status: "error", message: "Año lectivo inválido." };
  }

  const [year] = await db
    .select({ id: academicYears.id, year: academicYears.year })
    .from(academicYears)
    .where(eq(academicYears.id, academicYearId))
    .limit(1);
  if (!year) return { status: "error", message: "Año lectivo no encontrado." };

  const activeEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      levelCode: levels.code,
    })
    .from(enrollments)
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(and(eq(enrollments.academicYearId, year.id), eq(enrollments.status, "ACTIVE")));

  if (activeEnrollments.length === 0) {
    return { status: "error", message: "No hay estudiantes activos en este año lectivo." };
  }

  const months = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const rows: Array<typeof billingCharges.$inferInsert> = [];

  for (const enr of activeEnrollments) {
    const tariff = FEE_SCHEDULE_2027[enr.levelCode];
    for (const m of months) {
      const isFee = m === 0;
      const dueDate = isFee
        ? `${year.year}-01-25`
        : `${year.year}-${String(m).padStart(2, "0")}-10`;
      rows.push({
        enrollmentId: enr.enrollmentId,
        academicYearId: year.id,
        chargeType: isFee ? "ENROLLMENT_FEE" : "TUITION",
        billingMonth: m,
        concept: `${SCHOOL_MONTH_LABELS[m]} ${year.year}`,
        amountCop: isFee ? tariff.enrollmentCop : tariff.monthlyCop,
        discountCop: 0,
        paidCop: 0,
        dueDate,
        status: "PENDING",
      });
    }
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.insert(billingCharges).values(rows).onConflictDoNothing();
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "BILLING_CHARGE_CREATED",
        entityType: "academic_year",
        entityId: year.id,
        after: { students: activeEnrollments.length, generatedCandidates: rows.length },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `Cartera verificada para ${activeEnrollments.length} estudiantes (Matrícula + 10 pensiones).`,
  };
}

const recordPaymentSchema = z.object({
  chargeId: z.uuid(),
  amountCop: z.coerce.number().int().min(1000, "El monto mínimo es $1.000 COP.").max(50_000_000),
  channel: z.enum(PAYMENT_CHANNELS),
  referenceCode: z.string({ error: "Escribe la referencia de pago." }).trim().min(2).max(60),
  notes: z.string().trim().max(240).optional().default(""),
});

/** Registra un pago o abono sobre un cobro de cartera y emite número de recibo único. */
export async function recordPaymentAction(
  _prev: CarteraActionState,
  formData: FormData,
): Promise<CarteraActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "billing.manage")) {
    return { status: "error", message: "Solo Tesorería / Secretaría puede registrar pagos." };
  }

  const rawAmount = (formText(formData, "amountCop") ?? "").replace(/[^0-9]/g, "");
  const parsed = recordPaymentSchema.safeParse({
    chargeId: formText(formData, "chargeId"),
    amountCop: rawAmount,
    channel: formText(formData, "channel"),
    referenceCode: formText(formData, "referenceCode"),
    notes: formText(formData, "notes") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  }
  const input = parsed.data;

  const [charge] = await db
    .select()
    .from(billingCharges)
    .where(eq(billingCharges.id, input.chargeId))
    .limit(1);
  if (!charge) return { status: "error", message: "Cobro no encontrado." };

  const pending = computePendingAmount(charge);
  if (pending <= 0) return { status: "error", message: "Este cobro ya se encuentra totalmente pagado." };
  if (input.amountCop > pending) {
    return { status: "error", message: `El monto supera el saldo pendiente ($${pending.toLocaleString("es-CO")}).` };
  }

  const newPaid = charge.paidCop + input.amountCop;
  const today = todayInBogota();
  const nextStatus = deriveChargeStatus(
    {
      amountCop: charge.amountCop,
      discountCop: charge.discountCop,
      paidCop: newPaid,
      dueDate: charge.dueDate,
    },
    today,
  );

  const receiptNumber = `REC-${today.slice(0, 4)}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(billingPayments)
      .values({
        chargeId: charge.id,
        amountCop: input.amountCop,
        channel: input.channel,
        referenceCode: sanitizeAulaText(input.referenceCode),
        receiptNumber,
        notes: sanitizeAulaText(input.notes),
        recordedBy: actor.id,
      })
      .returning({ id: billingPayments.id });

    await tx
      .update(billingCharges)
      .set({ paidCop: newPaid, status: nextStatus, updatedAt: new Date() })
      .where(eq(billingCharges.id, charge.id));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "BILLING_PAYMENT_RECORDED",
        entityType: "billing_payment",
        entityId: payment!.id,
        after: {
          chargeId: charge.id,
          amountCop: input.amountCop,
          channel: input.channel,
          receiptNumber,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `Pago registrado · Recibo ${receiptNumber}.`,
  };
}

/** Emite Paz y Salvo verificable por QR (`/verificar/[codigo]`) si el estudiante está al día. */
export async function issuePazYSalvoAction(
  _prev: CarteraActionState,
  formData: FormData,
): Promise<CarteraActionState> {
  const actor = await requireSession();
  const enrollmentId = formText(formData, "enrollmentId") ?? "";
  if (!z.uuid().safeParse(enrollmentId).success) {
    return { status: "error", message: "Matrícula inválida." };
  }

  const [enr] = await db
    .select({ id: enrollments.id, studentId: enrollments.studentId, academicYearId: enrollments.academicYearId })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  if (!enr) return { status: "error", message: "Estudiante no encontrado." };

  const isAdmin = can(actor.role, "billing.manage");
  if (!isAdmin) {
    if (actor.role !== "GUARDIAN") {
      return { status: "error", message: "No autorizado para emitir este paz y salvo." };
    }
    const [link] = await db
      .select({ isFinancialResponsible: guardianLinks.isFinancialResponsible })
      .from(guardianLinks)
      .where(and(eq(guardianLinks.guardianId, actor.id), eq(guardianLinks.studentId, enr.studentId)))
      .limit(1);
    const allowed = Boolean(link?.isFinancialResponsible) && (await canAccessStudent(actor, enr.studentId));
    if (!allowed) {
      return {
        status: "error",
        message: "Solo el acudiente registrado como responsable financiero puede emitir el Paz y Salvo.",
      };
    }
  }

  const charges = await db
    .select()
    .from(billingCharges)
    .where(and(eq(billingCharges.enrollmentId, enr.id), eq(billingCharges.academicYearId, enr.academicYearId)));

  const summary = summarizeAccount(charges, todayInBogota());
  if (!summary.isClear) {
    return {
      status: "error",
      message: "El estudiante aún presenta saldo pendiente; el Paz y Salvo se habilita al estar al día.",
    };
  }

  const [existing] = await db
    .select({ verificationCode: certificates.verificationCode })
    .from(certificates)
    .where(and(eq(certificates.enrollmentId, enr.id), eq(certificates.type, "PAZ_Y_SALVO")))
    .limit(1);

  if (existing) {
    refresh();
    return { status: "success", message: `Paz y Salvo vigente · Código ${existing.verificationCode}.` };
  }

  const verificationCode = `PYS-${todayInBogota().slice(0, 4)}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [cert] = await tx
      .insert(certificates)
      .values({
        type: "PAZ_Y_SALVO",
        enrollmentId: enr.id,
        verificationCode,
        issuedBy: actor.id,
      })
      .returning({ id: certificates.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "PAZ_Y_SALVO_ISSUED",
        entityType: "certificate",
        entityId: cert!.id,
        after: { enrollmentId: enr.id, verificationCode },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: `Paz y Salvo emitido · Código verificable ${verificationCode}.`,
  };
}

const discountSchema = z.object({
  chargeId: z.uuid(),
  discountCop: z.coerce.number().int().min(0).max(50_000_000),
  waive: z.boolean().default(false),
  reason: z.string({ error: "Indica el motivo del ajuste o beca." }).trim().min(4, "Motivo mínimo de 4 caracteres.").max(240),
});

/**
 * Aplica un descuento (beca, hermanos, pronto pago) o exonera una cuota específica.
 * Exclusivo `ADMIN` (`billing.manage`), con motivo obligatorio e historial en `audit_logs`.
 */
export async function applyDiscountOrWaiveAction(
  _prev: CarteraActionState,
  formData: FormData,
): Promise<CarteraActionState> {
  const actor = await requireSession();
  if (!can(actor.role, "billing.manage")) {
    return { status: "error", message: "Solo Tesorería / Rectoría puede aplicar descuentos o exoneraciones." };
  }

  const rawDiscount = (formText(formData, "discountCop") ?? "0").replace(/[^0-9]/g, "") || "0";
  const parsed = discountSchema.safeParse({
    chargeId: formText(formData, "chargeId"),
    discountCop: rawDiscount,
    waive: formData.get("waive") === "on",
    reason: formText(formData, "reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del ajuste." };
  }
  const input = parsed.data;

  const [charge] = await db
    .select()
    .from(billingCharges)
    .where(eq(billingCharges.id, input.chargeId))
    .limit(1);
  if (!charge) return { status: "error", message: "Cobro no encontrado." };
  if (input.discountCop > charge.amountCop) {
    return { status: "error", message: "El descuento no puede superar el valor base de la cuota." };
  }

  const nextStatus = input.waive
    ? ("WAIVED" as const)
    : deriveChargeStatus(
        {
          amountCop: charge.amountCop,
          discountCop: input.discountCop,
          paidCop: charge.paidCop,
          dueDate: charge.dueDate,
        },
        todayInBogota(),
      );

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(billingCharges)
      .set({
        discountCop: input.waive ? charge.amountCop : input.discountCop,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(billingCharges.id, charge.id));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "BILLING_DISCOUNT_APPLIED",
        entityType: "billing_charge",
        entityId: charge.id,
        before: { discountCop: charge.discountCop, status: charge.status },
        after: {
          discountCop: input.waive ? charge.amountCop : input.discountCop,
          status: nextStatus,
          waive: input.waive,
          reason: sanitizeAulaText(input.reason),
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: input.waive
      ? "Cuota exonerada y registrada en auditoría financiera."
      : "Descuento aplicado correctamente a la cuota.",
  };
}
