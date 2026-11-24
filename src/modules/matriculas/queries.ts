import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears,
  admissionApplications,
  enrollmentDocuments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  users,
} from "@/db/schema";
import type { AdmissionDocStatus, AdmissionStatus, PaymentChannel } from "@/db/schema/matriculas";
import type { DocumentType, LevelCode } from "@/modules/core/academic-structure/constants";
import { normalizeDocumentNumber } from "@/modules/core/users/schemas";
import { ADMISSION_DOCUMENTS, type EnrollmentType } from "./catalog";

export interface PublicGradeOption {
  id: string;
  name: string;
  levelCode: LevelCode;
  levelName: string;
  displayOrder: number;
}

export interface AdmissionDocView {
  id: string;
  docKey: string;
  label: string;
  description: string;
  required: boolean;
  status: AdmissionDocStatus;
  hasFile: boolean;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  reviewNote: string;
  uploadedAt: Date | null;
}

export interface AdmissionApplicationDetail {
  id: string;
  trackingCode: string;
  targetYear: number;
  applicationType: EnrollmentType;
  status: AdmissionStatus;
  targetGradeId: string;
  targetGradeName: string;
  targetLevelCode: LevelCode;
  studentFirstName: string;
  studentLastName: string;
  studentDocType: DocumentType;
  studentDocNumber: string;
  studentBirthDate: string | null;
  studentEps: string;
  studentBloodType: string;
  previousSchool: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianDocType: DocumentType;
  guardianDocNumber: string;
  guardianEmail: string;
  guardianPhone: string;
  address: string;
  hasSiblingDiscount: boolean;
  hasEarlyBirdDiscount: boolean;
  estimatedEnrollmentCop: number;
  estimatedMonthlyCop: number;
  habeasDataAcceptedAt: Date;
  paymentChannel: PaymentChannel | null;
  paymentReference: string | null;
  hasPaymentReceipt: boolean;
  reviewNotes: string;
  assignedGroupId: string | null;
  formalizedAt: Date | null;
  createdAt: Date;
  documents: AdmissionDocView[];
}

export interface RenewalChildCandidate {
  studentId: string;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  currentGradeName: string | null;
  suggestedNextGradeId: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianDocType: DocumentType;
  guardianDocNumber: string;
  guardianEmail: string;
  guardianPhone: string;
}

export interface AvailableGroupOption {
  id: string;
  gradeId: string;
  name: string;
  gradeName: string;
  capacity: number;
  enrolledCount: number;
}

export async function listPublicGradesForAdmission(): Promise<PublicGradeOption[]> {
  return db
    .select({
      id: grades.id,
      name: grades.name,
      levelCode: levels.code,
      levelName: levels.name,
      displayOrder: grades.displayOrder,
    })
    .from(grades)
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .orderBy(asc(grades.displayOrder));
}

function hydrateDocuments(
  rawDocs: Array<typeof enrollmentDocuments.$inferSelect>,
  levelCode: LevelCode,
): AdmissionDocView[] {
  const byKey = new Map(rawDocs.map((d) => [d.docKey, d]));
  return ADMISSION_DOCUMENTS.map((spec) => {
    const row = byKey.get(spec.key);
    return {
      id: row?.id ?? spec.key,
      docKey: spec.key,
      label: spec.label,
      description: spec.description,
      required: spec.requiredFor.includes(levelCode),
      status: row?.status ?? "PENDING",
      hasFile: Boolean(row?.storageKey),
      originalFileName: row?.originalFileName ?? null,
      fileSizeBytes: row?.fileSizeBytes ?? null,
      reviewNote: row?.reviewNote ?? "",
      uploadedAt: row?.uploadedAt ?? null,
    };
  });
}

/**
 * Consulta segura de solicitud por código de radicado + documento del acudiente
 * (Ley 1581: ambos deben coincidir para evitar enumeración de menores).
 */
export async function lookupPublicApplication(
  trackingCode: string,
  guardianDocNumber: string,
): Promise<AdmissionApplicationDetail | null> {
  const cleanCode = trackingCode.trim().toUpperCase();
  const cleanDoc = normalizeDocumentNumber(guardianDocNumber);
  if (!cleanCode || cleanDoc.length < 5) return null;

  const [row] = await db
    .select({
      app: admissionApplications,
      gradeName: grades.name,
      levelCode: levels.code,
    })
    .from(admissionApplications)
    .innerJoin(grades, eq(grades.id, admissionApplications.targetGradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(
      and(
        eq(admissionApplications.trackingCode, cleanCode),
        eq(admissionApplications.guardianDocNumber, cleanDoc),
      ),
    )
    .limit(1);

  if (!row) return null;

  const docs = await db
    .select()
    .from(enrollmentDocuments)
    .where(eq(enrollmentDocuments.applicationId, row.app.id));

  return {
    id: row.app.id,
    trackingCode: row.app.trackingCode,
    targetYear: row.app.targetYear,
    applicationType: row.app.applicationType,
    status: row.app.status,
    targetGradeId: row.app.targetGradeId,
    targetGradeName: row.gradeName,
    targetLevelCode: row.levelCode,
    studentFirstName: row.app.studentFirstName,
    studentLastName: row.app.studentLastName,
    studentDocType: row.app.studentDocType,
    studentDocNumber: row.app.studentDocNumber,
    studentBirthDate: row.app.studentBirthDate,
    studentEps: row.app.studentEps,
    studentBloodType: row.app.studentBloodType,
    previousSchool: row.app.previousSchool,
    guardianFirstName: row.app.guardianFirstName,
    guardianLastName: row.app.guardianLastName,
    guardianDocType: row.app.guardianDocType,
    guardianDocNumber: row.app.guardianDocNumber,
    guardianEmail: row.app.guardianEmail,
    guardianPhone: row.app.guardianPhone,
    address: row.app.address,
    hasSiblingDiscount: row.app.hasSiblingDiscount,
    hasEarlyBirdDiscount: row.app.hasEarlyBirdDiscount,
    estimatedEnrollmentCop: row.app.estimatedEnrollmentCop,
    estimatedMonthlyCop: row.app.estimatedMonthlyCop,
    habeasDataAcceptedAt: row.app.habeasDataAcceptedAt,
    paymentChannel: row.app.paymentChannel,
    paymentReference: row.app.paymentReference,
    hasPaymentReceipt: Boolean(row.app.paymentReceiptKey),
    reviewNotes: row.app.reviewNotes,
    assignedGroupId: row.app.assignedGroupId,
    formalizedAt: row.app.formalizedAt,
    createdAt: row.app.createdAt,
    documents: hydrateDocuments(docs, row.levelCode),
  };
}

/** Precarga hijos de un acudiente autenticado para Renovación rápida en `/matriculas`. */
export async function listGuardianRenewalCandidates(
  guardianId: string,
): Promise<RenewalChildCandidate[]> {
  const [guardian] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, guardianId))
    .limit(1);
  if (!guardian) return [];

  const [allGrades, currentYear] = await Promise.all([
    db
      .select({ id: grades.id, name: grades.name, displayOrder: grades.displayOrder })
      .from(grades)
      .orderBy(asc(grades.displayOrder)),
    db.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1),
  ]);

  const linked = await db
    .select({
      studentId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      gradeName: grades.name,
      gradeOrder: grades.displayOrder,
    })
    .from(guardianLinks)
    .innerJoin(users, eq(users.id, guardianLinks.studentId))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.studentId, users.id),
        currentYear[0] ? eq(enrollments.academicYearId, currentYear[0].id) : sql`true`,
        eq(enrollments.status, "ACTIVE"),
      ),
    )
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .leftJoin(grades, eq(grades.id, groups.gradeId))
    .where(eq(guardianLinks.guardianId, guardianId));

  return linked.map((c) => {
    const nextGrade =
      c.gradeOrder !== null ? allGrades.find((g) => g.displayOrder === c.gradeOrder! + 1) : null;
    return {
      studentId: c.studentId,
      firstName: c.firstName,
      lastName: c.lastName,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      currentGradeName: c.gradeName,
      suggestedNextGradeId: nextGrade?.id ?? allGrades[0]?.id ?? null,
      guardianFirstName: guardian.firstName,
      guardianLastName: guardian.lastName,
      guardianDocType: guardian.documentType,
      guardianDocNumber: guardian.documentNumber,
      guardianEmail: guardian.email ?? "",
      guardianPhone: guardian.phone ?? "",
    };
  });
}

/** Bandeja institucional de solicitudes y cupos por grupo para `/admin/matriculas`. */
export async function listStaffAdmissionsData(statusFilter?: AdmissionStatus) {
  const [allApps, countByStatusRows, currentYear] = await Promise.all([
    db
      .select({
        app: admissionApplications,
        gradeName: grades.name,
        levelCode: levels.code,
      })
      .from(admissionApplications)
      .innerJoin(grades, eq(grades.id, admissionApplications.targetGradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(statusFilter ? eq(admissionApplications.status, statusFilter) : undefined)
      .orderBy(desc(admissionApplications.createdAt))
      .limit(100),
    db
      .select({
        status: admissionApplications.status,
        total: sql<number>`count(*)::int`,
      })
      .from(admissionApplications)
      .groupBy(admissionApplications.status),
    db.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1),
  ]);

  const appIds = allApps.map((r) => r.app.id);
  const [docs, groupRows] = await Promise.all([
    appIds.length > 0
      ? db.select().from(enrollmentDocuments).where(inArray(enrollmentDocuments.applicationId, appIds))
      : Promise.resolve([]),
    currentYear[0]
      ? db
          .select({
            id: groups.id,
            gradeId: groups.gradeId,
            name: groups.name,
            gradeName: grades.name,
            capacity: groups.capacity,
            enrolledCount: sql<number>`count(${enrollments.id})::int`,
          })
          .from(groups)
          .innerJoin(grades, eq(grades.id, groups.gradeId))
          .leftJoin(
            enrollments,
            and(eq(enrollments.groupId, groups.id), eq(enrollments.status, "ACTIVE")),
          )
          .where(eq(groups.academicYearId, currentYear[0].id))
          .groupBy(groups.id, grades.id)
          .orderBy(asc(grades.displayOrder), asc(groups.name))
      : Promise.resolve([]),
  ]);

  const docsByApp = new Map<string, Array<typeof enrollmentDocuments.$inferSelect>>();
  for (const d of docs) {
    const list = docsByApp.get(d.applicationId) ?? [];
    list.push(d);
    docsByApp.set(d.applicationId, list);
  }

  const counts: Record<AdmissionStatus, number> = {
    SUBMITTED: 0,
    DOCS_REVIEW: 0,
    ACADEMIC_APPROVED: 0,
    PAYMENT_REVIEW: 0,
    ENROLLED: 0,
    REJECTED: 0,
  };
  for (const row of countByStatusRows) {
    counts[row.status] = row.total;
  }

  const applications: AdmissionApplicationDetail[] = allApps.map(({ app, gradeName, levelCode }) => ({
    id: app.id,
    trackingCode: app.trackingCode,
    targetYear: app.targetYear,
    applicationType: app.applicationType,
    status: app.status,
    targetGradeId: app.targetGradeId,
    targetGradeName: gradeName,
    targetLevelCode: levelCode,
    studentFirstName: app.studentFirstName,
    studentLastName: app.studentLastName,
    studentDocType: app.studentDocType,
    studentDocNumber: app.studentDocNumber,
    studentBirthDate: app.studentBirthDate,
    studentEps: app.studentEps,
    studentBloodType: app.studentBloodType,
    previousSchool: app.previousSchool,
    guardianFirstName: app.guardianFirstName,
    guardianLastName: app.guardianLastName,
    guardianDocType: app.guardianDocType,
    guardianDocNumber: app.guardianDocNumber,
    guardianEmail: app.guardianEmail,
    guardianPhone: app.guardianPhone,
    address: app.address,
    hasSiblingDiscount: app.hasSiblingDiscount,
    hasEarlyBirdDiscount: app.hasEarlyBirdDiscount,
    estimatedEnrollmentCop: app.estimatedEnrollmentCop,
    estimatedMonthlyCop: app.estimatedMonthlyCop,
    habeasDataAcceptedAt: app.habeasDataAcceptedAt,
    paymentChannel: app.paymentChannel,
    paymentReference: app.paymentReference,
    hasPaymentReceipt: Boolean(app.paymentReceiptKey),
    reviewNotes: app.reviewNotes,
    assignedGroupId: app.assignedGroupId,
    formalizedAt: app.formalizedAt,
    createdAt: app.createdAt,
    documents: hydrateDocuments(docsByApp.get(app.id) ?? [], levelCode),
  }));

  return {
    counts,
    totalCount: Object.values(counts).reduce((a, b) => a + b, 0),
    applications,
    groups: groupRows as AvailableGroupOption[],
  };
}
