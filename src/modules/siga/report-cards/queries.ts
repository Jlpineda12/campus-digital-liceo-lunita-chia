import "server-only";
import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  academicPeriods,
  academicYears,
  attendanceLogs,
  auditLogs,
  certificates,
  enrollments,
  grades,
  groups,
  levels,
  reportCards,
  users,
} from "@/db/schema";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import { recordAudit } from "@/modules/core/audit/service";
import { computeAttendanceStats, type AttendanceStats } from "@/modules/siga/attendance/meta";
import { weightedAverage } from "@/modules/siga/siee-grades/calculator";
import {
  getScaleForYear,
  getStudentPeriodGrades,
  type StudentSubjectGrades,
} from "@/modules/siga/siee-grades/queries";
import {
  getPerformanceLevel,
  roundScore,
  type PerformanceLevel,
  type SieeScale,
} from "@/modules/siga/siee-grades/scale";
import {
  buildAnnualSummary,
  type AnnualPeriodInput,
  type AnnualSummary,
  type PeriodSubjectFinal,
} from "./annual-summary";
import { renderQrSvg } from "./qr";
import {
  canFamilyViewReportCard,
  isValidVerificationCode,
  maskDocumentNumber,
  maskStudentName,
} from "./verification";

const directorUser = alias(users, "rc_director");

export interface ReportCardDocument {
  enrollmentId: string;
  student: {
    fullName: string;
    documentType: string;
    documentNumber: string;
  };
  group: {
    groupName: string;
    gradeName: string;
    levelCode: LevelCode;
    levelName: string;
    directorName: string | null;
    assessmentMode: "NUMERIC" | "QUALITATIVE" | "MIXED";
  };
  year: { year: number; name: string };
  period: { id: string; number: number; name: string; startDate: string; endDate: string; gradesLocked: boolean };
  scale: SieeScale;
  subjects: StudentSubjectGrades[];
  attendance: AttendanceStats;
  overallAverage: number | null;
  overallLevel: PerformanceLevel | null;
  record: {
    id: string;
    verificationCode: string;
    directorObservations: string | null;
    issuedAt: Date | null;
    isStale: boolean;
  } | null;
  verifyUrl: string | null;
  qrSvg: string | null;
}

/**
 * Ensambla el Boletín Oficial completo de un estudiante en un periodo.
 * Quien llama debe haber verificado `canAccessStudent` (RBAC).
 *
 * Con `requireIssued: true` (obligatorio para `STUDENT` y `GUARDIAN`), devuelve
 * `null` inmediatamente si Rectoría aún no ha habilitado el boletín.
 */
export async function getStudentReportCardDocument(options: {
  enrollmentId: string;
  periodId: string;
  origin: string;
  requireIssued?: boolean;
}): Promise<ReportCardDocument | null> {
  const { enrollmentId, periodId, origin, requireIssued = false } = options;

  const [rc] = await db
    .select({
      id: reportCards.id,
      verificationCode: reportCards.verificationCode,
      directorObservations: reportCards.directorObservations,
      issuedAt: reportCards.issuedAt,
      isStale: reportCards.isStale,
    })
    .from(reportCards)
    .where(and(eq(reportCards.enrollmentId, enrollmentId), eq(reportCards.periodId, periodId)))
    .limit(1);

  if (requireIssued && !canFamilyViewReportCard(rc)) {
    return null;
  }

  const [enr] = await db
    .select({
      enrollmentId: enrollments.id,
      academicYearId: enrollments.academicYearId,
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      levelCode: levels.code,
      levelName: levels.name,
      assessmentMode: grades.assessmentMode,
      directorFirst: directorUser.firstName,
      directorLast: directorUser.lastName,
      studentFirst: users.firstName,
      studentLast: users.lastName,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
      yearNumber: academicYears.year,
      yearName: academicYears.name,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .leftJoin(directorUser, eq(directorUser.id, groups.directorTeacherId))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enr) return null;

  const [period] = await db
    .select({
      id: academicPeriods.id,
      number: academicPeriods.number,
      name: academicPeriods.name,
      startDate: academicPeriods.startDate,
      endDate: academicPeriods.endDate,
      gradesLocked: academicPeriods.gradesLocked,
    })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, periodId), eq(academicPeriods.academicYearId, enr.academicYearId)))
    .limit(1);

  if (!period) return null;

  const scale = await getScaleForYear(enr.academicYearId);
  const [subjects, attRows] = await Promise.all([
    getStudentPeriodGrades({ enrollmentId, groupId: enr.groupId, periodId, scale }),
    db
      .select({
        present: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'PRESENT')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'ABSENT')::int`,
        late: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'LATE')::int`,
        excused: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'EXCUSED')::int`,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.enrollmentId, enrollmentId),
          gte(attendanceLogs.date, period.startDate),
          lte(attendanceLogs.date, period.endDate),
        ),
      ),
  ]);

  const finals = subjects.map((s) => s.result.final).filter((f): f is number => f !== null);
  const rawAvg = weightedAverage(finals.map((value) => ({ value, weight: 1 })));
  const overallAverage = rawAvg === null ? null : roundScore(rawAvg);
  const overallLevel = overallAverage === null ? null : getPerformanceLevel(overallAverage, scale);

  const record = rc ?? null;
  const verifyUrl =
    record?.issuedAt ? `${origin.replace(/\/$/, "")}/verificar/${record.verificationCode}` : null;
  const qrSvg = verifyUrl ? await renderQrSvg(verifyUrl) : null;

  return {
    enrollmentId,
    student: {
      fullName: `${enr.studentFirst} ${enr.studentLast}`,
      documentType: enr.documentType,
      documentNumber: enr.documentNumber,
    },
    group: {
      groupName: enr.groupName,
      gradeName: enr.gradeName,
      levelCode: enr.levelCode,
      levelName: enr.levelName,
      directorName: enr.directorFirst ? `${enr.directorFirst} ${enr.directorLast}` : null,
      assessmentMode: enr.assessmentMode,
    },
    year: { year: enr.yearNumber, name: enr.yearName },
    period,
    scale,
    subjects,
    attendance: computeAttendanceStats(attRows[0] ?? { present: 0, absent: 0, late: 0, excused: 0 }),
    overallAverage,
    overallLevel,
    record,
    verifyUrl,
    qrSvg,
  };
}

/** Periodos en los que Rectoría ya habilitó oficialmente el boletín de un estudiante. */
export async function listIssuedPeriodIdsForStudent(enrollmentId: string): Promise<Set<string>> {
  const rows = await db
    .select({ periodId: reportCards.periodId, issuedAt: reportCards.issuedAt })
    .from(reportCards)
    .where(eq(reportCards.enrollmentId, enrollmentId));
  return new Set(rows.filter((r) => r.issuedAt !== null).map((r) => r.periodId));
}

export interface GroupReportCardRow {
  enrollmentId: string;
  studentName: string;
  verificationCode: string | null;
  averageScore: number | null;
  performanceLevel: PerformanceLevel | null;
  directorObservations: string | null;
  issuedAt: Date | null;
  isStale: boolean;
}

export async function listGroupReportCards(options: {
  groupId: string;
  academicYearId: string;
  periodId: string;
}): Promise<GroupReportCardRow[]> {
  const roster = await db
    .select({
      enrollmentId: enrollments.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        eq(enrollments.groupId, options.groupId),
        eq(enrollments.academicYearId, options.academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  if (roster.length === 0) return [];

  const cards = await db
    .select({
      enrollmentId: reportCards.enrollmentId,
      verificationCode: reportCards.verificationCode,
      averageScore: reportCards.averageScore,
      performanceLevel: reportCards.performanceLevel,
      directorObservations: reportCards.directorObservations,
      issuedAt: reportCards.issuedAt,
      isStale: reportCards.isStale,
    })
    .from(reportCards)
    .where(
      and(
        eq(reportCards.periodId, options.periodId),
        inArray(
          reportCards.enrollmentId,
          roster.map((r) => r.enrollmentId),
        ),
      ),
    );
  const byEnrollment = new Map(cards.map((c) => [c.enrollmentId, c]));

  return roster.map((r) => {
    const c = byEnrollment.get(r.enrollmentId);
    return {
      enrollmentId: r.enrollmentId,
      studentName: `${r.lastName}, ${r.firstName}`,
      verificationCode: c?.verificationCode ?? null,
      averageScore: c?.averageScore ?? null,
      performanceLevel: c?.performanceLevel ?? null,
      directorObservations: c?.directorObservations ?? null,
      issuedAt: c?.issuedAt ?? null,
      isStale: c?.isStale ?? false,
    };
  });
}

/* ---------------------------------------------------------------------------
   Verificador público QR (/verificar/[codigo]) — Ley 1581 + rate-limit por IP
   --------------------------------------------------------------------------- */

const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX_PER_IP = 30;

export type PublicVerificationResult =
  | { status: "invalid_format" }
  | { status: "rate_limited" }
  | { status: "not_found" }
  | {
      status: "valid";
      documentLabel: string;
      yearName: string;
      periodName: string | null;
      gradeName: string;
      groupName: string;
      maskedName: string;
      maskedDocument: string;
      issuedAt: Date;
      isStale: boolean;
      revoked: boolean;
    };

export async function verifyPublicCode(
  code: string,
  ipAddress: string | null,
): Promise<PublicVerificationResult> {
  if (!isValidVerificationCode(code)) return { status: "invalid_format" };

  // Protección contra enumeración por fuerza bruta desde una misma IP.
  if (ipAddress) {
    const since = new Date(Date.now() - VERIFY_WINDOW_MS);
    const [row] = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "VERIFY_QR_LOOKUP"),
          eq(auditLogs.ipAddress, ipAddress),
          gte(auditLogs.createdAt, since),
        ),
      );
    if ((row?.total ?? 0) >= VERIFY_MAX_PER_IP) {
      return { status: "rate_limited" };
    }
    await recordAudit({
      actorUserId: null,
      action: "VERIFY_QR_LOOKUP",
      entityType: "verification_code",
      entityId: code,
      ipAddress,
    });
  }

  const [rc] = await db
    .select({
      issuedAt: reportCards.issuedAt,
      isStale: reportCards.isStale,
      yearName: academicYears.name,
      periodName: academicPeriods.name,
      gradeName: grades.name,
      groupName: groups.name,
      firstName: users.firstName,
      lastName: users.lastName,
      documentNumber: users.documentNumber,
    })
    .from(reportCards)
    .innerJoin(academicPeriods, eq(academicPeriods.id, reportCards.periodId))
    .innerJoin(enrollments, eq(enrollments.id, reportCards.enrollmentId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(eq(reportCards.verificationCode, code))
    .limit(1);

  if (rc && rc.issuedAt) {
    return {
      status: "valid",
      documentLabel: "Boletín Oficial de Valoración (SIEE)",
      yearName: rc.yearName,
      periodName: rc.periodName,
      gradeName: rc.gradeName,
      groupName: rc.groupName,
      maskedName: maskStudentName(rc.firstName, rc.lastName),
      maskedDocument: maskDocumentNumber(rc.documentNumber),
      issuedAt: rc.issuedAt,
      isStale: rc.isStale,
      revoked: false,
    };
  }

  const [cert] = await db
    .select({
      type: certificates.type,
      issuedAt: certificates.issuedAt,
      revokedAt: certificates.revokedAt,
      yearName: academicYears.name,
      gradeName: grades.name,
      groupName: groups.name,
      firstName: users.firstName,
      lastName: users.lastName,
      documentNumber: users.documentNumber,
    })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(eq(certificates.verificationCode, code))
    .limit(1);

  if (cert) {
    const labelMap = {
      CONSTANCIA_ESTUDIO: "Constancia de Estudio",
      CERTIFICADO_NOTAS: "Certificado Oficial de Notas",
      PAZ_Y_SALVO: "Paz y Salvo Institucional",
    } as const;
    return {
      status: "valid",
      documentLabel: labelMap[cert.type],
      yearName: cert.yearName,
      periodName: null,
      gradeName: cert.gradeName,
      groupName: cert.groupName,
      maskedName: maskStudentName(cert.firstName, cert.lastName),
      maskedDocument: maskDocumentNumber(cert.documentNumber),
      issuedAt: cert.issuedAt,
      isStale: false,
      revoked: cert.revokedAt !== null,
    };
  }

  return { status: "not_found" };
}

/**
 * Boletín final del año de un estudiante. Quien llama debe haber verificado
 * `canAccessStudent`. Con `familyView`, solo cuentan los periodos que Rectoría
 * ya habilitó (misma regla de los boletines por periodo).
 */
export async function getStudentAnnualReport(options: {
  enrollmentId: string;
  groupId: string;
  academicYearId: string;
  periods: ReadonlyArray<{ id: string; number: number; name: string; weightPercent: number }>;
  familyView: boolean;
}): Promise<AnnualSummary> {
  const { enrollmentId, groupId, academicYearId, periods, familyView } = options;
  const [scale, issued] = await Promise.all([
    getScaleForYear(academicYearId),
    familyView ? listIssuedPeriodIdsForStudent(enrollmentId) : Promise.resolve(null),
  ]);
  const inputs: AnnualPeriodInput[] = periods.map((p) => ({ ...p, included: issued ? issued.has(p.id) : true }));
  const perPeriodRows = await Promise.all(
    inputs.map(async (p) =>
      p.included ? ([p.id, await getStudentPeriodGrades({ enrollmentId, groupId, periodId: p.id, scale })] as const) : null,
    ),
  );
  const perPeriod = new Map<string, PeriodSubjectFinal[]>();
  for (const entry of perPeriodRows) {
    if (!entry) continue;
    const [periodId, subjects] = entry;
    perPeriod.set(
      periodId,
      subjects.map((s) => ({
        courseAssignmentId: s.courseAssignmentId,
        subjectName: s.subjectName,
        pillar: s.pillar,
        final: s.result.final,
      })),
    );
  }
  return buildAnnualSummary(inputs, perPeriod, scale);
}

/** Lista liviana de estudiantes activos de un grupo (para elegir a quién consultar). */
export async function listGroupRoster(groupId: string, academicYearId: string) {
  const rows = await db
    .select({ enrollmentId: enrollments.id, firstName: users.firstName, lastName: users.lastName })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        eq(enrollments.groupId, groupId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));
  return rows.map((r) => ({ enrollmentId: r.enrollmentId, studentName: `${r.lastName} ${r.firstName}` }));
}
