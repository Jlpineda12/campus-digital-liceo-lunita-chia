import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  billingCharges,
  billingPayments,
  courseAssignments,
  courseUnits,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  migrationBatches,
  quizQuestions,
  studentGrades,
  subjects,
  users,
} from "@/db/schema";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import type { MigrationSourceKind } from "@/db/schema/migration";

export interface ReconciliationGroupRow {
  groupId: string;
  groupName: string;
  gradeName: string;
  levelCode: LevelCode;
  activeStudents: number;
  courseAssignmentsCount: number;
}

export interface MigrationBatchItem {
  id: string;
  sourceKind: MigrationSourceKind;
  fileName: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  actorName: string;
  createdAt: Date;
}

export interface AvailableQuizTarget {
  activityId: string;
  title: string;
  subjectName: string;
  groupName: string;
  questionCount: number;
}

export interface SimatStudentRow {
  enrollmentId: string;
  documentType: string;
  documentNumber: string;
  lastName: string;
  firstName: string;
  email: string;
  levelCode: LevelCode;
  gradeName: string;
  groupName: string;
  status: string;
  guardianName: string;
  guardianDocument: string;
  guardianPhone: string;
}

/**
 * Carga el panel de Fase 5 (/admin/migracion):
 * - Acta de Conciliación de Datos en tiempo real
 * - Bitácora de lotes migrados
 * - Cuestionarios disponibles para recibir bancos Moodle XML
 * - Grupos activos para filtrar la exportación oficial SIMAT
 */
export async function getMigrationHubData(academicYearId: string) {
  const [
    groupRows,
    studentCountsByGroup,
    courseCountsByGroup,
    teacherCountRow,
    guardianLinksRow,
    gradesCountRow,
    chargesCountRow,
    paymentsCountRow,
    quizRows,
    batchRows,
  ] = await Promise.all([
    db
      .select({
        groupId: groups.id,
        groupName: groups.name,
        gradeName: grades.name,
        gradeOrder: grades.displayOrder,
        levelCode: levels.code,
      })
      .from(groups)
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(eq(groups.academicYearId, academicYearId))
      .orderBy(asc(grades.displayOrder), asc(groups.name)),
    db
      .select({
        groupId: enrollments.groupId,
        total: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(and(eq(enrollments.academicYearId, academicYearId), eq(enrollments.status, "ACTIVE")))
      .groupBy(enrollments.groupId),
    db
      .select({
        groupId: courseAssignments.groupId,
        total: sql<number>`count(*)::int`,
      })
      .from(courseAssignments)
      .where(eq(courseAssignments.academicYearId, academicYearId))
      .groupBy(courseAssignments.groupId),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "TEACHER"), eq(users.isActive, true))),
    db.select({ total: sql<number>`count(*)::int` }).from(guardianLinks),
    db.select({ total: sql<number>`count(*)::int` }).from(studentGrades),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(billingCharges)
      .where(eq(billingCharges.academicYearId, academicYearId)),
    db.select({ total: sql<number>`count(*)::int` }).from(billingPayments),
    db
      .select({
        activityId: activities.id,
        title: activities.title,
        subjectName: subjects.name,
        groupName: groups.name,
        questionCount: sql<number>`count(${quizQuestions.id})::int`,
      })
      .from(activities)
      .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
      .innerJoin(courseAssignments, eq(courseAssignments.id, courseUnits.courseAssignmentId))
      .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
      .leftJoin(quizQuestions, eq(quizQuestions.activityId, activities.id))
      .where(and(eq(activities.type, "QUIZ"), eq(courseAssignments.academicYearId, academicYearId)))
      .groupBy(activities.id, subjects.name, groups.name)
      .orderBy(asc(groups.name), asc(subjects.name), asc(activities.title)),
    db
      .select({
        id: migrationBatches.id,
        sourceKind: migrationBatches.sourceKind,
        fileName: migrationBatches.fileName,
        totalRows: migrationBatches.totalRows,
        createdCount: migrationBatches.createdCount,
        updatedCount: migrationBatches.updatedCount,
        skippedCount: migrationBatches.skippedCount,
        errorCount: migrationBatches.errorCount,
        createdAt: migrationBatches.createdAt,
        actorFirst: users.firstName,
        actorLast: users.lastName,
      })
      .from(migrationBatches)
      .leftJoin(users, eq(users.id, migrationBatches.executedBy))
      .where(eq(migrationBatches.academicYearId, academicYearId))
      .orderBy(desc(migrationBatches.createdAt))
      .limit(20),
  ]);

  const studentsByGroup = new Map(studentCountsByGroup.map((r) => [r.groupId, r.total]));
  const coursesByGroup = new Map(courseCountsByGroup.map((r) => [r.groupId, r.total]));

  const reconciliationGroups: ReconciliationGroupRow[] = groupRows.map((g) => ({
    groupId: g.groupId,
    groupName: g.groupName,
    gradeName: g.gradeName,
    levelCode: g.levelCode,
    activeStudents: studentsByGroup.get(g.groupId) ?? 0,
    courseAssignmentsCount: coursesByGroup.get(g.groupId) ?? 0,
  }));

  const totalActiveStudents = reconciliationGroups.reduce((s, g) => s + g.activeStudents, 0);
  const totalCourseAssignments = reconciliationGroups.reduce((s, g) => s + g.courseAssignmentsCount, 0);

  return {
    reconciliation: {
      totalActiveStudents,
      totalActiveTeachers: teacherCountRow[0]?.total ?? 0,
      totalGuardianLinks: guardianLinksRow[0]?.total ?? 0,
      totalCourseAssignments,
      totalGradesRecorded: gradesCountRow[0]?.total ?? 0,
      totalBillingCharges: chargesCountRow[0]?.total ?? 0,
      totalBillingPayments: paymentsCountRow[0]?.total ?? 0,
      totalQuizzes: quizRows.length,
      totalQuizQuestions: quizRows.reduce((s, q) => s + q.questionCount, 0),
      groups: reconciliationGroups,
    },
    availableQuizzes: quizRows as AvailableQuizTarget[],
    batches: batchRows.map((b) => ({
      id: b.id,
      sourceKind: b.sourceKind,
      fileName: b.fileName,
      totalRows: b.totalRows,
      createdCount: b.createdCount,
      updatedCount: b.updatedCount,
      skippedCount: b.skippedCount,
      errorCount: b.errorCount,
      actorName: b.actorFirst ? `${b.actorFirst} ${b.actorLast}` : "Administración",
      createdAt: b.createdAt,
    })) as MigrationBatchItem[],
  };
}

/** Obtiene las filas oficiales de matrícula para exportación SIMAT (MEN Colombia). */
export async function getSimatExportRows(
  academicYearId: string,
  filters?: { levelCode?: LevelCode | null; groupName?: string | null },
): Promise<SimatStudentRow[]> {
  const [studentRows, links] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.id,
        studentId: users.id,
        documentType: users.documentType,
        documentNumber: users.documentNumber,
        lastName: users.lastName,
        firstName: users.firstName,
        email: users.email,
        levelCode: levels.code,
        gradeName: grades.name,
        groupName: groups.name,
        status: enrollments.status,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(and(eq(enrollments.academicYearId, academicYearId), eq(enrollments.status, "ACTIVE")))
      .orderBy(asc(grades.displayOrder), asc(groups.name), asc(users.lastName), asc(users.firstName)),
    db
      .select({
        studentId: guardianLinks.studentId,
        isFinancialResponsible: guardianLinks.isFinancialResponsible,
        firstName: users.firstName,
        lastName: users.lastName,
        documentNumber: users.documentNumber,
        phone: users.phone,
      })
      .from(guardianLinks)
      .innerJoin(users, eq(users.id, guardianLinks.guardianId)),
  ]);

  const primaryGuardianByStudent = new Map<
    string,
    { name: string; documentNumber: string; phone: string; isFin: boolean }
  >();
  for (const l of links) {
    const existing = primaryGuardianByStudent.get(l.studentId);
    if (!existing || (l.isFinancialResponsible && !existing.isFin)) {
      primaryGuardianByStudent.set(l.studentId, {
        name: `${l.firstName} ${l.lastName}`,
        documentNumber: l.documentNumber,
        phone: l.phone ?? "",
        isFin: l.isFinancialResponsible,
      });
    }
  }

  return studentRows
    .filter((r) => {
      if (filters?.levelCode && r.levelCode !== filters.levelCode) return false;
      if (filters?.groupName && r.groupName !== filters.groupName) return false;
      return true;
    })
    .map((r) => {
      const g = primaryGuardianByStudent.get(r.studentId);
      return {
        enrollmentId: r.enrollmentId,
        documentType: r.documentType,
        documentNumber: r.documentNumber,
        lastName: r.lastName,
        firstName: r.firstName,
        email: r.email ?? "",
        levelCode: r.levelCode,
        gradeName: r.gradeName,
        groupName: r.groupName,
        status: r.status,
        guardianName: g?.name ?? "",
        guardianDocument: g?.documentNumber ?? "",
        guardianPhone: g?.phone ?? "",
      };
    });
}
