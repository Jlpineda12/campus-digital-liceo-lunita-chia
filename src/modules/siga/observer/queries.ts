import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  academicPeriods,
  courseAssignments,
  enrollments,
  grades,
  groups,
  observerRecords,
  users,
} from "@/db/schema";
import { can } from "@/modules/core/auth/permissions";
import type { Role } from "@/modules/core/auth/roles";
import type { SessionUser } from "@/modules/core/auth/session";
import type { ObserverCategory } from "./meta";

const studentUser = alias(users, "student_user");
const authorUser = alias(users, "author_user");
const guardianUser = alias(users, "guardian_user");

export const OBSERVER_PAGE_SIZE = 25;

export interface ObserverTimelineEntry {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  groupName: string;
  gradeName: string;
  periodName: string | null;
  category: ObserverCategory;
  title: string;
  description: string;
  authorName: string | null;
  authorRole: Role | null;
  studentStatement: string | null;
  studentStatementAt: Date | null;
  commitment: string | null;
  guardianAcknowledgedAt: Date | null;
  guardianAcknowledgedByName: string | null;
  guardianComment: string | null;
  createdAt: Date;
}

export interface ObserverSummary {
  total: number;
  praise: number;
  pendingGuardian: number;
  pendingStatement: number;
  escalated: number;
}

function mapEntry(row: {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentFirst: string;
  studentLast: string;
  groupName: string;
  gradeName: string;
  periodName: string | null;
  category: ObserverCategory;
  title: string;
  description: string;
  authorFirst: string | null;
  authorLast: string | null;
  authorRole: Role | null;
  studentStatement: string | null;
  studentStatementAt: Date | null;
  commitment: string | null;
  guardianAcknowledgedAt: Date | null;
  guardianFirst: string | null;
  guardianLast: string | null;
  guardianComment: string | null;
  createdAt: Date;
}): ObserverTimelineEntry {
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    studentName: `${row.studentFirst} ${row.studentLast}`,
    groupName: row.groupName,
    gradeName: row.gradeName,
    periodName: row.periodName,
    category: row.category,
    title: row.title,
    description: row.description,
    authorName: row.authorFirst ? `${row.authorFirst} ${row.authorLast}` : null,
    authorRole: row.authorRole,
    studentStatement: row.studentStatement,
    studentStatementAt: row.studentStatementAt,
    commitment: row.commitment,
    guardianAcknowledgedAt: row.guardianAcknowledgedAt,
    guardianAcknowledgedByName: row.guardianFirst ? `${row.guardianFirst} ${row.guardianLast}` : null,
    guardianComment: row.guardianComment,
    createdAt: row.createdAt,
  };
}

/**
 * Grupos a los que un docente tiene acceso en el año vigente (dicta clase o es director).
 */
async function getTeacherGroupIds(teacherId: string, academicYearId: string): Promise<string[]> {
  const [taught, directed] = await Promise.all([
    db
      .selectDistinct({ groupId: courseAssignments.groupId })
      .from(courseAssignments)
      .where(
        and(
          eq(courseAssignments.teacherId, teacherId),
          eq(courseAssignments.academicYearId, academicYearId),
        ),
      ),
    db
      .select({ groupId: groups.id })
      .from(groups)
      .where(and(eq(groups.directorTeacherId, teacherId), eq(groups.academicYearId, academicYearId))),
  ]);
  return [...new Set([...taught.map((r) => r.groupId), ...directed.map((r) => r.groupId)])];
}

/**
 * Anotaciones del observador de un estudiante específico. Quien llama debe
 * haber verificado `canAccessStudent` previamente.
 */
export async function listStudentObserverRecords(options: {
  enrollmentId: string;
  category?: ObserverCategory;
}): Promise<{ entries: ObserverTimelineEntry[]; summary: ObserverSummary }> {
  const allRows = await db
    .select({
      id: observerRecords.id,
      enrollmentId: observerRecords.enrollmentId,
      studentId: enrollments.studentId,
      studentFirst: studentUser.firstName,
      studentLast: studentUser.lastName,
      groupName: groups.name,
      gradeName: grades.name,
      periodName: academicPeriods.name,
      category: observerRecords.category,
      title: observerRecords.title,
      description: observerRecords.description,
      authorFirst: authorUser.firstName,
      authorLast: authorUser.lastName,
      authorRole: authorUser.role,
      studentStatement: observerRecords.studentStatement,
      studentStatementAt: observerRecords.studentStatementAt,
      commitment: observerRecords.commitment,
      guardianAcknowledgedAt: observerRecords.guardianAcknowledgedAt,
      guardianFirst: guardianUser.firstName,
      guardianLast: guardianUser.lastName,
      guardianComment: observerRecords.guardianComment,
      createdAt: observerRecords.createdAt,
    })
    .from(observerRecords)
    .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
    .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .leftJoin(academicPeriods, eq(academicPeriods.id, observerRecords.periodId))
    .leftJoin(authorUser, eq(authorUser.id, observerRecords.authorId))
    .leftJoin(guardianUser, eq(guardianUser.id, observerRecords.guardianAcknowledgedBy))
    .where(eq(observerRecords.enrollmentId, options.enrollmentId))
    .orderBy(desc(observerRecords.createdAt));

  const mapped = allRows.map(mapEntry);
  const summary: ObserverSummary = {
    total: mapped.length,
    praise: mapped.filter((r) => r.category === "PRAISE").length,
    pendingGuardian: mapped.filter((r) => r.guardianAcknowledgedAt === null).length,
    pendingStatement: mapped.filter((r) => r.category !== "PRAISE" && !r.studentStatement).length,
    escalated: mapped.filter((r) => r.category === "TYPE_II" || r.category === "TYPE_III").length,
  };
  const entries = options.category ? mapped.filter((r) => r.category === options.category) : mapped;
  return { entries, summary };
}

export interface StaffObserverResult {
  entries: ObserverTimelineEntry[];
  totalCount: number;
  page: number;
  totalPages: number;
  summary: ObserverSummary;
}

/**
 * Listado paginado en servidor para Docentes (sus grupos) y Coordinación/Admin (todo el colegio).
 */
export async function listObserverForStaff(options: {
  actor: SessionUser;
  academicYearId: string;
  groupId?: string;
  category?: ObserverCategory;
  pendingOnly?: boolean;
  query?: string;
  page?: number;
}): Promise<StaffObserverResult> {
  const { actor, academicYearId, groupId, category, pendingOnly, query } = options;
  const page = Math.max(1, options.page ?? 1);
  const isGlobal = can(actor.role, "observer.review");

  let allowedGroupIds: string[] | null = null;
  if (!isGlobal) {
    if (actor.role !== "TEACHER") {
      return {
        entries: [],
        totalCount: 0,
        page: 1,
        totalPages: 1,
        summary: { total: 0, praise: 0, pendingGuardian: 0, pendingStatement: 0, escalated: 0 },
      };
    }
    allowedGroupIds = await getTeacherGroupIds(actor.id, academicYearId);
    if (allowedGroupIds.length === 0) {
      return {
        entries: [],
        totalCount: 0,
        page: 1,
        totalPages: 1,
        summary: { total: 0, praise: 0, pendingGuardian: 0, pendingStatement: 0, escalated: 0 },
      };
    }
  }

  const baseConditions = [eq(enrollments.academicYearId, academicYearId)];
  if (allowedGroupIds) {
    baseConditions.push(inArray(enrollments.groupId, allowedGroupIds));
  }

  const filterConditions = [...baseConditions];
  if (groupId) {
    if (allowedGroupIds && !allowedGroupIds.includes(groupId)) {
      return {
        entries: [],
        totalCount: 0,
        page: 1,
        totalPages: 1,
        summary: { total: 0, praise: 0, pendingGuardian: 0, pendingStatement: 0, escalated: 0 },
      };
    }
    filterConditions.push(eq(enrollments.groupId, groupId));
  }
  if (category) filterConditions.push(eq(observerRecords.category, category));
  if (pendingOnly) filterConditions.push(isNull(observerRecords.guardianAcknowledgedAt));
  if (query && query.trim().length > 0) {
    const pattern = `%${query.trim()}%`;
    filterConditions.push(
      or(
        ilike(studentUser.firstName, pattern),
        ilike(studentUser.lastName, pattern),
        ilike(observerRecords.title, pattern),
      )!,
    );
  }

  const baseWhere = and(...baseConditions);
  const filteredWhere = and(...filterConditions);

  const [summaryRow, countRow, pageRows] = await Promise.all([
    db
      .select({
        total: count(),
        praise: sql<number>`count(*) filter (where ${observerRecords.category} = 'PRAISE')::int`,
        pendingGuardian: sql<number>`count(*) filter (where ${observerRecords.guardianAcknowledgedAt} is null)::int`,
        pendingStatement: sql<number>`count(*) filter (where ${observerRecords.category} <> 'PRAISE' and ${observerRecords.studentStatement} is null)::int`,
        escalated: sql<number>`count(*) filter (where ${observerRecords.category} in ('TYPE_II', 'TYPE_III'))::int`,
      })
      .from(observerRecords)
      .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
      .where(baseWhere),
    db
      .select({ total: count() })
      .from(observerRecords)
      .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
      .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
      .where(filteredWhere),
    db
      .select({
        id: observerRecords.id,
        enrollmentId: observerRecords.enrollmentId,
        studentId: enrollments.studentId,
        studentFirst: studentUser.firstName,
        studentLast: studentUser.lastName,
        groupName: groups.name,
        gradeName: grades.name,
        periodName: academicPeriods.name,
        category: observerRecords.category,
        title: observerRecords.title,
        description: observerRecords.description,
        authorFirst: authorUser.firstName,
        authorLast: authorUser.lastName,
        authorRole: authorUser.role,
        studentStatement: observerRecords.studentStatement,
        studentStatementAt: observerRecords.studentStatementAt,
        commitment: observerRecords.commitment,
        guardianAcknowledgedAt: observerRecords.guardianAcknowledgedAt,
        guardianFirst: guardianUser.firstName,
        guardianLast: guardianUser.lastName,
        guardianComment: observerRecords.guardianComment,
        createdAt: observerRecords.createdAt,
      })
      .from(observerRecords)
      .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
      .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(academicPeriods, eq(academicPeriods.id, observerRecords.periodId))
      .leftJoin(authorUser, eq(authorUser.id, observerRecords.authorId))
      .leftJoin(guardianUser, eq(guardianUser.id, observerRecords.guardianAcknowledgedBy))
      .where(filteredWhere)
      .orderBy(desc(observerRecords.createdAt))
      .limit(OBSERVER_PAGE_SIZE)
      .offset((page - 1) * OBSERVER_PAGE_SIZE),
  ]);

  const totalCount = countRow[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / OBSERVER_PAGE_SIZE));
  const summary: ObserverSummary = {
    total: summaryRow[0]?.total ?? 0,
    praise: summaryRow[0]?.praise ?? 0,
    pendingGuardian: summaryRow[0]?.pendingGuardian ?? 0,
    pendingStatement: summaryRow[0]?.pendingStatement ?? 0,
    escalated: summaryRow[0]?.escalated ?? 0,
  };

  return {
    entries: pageRows.map(mapEntry),
    totalCount,
    page: Math.min(page, totalPages),
    totalPages,
    summary,
  };
}

export interface ObserverCandidateGroup {
  groupId: string;
  groupName: string;
  gradeName: string;
  students: Array<{ enrollmentId: string; fullName: string }>;
}

/** Grupos y estudiantes elegibles para crear anotaciones según el alcance del actor. */
export async function listObserverCandidates(
  actor: SessionUser,
  academicYearId: string,
): Promise<ObserverCandidateGroup[]> {
  if (!can(actor.role, "observer.create")) return [];

  let allowedGroupIds: string[] | null = null;
  if (!can(actor.role, "observer.review")) {
    allowedGroupIds = await getTeacherGroupIds(actor.id, academicYearId);
    if (allowedGroupIds.length === 0) return [];
  }

  const groupConditions = [eq(groups.academicYearId, academicYearId)];
  if (allowedGroupIds) groupConditions.push(inArray(groups.id, allowedGroupIds));

  const groupRows = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      gradeOrder: grades.displayOrder,
    })
    .from(groups)
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .where(and(...groupConditions))
    .orderBy(asc(grades.displayOrder), asc(groups.name));

  if (groupRows.length === 0) return [];

  const rosterRows = await db
    .select({
      enrollmentId: enrollments.id,
      groupId: enrollments.groupId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, "ACTIVE"),
        inArray(
          enrollments.groupId,
          groupRows.map((g) => g.groupId),
        ),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  const byGroup = new Map<string, Array<{ enrollmentId: string; fullName: string }>>();
  for (const r of rosterRows) {
    const list = byGroup.get(r.groupId) ?? [];
    list.push({ enrollmentId: r.enrollmentId, fullName: `${r.lastName}, ${r.firstName}` });
    byGroup.set(r.groupId, list);
  }

  return groupRows.map((g) => ({
    groupId: g.groupId,
    groupName: g.groupName,
    gradeName: g.gradeName,
    students: byGroup.get(g.groupId) ?? [],
  }));
}
