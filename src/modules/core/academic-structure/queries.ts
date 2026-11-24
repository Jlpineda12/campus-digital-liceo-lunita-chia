import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  academicPeriods,
  academicYears,
  courseAssignments,
  enrollments,
  grades,
  groups,
  guardianLinks,
  levels,
  subjects,
  users,
} from "@/db/schema";
import { buildAvatarApiUrl } from "@/modules/core/profile/storage";
import type { AssessmentMode, LevelCode } from "./constants";
import { pickCurrentPeriod } from "./dates";
import { STHEAMI_PILLARS, type StheamiPillar } from "./stheami";

/**
 * Consultas de estructura académica. Son funciones internas del módulo: quien
 * las llama debe haber verificado antes el permiso del actor (ver dashboard/service).
 */

/** Fecha de hoy en Colombia (`YYYY-MM-DD`). */
export function todayInBogota(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

export interface PeriodSummary {
  id: string;
  number: number;
  name: string;
  weightPercent: number;
  gradesLocked: boolean;
  startDate: string;
  endDate: string;
}

export interface AcademicContext {
  year: { id: string; year: number; name: string; minPassingScore: number; enrollmentOpen: boolean };
  periods: PeriodSummary[];
  currentPeriod: PeriodSummary | null;
  today: string;
}

/** Memorizado por petición: lo usan el layout y la página en el mismo render. */
export const getCurrentAcademicContext = cache(async (): Promise<AcademicContext | null> => {
  const [year] = await db
    .select({
      id: academicYears.id,
      year: academicYears.year,
      name: academicYears.name,
      minPassingScore: academicYears.minPassingScore,
      enrollmentOpen: academicYears.enrollmentOpen,
    })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) return null;

  const periods = await db
    .select({
      id: academicPeriods.id,
      number: academicPeriods.number,
      name: academicPeriods.name,
      weightPercent: academicPeriods.weightPercent,
      gradesLocked: academicPeriods.gradesLocked,
      startDate: academicPeriods.startDate,
      endDate: academicPeriods.endDate,
    })
    .from(academicPeriods)
    .where(eq(academicPeriods.academicYearId, year.id))
    .orderBy(asc(academicPeriods.number));

  const today = todayInBogota();
  return { year, periods, currentPeriod: pickCurrentPeriod(periods, today), today };
});

export interface StudentPlacement {
  enrollmentId: string;
  groupId: string;
  groupName: string;
  gradeName: string;
  levelName: string;
  levelCode: LevelCode;
  assessmentMode: AssessmentMode;
  directorName: string | null;
}

/** Memorizado por petición (lo usan el layout —para `data-stage`— y el panel). */
export const getStudentPlacement = cache(async (
  studentId: string,
  academicYearId: string,
): Promise<StudentPlacement | null> => {
  const [row] = await db
    .select({
      enrollmentId: enrollments.id,
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      levelName: levels.name,
      levelCode: levels.code,
      assessmentMode: grades.assessmentMode,
      directorFirst: users.firstName,
      directorLast: users.lastName,
    })
    .from(enrollments)
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .leftJoin(users, eq(users.id, groups.directorTeacherId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!row) return null;
  const { directorFirst, directorLast, ...placement } = row;
  return {
    ...placement,
    directorName: directorFirst ? `${directorFirst} ${directorLast}` : null,
  };
});

const pillarOrder = (p: StheamiPillar) => STHEAMI_PILLARS.indexOf(p);

export interface GroupCourse {
  courseId: string;
  subjectName: string;
  subjectCode: string;
  pillar: StheamiPillar;
  weeklyHours: number;
  teacherName: string | null;
  teacherInitials: string | null;
  teacherAvatarUrl: string | null;
}

export async function getGroupCourses(groupId: string): Promise<GroupCourse[]> {
  const rows = await db
    .select({
      courseId: courseAssignments.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      pillar: subjects.stheamiPillar,
      weeklyHours: subjects.weeklyHours,
      teacherId: users.id,
      teacherFirst: users.firstName,
      teacherLast: users.lastName,
      teacherAvatarKey: users.avatarUrl,
    })
    .from(courseAssignments)
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .leftJoin(users, eq(users.id, courseAssignments.teacherId))
    .where(eq(courseAssignments.groupId, groupId));

  return rows
    .map(({ teacherId, teacherFirst, teacherLast, teacherAvatarKey, ...course }) => ({
      ...course,
      teacherName: teacherFirst ? `${teacherFirst} ${teacherLast}` : null,
      teacherInitials:
        teacherFirst && teacherLast
          ? `${teacherFirst.trim()[0] ?? ""}${teacherLast.trim()[0] ?? ""}`.toUpperCase()
          : null,
      teacherAvatarUrl: teacherId ? buildAvatarApiUrl(teacherId, teacherAvatarKey) : null,
    }))
    .sort(
      (a, b) =>
        pillarOrder(a.pillar) - pillarOrder(b.pillar) || a.subjectName.localeCompare(b.subjectName, "es"),
    );
}

async function countActiveStudentsByGroup(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({ groupId: enrollments.groupId, total: count() })
    .from(enrollments)
    .where(and(inArray(enrollments.groupId, groupIds), eq(enrollments.status, "ACTIVE")))
    .groupBy(enrollments.groupId);
  return new Map(rows.map((r) => [r.groupId, r.total]));
}

export interface TeacherCourse {
  courseId: string;
  groupId: string;
  groupName: string;
  gradeName: string;
  gradeOrder: number;
  subjectName: string;
  pillar: StheamiPillar;
  weeklyHours: number;
  studentCount: number;
}

export async function getTeacherCourseLoad(
  teacherId: string,
  academicYearId: string,
): Promise<TeacherCourse[]> {
  const rows = await db
    .select({
      courseId: courseAssignments.id,
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      gradeOrder: grades.displayOrder,
      subjectName: subjects.name,
      pillar: subjects.stheamiPillar,
      weeklyHours: subjects.weeklyHours,
    })
    .from(courseAssignments)
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .where(
      and(
        eq(courseAssignments.teacherId, teacherId),
        eq(courseAssignments.academicYearId, academicYearId),
      ),
    );

  const counts = await countActiveStudentsByGroup([...new Set(rows.map((r) => r.groupId))]);
  return rows
    .map((r) => ({ ...r, studentCount: counts.get(r.groupId) ?? 0 }))
    .sort((a, b) => a.gradeOrder - b.gradeOrder || a.subjectName.localeCompare(b.subjectName, "es"));
}

export interface DirectedGroup {
  groupId: string;
  groupName: string;
  gradeName: string;
  capacity: number;
  studentCount: number;
}

export async function getDirectedGroups(
  teacherId: string,
  academicYearId: string,
): Promise<DirectedGroup[]> {
  const rows = await db
    .select({
      groupId: groups.id,
      groupName: groups.name,
      gradeName: grades.name,
      capacity: groups.capacity,
    })
    .from(groups)
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .where(and(eq(groups.directorTeacherId, teacherId), eq(groups.academicYearId, academicYearId)))
    .orderBy(asc(grades.displayOrder));
  const counts = await countActiveStudentsByGroup(rows.map((r) => r.groupId));
  return rows.map((r) => ({ ...r, studentCount: counts.get(r.groupId) ?? 0 }));
}

export interface GuardianChild {
  studentId: string;
  firstName: string;
  lastName: string;
  relationship: "MADRE" | "PADRE" | "ACUDIENTE";
  isFinancialResponsible: boolean;
  groupName: string | null;
  gradeName: string | null;
  levelCode: LevelCode | null;
}

/**
 * Hijos vinculados y activos (`guardian_links`). Es la fuente de autorización del
 * acudiente: memorizada por petición para que layout y página no la repitan.
 */
export const getGuardianChildren = cache(async (
  guardianId: string,
  academicYearId: string | null,
): Promise<GuardianChild[]> => {
  const children = await db
    .select({
      studentId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      relationship: guardianLinks.relationship,
      isFinancialResponsible: guardianLinks.isFinancialResponsible,
    })
    .from(guardianLinks)
    .innerJoin(users, eq(users.id, guardianLinks.studentId))
    .where(and(eq(guardianLinks.guardianId, guardianId), eq(users.isActive, true)))
    .orderBy(asc(users.firstName));

  if (children.length === 0 || !academicYearId) {
    return children.map((c) => ({ ...c, groupName: null, gradeName: null, levelCode: null }));
  }

  const placements = await db
    .select({
      studentId: enrollments.studentId,
      groupName: groups.name,
      gradeName: grades.name,
      levelCode: levels.code,
    })
    .from(enrollments)
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(levels, eq(levels.id, grades.levelId))
    .where(
      and(
        inArray(
          enrollments.studentId,
          children.map((c) => c.studentId),
        ),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, "ACTIVE"),
      ),
    );
  const byStudent = new Map(placements.map((p) => [p.studentId, p]));
  return children.map((c) => ({
    ...c,
    groupName: byStudent.get(c.studentId)?.groupName ?? null,
    gradeName: byStudent.get(c.studentId)?.gradeName ?? null,
    levelCode: byStudent.get(c.studentId)?.levelCode ?? null,
  }));
});

export interface InstitutionOverview {
  totals: {
    students: number;
    teachers: number;
    guardians: number;
    groups: number;
    subjects: number;
    courseAssignments: number;
    unassignedCourses: number;
  };
  byLevel: Array<{ levelName: string; students: number; groups: number }>;
  groups: Array<{
    groupId: string;
    groupName: string;
    gradeName: string;
    levelName: string;
    directorName: string | null;
    capacity: number;
    studentCount: number;
  }>;
  pillars: Array<{ pillar: StheamiPillar; subjects: number }>;
}

export async function getInstitutionOverview(academicYearId: string): Promise<InstitutionOverview> {
  // Consultas independientes en paralelo (REGLAS.md §4.2).
  const [roleCounts, groupRows, assignmentRows, pillarRows] = await Promise.all([
    db
      .select({ role: users.role, total: count() })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.role),
    db
      .select({
        groupId: groups.id,
        groupName: groups.name,
        gradeName: grades.name,
        levelName: levels.name,
        capacity: groups.capacity,
        directorFirst: users.firstName,
        directorLast: users.lastName,
      })
      .from(groups)
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .leftJoin(users, eq(users.id, groups.directorTeacherId))
      .where(eq(groups.academicYearId, academicYearId))
      .orderBy(asc(grades.displayOrder)),
    db
      .select({ teacherId: courseAssignments.teacherId })
      .from(courseAssignments)
      .where(eq(courseAssignments.academicYearId, academicYearId)),
    db
      .select({ pillar: subjects.stheamiPillar, total: count() })
      .from(subjects)
      .groupBy(subjects.stheamiPillar),
  ]);
  const byRole = new Map(roleCounts.map((r) => [r.role, r.total]));
  const counts = await countActiveStudentsByGroup(groupRows.map((g) => g.groupId));

  const groupsWithCounts = groupRows.map(({ directorFirst, directorLast, ...g }) => ({
    ...g,
    directorName: directorFirst ? `${directorFirst} ${directorLast}` : null,
    studentCount: counts.get(g.groupId) ?? 0,
  }));

  const levelMap = new Map<string, { levelName: string; students: number; groups: number }>();
  for (const g of groupsWithCounts) {
    const entry = levelMap.get(g.levelName) ?? { levelName: g.levelName, students: 0, groups: 0 };
    entry.students += g.studentCount;
    entry.groups += 1;
    levelMap.set(g.levelName, entry);
  }
  const pillarMap = new Map(pillarRows.map((p) => [p.pillar, p.total]));

  return {
    totals: {
      students: [...counts.values()].reduce((sum, n) => sum + n, 0),
      teachers: byRole.get("TEACHER") ?? 0,
      guardians: byRole.get("GUARDIAN") ?? 0,
      groups: groupRows.length,
      subjects: pillarRows.reduce((sum, p) => sum + p.total, 0),
      courseAssignments: assignmentRows.length,
      unassignedCourses: assignmentRows.filter((a) => a.teacherId === null).length,
    },
    byLevel: [...levelMap.values()],
    groups: groupsWithCounts,
    pillars: STHEAMI_PILLARS.map((pillar) => ({ pillar, subjects: pillarMap.get(pillar) ?? 0 })),
  };
}
