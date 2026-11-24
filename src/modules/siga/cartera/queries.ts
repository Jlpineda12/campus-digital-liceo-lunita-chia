import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  billingCharges,
  billingPayments,
  certificates,
  enrollments,
  grades,
  groups,
  levels,
  users,
} from "@/db/schema";
import { PAYMENT_CHANNELS, type BillingChargeStatus, type PaymentChannel } from "@/db/schema/matriculas";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import {
  getGuardianChildren,
  getStudentPlacement,
  todayInBogota,
} from "@/modules/core/academic-structure/queries";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import {
  BILLING_MONTH_COLUMNS,
  computeNetAmount,
  computePendingAmount,
  deriveChargeStatus,
  summarizeAccount,
} from "./calculator";

export interface BillingPaymentView {
  id: string;
  amountCop: number;
  channel: PaymentChannel;
  referenceCode: string;
  receiptNumber: string;
  notes: string;
  paidAt: Date;
}

export interface BillingChargeView {
  id: string;
  concept: string;
  billingMonth: number;
  amountCop: number;
  discountCop: number;
  netCop: number;
  paidCop: number;
  pendingCop: number;
  dueDate: string;
  status: BillingChargeStatus;
  payments: BillingPaymentView[];
}

export interface FamilyBillingStatement {
  enrollmentId: string;
  studentName: string;
  studentDocument: string;
  gradeName: string;
  groupName: string;
  levelCode: LevelCode;
  charges: BillingChargeView[];
  summary: {
    totalNetCop: number;
    totalPaidCop: number;
    totalPendingCop: number;
    overdueCount: number;
    isClear: boolean;
  };
  pazYSalvo: {
    verificationCode: string;
    issuedAt: Date;
  } | null;
}

export type FamilyBillingResult =
  | { kind: "ok"; statement: FamilyBillingStatement }
  | { kind: "not_financial_responsible"; studentName: string }
  | { kind: "no_student" };

/**
 * Carga el estado de cuenta de un hijo para un acudiente.
 * SEGURIDAD: exige `guardian_links.is_financial_responsible = true` para impedir que
 * terceros autorizados solo para recoger al menor consulten información financiera.
 */
export async function getFamilyBillingStatement(
  actor: SessionUser,
  academicYearId: string,
): Promise<FamilyBillingResult> {
  const children = await getGuardianChildren(actor.id, academicYearId);
  const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
  const child = children.find((c) => c.studentId === selectedId);
  if (!child) return { kind: "no_student" };

  if (!child.isFinancialResponsible) {
    return {
      kind: "not_financial_responsible",
      studentName: `${child.firstName} ${child.lastName}`,
    };
  }

  const placement = await getStudentPlacement(child.studentId, academicYearId);
  if (!placement) return { kind: "no_student" };

  const [studentRow, chargeRows, certRows] = await Promise.all([
    db
      .select({ documentNumber: users.documentNumber })
      .from(users)
      .where(eq(users.id, child.studentId))
      .limit(1),
    db
      .select()
      .from(billingCharges)
      .where(
        and(
          eq(billingCharges.enrollmentId, placement.enrollmentId),
          eq(billingCharges.academicYearId, academicYearId),
        ),
      )
      .orderBy(asc(billingCharges.billingMonth), asc(billingCharges.dueDate)),
    db
      .select({
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
      })
      .from(certificates)
      .where(
        and(
          eq(certificates.enrollmentId, placement.enrollmentId),
          eq(certificates.type, "PAZ_Y_SALVO"),
        ),
      )
      .orderBy(desc(certificates.issuedAt))
      .limit(1),
  ]);

  const chargeIds = chargeRows.map((c) => c.id);
  const paymentRows =
    chargeIds.length > 0
      ? await db
          .select()
          .from(billingPayments)
          .where(inArray(billingPayments.chargeId, chargeIds))
          .orderBy(desc(billingPayments.paidAt))
      : [];

  const paymentsByCharge = new Map<string, BillingPaymentView[]>();
  for (const p of paymentRows) {
    const list = paymentsByCharge.get(p.chargeId) ?? [];
    list.push({
      id: p.id,
      amountCop: p.amountCop,
      channel: p.channel,
      referenceCode: p.referenceCode,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
      paidAt: p.paidAt,
    });
    paymentsByCharge.set(p.chargeId, list);
  }

  const today = todayInBogota();
  const charges: BillingChargeView[] = chargeRows.map((c) => ({
    id: c.id,
    concept: c.concept,
    billingMonth: c.billingMonth,
    amountCop: c.amountCop,
    discountCop: c.discountCop,
    netCop: computeNetAmount(c.amountCop, c.discountCop),
    paidCop: c.paidCop,
    pendingCop: computePendingAmount(c),
    dueDate: c.dueDate,
    status: deriveChargeStatus(c, today),
    payments: paymentsByCharge.get(c.id) ?? [],
  }));

  return {
    kind: "ok",
    statement: {
      enrollmentId: placement.enrollmentId,
      studentName: `${child.firstName} ${child.lastName}`,
      studentDocument: studentRow[0]?.documentNumber ?? "",
      gradeName: placement.gradeName,
      groupName: placement.groupName,
      levelCode: placement.levelCode,
      charges,
      summary: summarizeAccount(charges, today),
      pazYSalvo: certRows[0] ?? null,
    },
  };
}

export interface MonthlyCollectionSummary {
  month: number;
  shortLabel: string;
  label: string;
  billedCop: number;
  collectedCop: number;
  pendingCop: number;
  paidCount: number;
  overdueCount: number;
  collectionPercent: number;
}

export interface ChannelCollectionSummary {
  channel: PaymentChannel;
  totalCop: number;
  paymentCount: number;
}

export interface LedgerReceiptRow {
  paymentId: string;
  receiptNumber: string;
  paidAt: Date;
  studentName: string;
  documentNumber: string;
  groupName: string;
  levelCode: LevelCode;
  concept: string;
  channel: PaymentChannel;
  referenceCode: string;
  amountCop: number;
}

export interface CourseGroupOption {
  groupName: string;
  gradeName: string;
  gradeOrder: number;
  levelCode: LevelCode;
  studentCount: number;
  clearCount: number;
  overdueCount: number;
  billedCop: number;
  collectedCop: number;
  pendingCop: number;
  collectionPercent: number;
}

export interface AdminBillingAccountRow {
  enrollmentId: string;
  studentName: string;
  documentNumber: string;
  groupName: string;
  gradeName: string;
  gradeOrder: number;
  levelCode: LevelCode;
  totalNetCop: number;
  totalPaidCop: number;
  totalPendingCop: number;
  overdueCount: number;
  isClear: boolean;
  pazYSalvoCode: string | null;
  charges: BillingChargeView[];
}

export async function getAdminBillingOverview(academicYearId: string) {
  const [roster, allCharges, allCerts] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.id,
        firstName: users.firstName,
        lastName: users.lastName,
        documentNumber: users.documentNumber,
        groupName: groups.name,
        gradeName: grades.name,
        gradeOrder: grades.displayOrder,
        levelCode: levels.code,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(and(eq(enrollments.academicYearId, academicYearId), eq(enrollments.status, "ACTIVE")))
      .orderBy(asc(grades.displayOrder), asc(groups.name), asc(users.lastName), asc(users.firstName)),
    db
      .select()
      .from(billingCharges)
      .where(eq(billingCharges.academicYearId, academicYearId))
      .orderBy(asc(billingCharges.billingMonth), asc(billingCharges.dueDate)),
    db
      .select({
        enrollmentId: certificates.enrollmentId,
        verificationCode: certificates.verificationCode,
      })
      .from(certificates)
      .where(eq(certificates.type, "PAZ_Y_SALVO")),
  ]);

  const chargeIds = allCharges.map((c) => c.id);
  const allPayments =
    chargeIds.length > 0
      ? await db
          .select()
          .from(billingPayments)
          .where(inArray(billingPayments.chargeId, chargeIds))
          .orderBy(desc(billingPayments.paidAt))
      : [];

  const paymentsByCharge = new Map<string, BillingPaymentView[]>();
  const channelTotals = new Map<PaymentChannel, { totalCop: number; paymentCount: number }>();
  for (const ch of PAYMENT_CHANNELS) channelTotals.set(ch, { totalCop: 0, paymentCount: 0 });

  for (const p of allPayments) {
    const list = paymentsByCharge.get(p.chargeId) ?? [];
    list.push({
      id: p.id,
      amountCop: p.amountCop,
      channel: p.channel,
      referenceCode: p.referenceCode,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
      paidAt: p.paidAt,
    });
    paymentsByCharge.set(p.chargeId, list);
    const chBucket = channelTotals.get(p.channel);
    if (chBucket) {
      chBucket.totalCop += p.amountCop;
      chBucket.paymentCount += 1;
    }
  }

  const today = todayInBogota();
  const chargesByEnrollment = new Map<string, BillingChargeView[]>();
  const chargeById = new Map<string, { enrollmentId: string; concept: string }>();

  // Acumulado mensual (Matrícula + Feb..Nov)
  const monthBuckets = new Map<number, MonthlyCollectionSummary>(
    BILLING_MONTH_COLUMNS.map((m) => [
      m.month,
      {
        month: m.month,
        shortLabel: m.shortLabel,
        label: m.label,
        billedCop: 0,
        collectedCop: 0,
        pendingCop: 0,
        paidCount: 0,
        overdueCount: 0,
        collectionPercent: 0,
      },
    ]),
  );

  for (const c of allCharges) {
    const netCop = computeNetAmount(c.amountCop, c.discountCop);
    const pendingCop = computePendingAmount(c);
    const status = deriveChargeStatus(c, today);

    const view: BillingChargeView = {
      id: c.id,
      concept: c.concept,
      billingMonth: c.billingMonth,
      amountCop: c.amountCop,
      discountCop: c.discountCop,
      netCop,
      paidCop: c.paidCop,
      pendingCop,
      dueDate: c.dueDate,
      status,
      payments: paymentsByCharge.get(c.id) ?? [],
    };
    const list = chargesByEnrollment.get(c.enrollmentId) ?? [];
    list.push(view);
    chargesByEnrollment.set(c.enrollmentId, list);
    chargeById.set(c.id, { enrollmentId: c.enrollmentId, concept: c.concept });

    const bucket = monthBuckets.get(c.billingMonth);
    if (bucket && status !== "WAIVED") {
      bucket.billedCop += netCop;
      bucket.collectedCop += Math.min(netCop, c.paidCop);
      bucket.pendingCop += pendingCop;
      if (status === "PAID") bucket.paidCount += 1;
      if (status === "OVERDUE") bucket.overdueCount += 1;
    }
  }

  const monthlySummary: MonthlyCollectionSummary[] = BILLING_MONTH_COLUMNS.map((m) => {
    const b = monthBuckets.get(m.month)!;
    return {
      ...b,
      collectionPercent: b.billedCop > 0 ? Math.round((b.collectedCop / b.billedCop) * 100) : 0,
    };
  });

  const channelSummary: ChannelCollectionSummary[] = PAYMENT_CHANNELS.map((ch) => ({
    channel: ch,
    ...(channelTotals.get(ch) ?? { totalCop: 0, paymentCount: 0 }),
  })).sort((a, b) => b.totalCop - a.totalCop);

  const certByEnrollment = new Map(allCerts.map((c) => [c.enrollmentId, c.verificationCode]));
  const studentByEnrollment = new Map(
    roster.map((r) => [
      r.enrollmentId,
      {
        name: `${r.lastName}, ${r.firstName}`,
        documentNumber: r.documentNumber,
        groupName: r.groupName,
        levelCode: r.levelCode,
      },
    ]),
  );

  const accounts: AdminBillingAccountRow[] = roster.map((r) => {
    const charges = chargesByEnrollment.get(r.enrollmentId) ?? [];
    const sum = summarizeAccount(charges, today);
    return {
      enrollmentId: r.enrollmentId,
      studentName: `${r.lastName}, ${r.firstName}`,
      documentNumber: r.documentNumber,
      groupName: r.groupName,
      gradeName: r.gradeName,
      gradeOrder: r.gradeOrder,
      levelCode: r.levelCode,
      ...sum,
      pazYSalvoCode: certByEnrollment.get(r.enrollmentId) ?? null,
      charges,
    };
  });

  const groupMap = new Map<string, CourseGroupOption>();
  for (const a of accounts) {
    const existing = groupMap.get(a.groupName);
    if (!existing) {
      groupMap.set(a.groupName, {
        groupName: a.groupName,
        gradeName: a.gradeName,
        gradeOrder: a.gradeOrder,
        levelCode: a.levelCode,
        studentCount: 1,
        clearCount: a.isClear ? 1 : 0,
        overdueCount: a.overdueCount > 0 ? 1 : 0,
        billedCop: a.totalNetCop,
        collectedCop: a.totalPaidCop,
        pendingCop: a.totalPendingCop,
        collectionPercent: 0,
      });
    } else {
      existing.studentCount += 1;
      if (a.isClear) existing.clearCount += 1;
      if (a.overdueCount > 0) existing.overdueCount += 1;
      existing.billedCop += a.totalNetCop;
      existing.collectedCop += a.totalPaidCop;
      existing.pendingCop += a.totalPendingCop;
    }
  }
  const courseGroups: CourseGroupOption[] = Array.from(groupMap.values()).map((g) => ({
    ...g,
    collectionPercent: g.billedCop > 0 ? Math.round((g.collectedCop / g.billedCop) * 100) : 100,
  }));
  const groupsList = courseGroups.map((g) => g.groupName);

  const ledgerReceipts: LedgerReceiptRow[] = allPayments.map((p) => {
    const ch = chargeById.get(p.chargeId);
    const st = ch ? studentByEnrollment.get(ch.enrollmentId) : undefined;
    return {
      paymentId: p.id,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
      studentName: st?.name ?? "Estudiante",
      documentNumber: st?.documentNumber ?? "",
      groupName: st?.groupName ?? "",
      levelCode: st?.levelCode ?? "PRIMARIA",
      concept: ch?.concept ?? "Cuota escolar",
      channel: p.channel,
      referenceCode: p.referenceCode,
      amountCop: p.amountCop,
    };
  });

  const totalBilledCop = accounts.reduce((s, a) => s + a.totalNetCop, 0);
  const totalCollectedCop = accounts.reduce((s, a) => s + a.totalPaidCop, 0);
  const totalPendingCop = accounts.reduce((s, a) => s + a.totalPendingCop, 0);
  const collectionPercent =
    totalBilledCop > 0 ? Math.round((totalCollectedCop / totalBilledCop) * 100) : 0;

  return {
    totals: {
      totalStudents: accounts.length,
      totalBilledCop,
      totalCollectedCop,
      totalPendingCop,
      collectionPercent,
      clearCount: accounts.filter((a) => a.isClear).length,
      pendingCount: accounts.filter((a) => !a.isClear && a.overdueCount === 0 && a.charges.length > 0).length,
      overdueCount: accounts.filter((a) => a.overdueCount > 0).length,
      hasChargesGenerated: allCharges.length > 0,
    },
    groupsList,
    courseGroups,
    monthlySummary,
    channelSummary,
    accounts,
    ledgerReceipts,
  };
}
