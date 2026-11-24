import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  attendanceExcuses,
  attendanceLogs,
  courseAssignments,
  enrollments,
  grades,
  groups,
  subjects,
  users,
} from "@/db/schema";
import {
  computeAttendanceStats,
  type AttendanceStats,
  type AttendanceStatus,
  type ExcuseStatus,
} from "./meta";

const studentUser = alias(users, "att_student");
const guardianUser = alias(users, "att_guardian");
const reviewerUser = alias(users, "att_reviewer");

export interface RollCallStudent {
  enrollmentId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
  notes: string;
  /** True si ya existía un registro guardado para esta clase y fecha. */
  recorded: boolean;
  /** True si Coordinación aprobó una excusa que cubre esta fecha. */
  hasApprovedExcuse: boolean;
}

export interface RollCallSheet {
  date: string;
  alreadySavedCount: number;
  students: RollCallStudent[];
}

/**
 * Hoja de llamado a lista de un curso en una fecha. Por defecto marca Presente
 * a todos, salvo que exista registro guardado o excusa aprobada por Coordinación.
 */
export async function getAttendanceRollSheet(options: {
  courseAssignmentId: string;
  groupId: string;
  academicYearId: string;
  date: string;
}): Promise<RollCallSheet> {
  const { courseAssignmentId, groupId, academicYearId, date } = options;

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
        eq(enrollments.groupId, groupId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(users.lastName), asc(users.firstName));

  if (roster.length === 0) {
    return { date, alreadySavedCount: 0, students: [] };
  }

  const enrollmentIds = roster.map((r) => r.enrollmentId);
  const [logs, approvedExcuses] = await Promise.all([
    db
      .select({
        enrollmentId: attendanceLogs.enrollmentId,
        status: attendanceLogs.status,
        notes: attendanceLogs.notes,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.courseAssignmentId, courseAssignmentId),
          eq(attendanceLogs.date, date),
          inArray(attendanceLogs.enrollmentId, enrollmentIds),
        ),
      ),
    db
      .select({ enrollmentId: attendanceExcuses.enrollmentId })
      .from(attendanceExcuses)
      .where(
        and(
          inArray(attendanceExcuses.enrollmentId, enrollmentIds),
          eq(attendanceExcuses.status, "APPROVED"),
          lte(attendanceExcuses.fromDate, date),
          gte(attendanceExcuses.toDate, date),
        ),
      ),
  ]);

  const logByEnrollment = new Map(logs.map((l) => [l.enrollmentId, l]));
  const excusedSet = new Set(approvedExcuses.map((e) => e.enrollmentId));

  return {
    date,
    alreadySavedCount: logs.length,
    students: roster.map((r) => {
      const existing = logByEnrollment.get(r.enrollmentId);
      const hasApprovedExcuse = excusedSet.has(r.enrollmentId);
      const status: AttendanceStatus = existing
        ? existing.status
        : hasApprovedExcuse
          ? "EXCUSED"
          : "PRESENT";
      return {
        enrollmentId: r.enrollmentId,
        firstName: r.firstName,
        lastName: r.lastName,
        status,
        notes: existing?.notes ?? "",
        recorded: Boolean(existing),
        hasApprovedExcuse,
      };
    }),
  };
}

export interface StudentAttendanceLogItem {
  id: string;
  date: string;
  status: AttendanceStatus;
  subjectName: string | null;
  notes: string | null;
}

export interface StudentExcuseItem {
  id: string;
  fromDate: string;
  toDate: string;
  reasonType: string;
  description: string | null;
  status: ExcuseStatus;
  reviewNotes: string | null;
  reviewerName: string | null;
  createdAt: Date;
}

/** Resumen SQL + historial reciente y excusas de un estudiante (RBAC validado por el caller). */
export async function getStudentAttendanceOverview(enrollmentId: string): Promise<{
  stats: AttendanceStats;
  logs: StudentAttendanceLogItem[];
  excuses: StudentExcuseItem[];
}> {
  const [aggRows, logRows, excuseRows] = await Promise.all([
    db
      .select({
        present: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'PRESENT')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'ABSENT')::int`,
        late: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'LATE')::int`,
        excused: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'EXCUSED')::int`,
      })
      .from(attendanceLogs)
      .where(eq(attendanceLogs.enrollmentId, enrollmentId)),
    db
      .select({
        id: attendanceLogs.id,
        date: attendanceLogs.date,
        status: attendanceLogs.status,
        notes: attendanceLogs.notes,
        subjectName: subjects.name,
      })
      .from(attendanceLogs)
      .leftJoin(courseAssignments, eq(courseAssignments.id, attendanceLogs.courseAssignmentId))
      .leftJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .where(eq(attendanceLogs.enrollmentId, enrollmentId))
      .orderBy(desc(attendanceLogs.date), desc(attendanceLogs.updatedAt))
      .limit(40),
    db
      .select({
        id: attendanceExcuses.id,
        fromDate: attendanceExcuses.fromDate,
        toDate: attendanceExcuses.toDate,
        reasonType: attendanceExcuses.reasonType,
        description: attendanceExcuses.description,
        status: attendanceExcuses.status,
        reviewNotes: attendanceExcuses.reviewNotes,
        reviewerFirst: reviewerUser.firstName,
        reviewerLast: reviewerUser.lastName,
        createdAt: attendanceExcuses.createdAt,
      })
      .from(attendanceExcuses)
      .leftJoin(reviewerUser, eq(reviewerUser.id, attendanceExcuses.reviewedBy))
      .where(eq(attendanceExcuses.enrollmentId, enrollmentId))
      .orderBy(desc(attendanceExcuses.createdAt))
      .limit(20),
  ]);

  const agg = aggRows[0] ?? { present: 0, absent: 0, late: 0, excused: 0 };
  return {
    stats: computeAttendanceStats(agg),
    logs: logRows,
    excuses: excuseRows.map((e) => ({
      id: e.id,
      fromDate: e.fromDate,
      toDate: e.toDate,
      reasonType: e.reasonType,
      description: e.description,
      status: e.status,
      reviewNotes: e.reviewNotes,
      reviewerName: e.reviewerFirst ? `${e.reviewerFirst} ${e.reviewerLast}` : null,
      createdAt: e.createdAt,
    })),
  };
}

export interface StaffExcuseReviewItem {
  id: string;
  studentName: string;
  groupName: string;
  gradeName: string;
  guardianName: string | null;
  fromDate: string;
  toDate: string;
  reasonType: string;
  description: string | null;
  status: ExcuseStatus;
  reviewNotes: string | null;
  reviewerName: string | null;
  createdAt: Date;
}

export interface DailyIncidentItem {
  id: string;
  studentName: string;
  groupName: string;
  subjectName: string | null;
  status: AttendanceStatus;
  notes: string | null;
}

/**
 * Tablero diario institucional (Coordinación / Secretaría) diseñado con agregación
 * SQL directa para escalar sin fricción a 1.000+ estudiantes.
 */
export async function getStaffAttendanceDashboard(options: {
  academicYearId: string;
  date: string;
  excuseStatus?: ExcuseStatus;
}): Promise<{
  dailyStats: AttendanceStats;
  pendingExcusesCount: number;
  excuses: StaffExcuseReviewItem[];
  incidents: DailyIncidentItem[];
}> {
  const { academicYearId, date, excuseStatus } = options;

  const excuseWhere = excuseStatus
    ? and(eq(enrollments.academicYearId, academicYearId), eq(attendanceExcuses.status, excuseStatus))
    : eq(enrollments.academicYearId, academicYearId);

  const [aggRows, pendingRows, excuseRows, incidentRows] = await Promise.all([
    db
      .select({
        present: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'PRESENT')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'ABSENT')::int`,
        late: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'LATE')::int`,
        excused: sql<number>`count(*) filter (where ${attendanceLogs.status} = 'EXCUSED')::int`,
      })
      .from(attendanceLogs)
      .innerJoin(enrollments, eq(enrollments.id, attendanceLogs.enrollmentId))
      .where(and(eq(enrollments.academicYearId, academicYearId), eq(attendanceLogs.date, date))),
    db
      .select({
        pending: sql<number>`count(*)::int`,
      })
      .from(attendanceExcuses)
      .innerJoin(enrollments, eq(enrollments.id, attendanceExcuses.enrollmentId))
      .where(and(eq(enrollments.academicYearId, academicYearId), eq(attendanceExcuses.status, "PENDING"))),
    db
      .select({
        id: attendanceExcuses.id,
        studentFirst: studentUser.firstName,
        studentLast: studentUser.lastName,
        groupName: groups.name,
        gradeName: grades.name,
        guardianFirst: guardianUser.firstName,
        guardianLast: guardianUser.lastName,
        fromDate: attendanceExcuses.fromDate,
        toDate: attendanceExcuses.toDate,
        reasonType: attendanceExcuses.reasonType,
        description: attendanceExcuses.description,
        status: attendanceExcuses.status,
        reviewNotes: attendanceExcuses.reviewNotes,
        reviewerFirst: reviewerUser.firstName,
        reviewerLast: reviewerUser.lastName,
        createdAt: attendanceExcuses.createdAt,
      })
      .from(attendanceExcuses)
      .innerJoin(enrollments, eq(enrollments.id, attendanceExcuses.enrollmentId))
      .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(guardianUser, eq(guardianUser.id, attendanceExcuses.guardianId))
      .leftJoin(reviewerUser, eq(reviewerUser.id, attendanceExcuses.reviewedBy))
      .where(excuseWhere)
      .orderBy(desc(attendanceExcuses.createdAt))
      .limit(30),
    db
      .select({
        id: attendanceLogs.id,
        studentFirst: studentUser.firstName,
        studentLast: studentUser.lastName,
        groupName: groups.name,
        subjectName: subjects.name,
        status: attendanceLogs.status,
        notes: attendanceLogs.notes,
      })
      .from(attendanceLogs)
      .innerJoin(enrollments, eq(enrollments.id, attendanceLogs.enrollmentId))
      .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .leftJoin(courseAssignments, eq(courseAssignments.id, attendanceLogs.courseAssignmentId))
      .leftJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .where(
        and(
          eq(enrollments.academicYearId, academicYearId),
          eq(attendanceLogs.date, date),
          ne(attendanceLogs.status, "PRESENT"),
        ),
      )
      .orderBy(asc(groups.name), asc(studentUser.lastName))
      .limit(40),
  ]);

  const agg = aggRows[0] ?? { present: 0, absent: 0, late: 0, excused: 0 };

  return {
    dailyStats: computeAttendanceStats(agg),
    pendingExcusesCount: pendingRows[0]?.pending ?? 0,
    excuses: excuseRows.map((e) => ({
      id: e.id,
      studentName: `${e.studentFirst} ${e.studentLast}`,
      groupName: e.groupName,
      gradeName: e.gradeName,
      guardianName: e.guardianFirst ? `${e.guardianFirst} ${e.guardianLast}` : null,
      fromDate: e.fromDate,
      toDate: e.toDate,
      reasonType: e.reasonType,
      description: e.description,
      status: e.status,
      reviewNotes: e.reviewNotes,
      reviewerName: e.reviewerFirst ? `${e.reviewerFirst} ${e.reviewerLast}` : null,
      createdAt: e.createdAt,
    })),
    incidents: incidentRows.map((i) => ({
      id: i.id,
      studentName: `${i.studentFirst} ${i.studentLast}`,
      groupName: i.groupName,
      subjectName: i.subjectName,
      status: i.status,
      notes: i.notes,
    })),
  };
}
