import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  courseAssignments,
  enrollments,
  grades,
  groups,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
  subjects,
  users,
} from "@/db/schema";

export type ComplianceStatus = "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED";

export interface CourseComplianceItem {
  courseAssignmentId: string;
  subjectName: string;
  groupName: string;
  gradeName: string;
  studentCount: number;
  columnCount: number;
  gradesPercent: number;
  logrosFilled: number;
  logrosExpected: number;
  logrosPercent: number;
  status: ComplianceStatus;
}

export interface TeacherComplianceRow {
  teacherId: string;
  teacherName: string;
  courseCount: number;
  gradesPercent: number;
  logrosPercent: number;
  completeCourses: number;
  status: ComplianceStatus;
  courses: CourseComplianceItem[];
}

export interface GroupComplianceRow {
  groupId: string;
  groupName: string;
  gradeName: string;
  gradeOrder: number;
  studentCount: number;
  courseCount: number;
  gradesPercent: number;
  logrosPercent: number;
  readyForReportCards: boolean;
}

export interface PeriodComplianceOverview {
  summary: {
    overallGradesPercent: number;
    overallLogrosPercent: number;
    coursesWithColumnsPercent: number;
    totalCourses: number;
    completeCourses: number;
    inProgressCourses: number;
    notStartedCourses: number;
    totalTeachers: number;
    teachersComplete: number;
    teachersPending: number;
  };
  teachers: TeacherComplianceRow[];
  groups: GroupComplianceRow[];
}

/** Calcula estado de cumplimiento para una asignatura o docente. */
export function classifyCompliance(gradesPercent: number, logrosPercent: number, hasActivity: boolean): ComplianceStatus {
  if (gradesPercent >= 90 && logrosPercent >= 100) return "COMPLETE";
  if (gradesPercent > 0 || logrosPercent > 0 || hasActivity) return "IN_PROGRESS";
  return "NOT_STARTED";
}

/**
 * Analítica SQL de seguimiento docente para Rectoría y Coordinación en un periodo:
 * evalúa avance de calificaciones subidas, logros redactados y columnas creadas
 * por docente y por grupo (4 consultas SQL paralelas, apto para 1.000+ usuarios).
 */
export async function getPeriodComplianceOverview(
  academicYearId: string,
  periodId: string,
): Promise<PeriodComplianceOverview> {
  const [courses, enrollmentCounts, competencyStats, gradeStats] = await Promise.all([
    db
      .select({
        courseAssignmentId: courseAssignments.id,
        subjectName: subjects.name,
        groupId: groups.id,
        groupName: groups.name,
        gradeName: grades.name,
        gradeOrder: grades.displayOrder,
        assessmentMode: grades.assessmentMode,
        teacherId: courseAssignments.teacherId,
        teacherFirst: users.firstName,
        teacherLast: users.lastName,
      })
      .from(courseAssignments)
      .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(users, eq(users.id, courseAssignments.teacherId))
      .where(eq(courseAssignments.academicYearId, academicYearId))
      .orderBy(asc(grades.displayOrder), asc(groups.name), asc(subjects.name)),

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
        courseAssignmentId: sieeCompetencies.courseAssignmentId,
        totalDims: sql<number>`count(*)::int`,
        filledLogros: sql<number>`count(*) filter (where length(trim(${sieeCompetencies.description})) > 0)::int`,
      })
      .from(sieeCompetencies)
      .where(eq(sieeCompetencies.periodId, periodId))
      .groupBy(sieeCompetencies.courseAssignmentId),

    db
      .select({
        courseAssignmentId: sieeGradeColumns.courseAssignmentId,
        columnCount: sql<number>`count(distinct ${sieeGradeColumns.id})::int`,
        gradedCells: sql<number>`count(${studentGrades.id})::int`,
      })
      .from(sieeGradeColumns)
      .leftJoin(studentGrades, eq(studentGrades.columnId, sieeGradeColumns.id))
      .where(eq(sieeGradeColumns.periodId, periodId))
      .groupBy(sieeGradeColumns.courseAssignmentId),
  ]);

  const studentsByGroup = new Map(enrollmentCounts.map((e) => [e.groupId, e.total]));
  const compByCourse = new Map(competencyStats.map((c) => [c.courseAssignmentId, c]));
  const gradesByCourse = new Map(gradeStats.map((g) => [g.courseAssignmentId, g]));

  const teacherMap = new Map<
    string,
    { teacherId: string; teacherName: string; courses: CourseComplianceItem[] }
  >();
  const groupMap = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      gradeName: string;
      gradeOrder: number;
      studentCount: number;
      courses: CourseComplianceItem[];
    }
  >();

  let completeCourses = 0;
  let inProgressCourses = 0;
  let notStartedCourses = 0;
  let coursesWithColumns = 0;
  let sumGradesPct = 0;
  let sumLogrosPct = 0;

  for (const c of courses) {
    const studentCount = studentsByGroup.get(c.groupId) ?? 0;
    const comp = compByCourse.get(c.courseAssignmentId);
    const gs = gradesByCourse.get(c.courseAssignmentId);

    const expectedDims = c.assessmentMode === "QUALITATIVE" ? 1 : 3;
    const logrosExpected = Math.max(comp?.totalDims ?? 0, expectedDims);
    const logrosFilled = comp?.filledLogros ?? 0;
    const logrosPercent = logrosExpected > 0 ? Math.min(100, Math.round((logrosFilled / logrosExpected) * 100)) : 0;

    const columnCount = gs?.columnCount ?? 0;
    const gradedCells = gs?.gradedCells ?? 0;
    const expectedCells = studentCount * columnCount;
    const gradesPercent =
      columnCount > 0 && expectedCells > 0 ? Math.min(100, Math.round((gradedCells / expectedCells) * 100)) : 0;

    const status = classifyCompliance(gradesPercent, logrosPercent, columnCount > 0);
    if (status === "COMPLETE") completeCourses += 1;
    else if (status === "IN_PROGRESS") inProgressCourses += 1;
    else notStartedCourses += 1;

    if (columnCount > 0) coursesWithColumns += 1;
    sumGradesPct += gradesPercent;
    sumLogrosPct += logrosPercent;

    const item: CourseComplianceItem = {
      courseAssignmentId: c.courseAssignmentId,
      subjectName: c.subjectName,
      groupName: c.groupName,
      gradeName: c.gradeName,
      studentCount,
      columnCount,
      gradesPercent,
      logrosFilled,
      logrosExpected,
      logrosPercent,
      status,
    };

    const tKey = c.teacherId ?? "__unassigned__";
    const tName = c.teacherFirst ? `${c.teacherFirst} ${c.teacherLast}` : "Sin docente asignado";
    let tEntry = teacherMap.get(tKey);
    if (!tEntry) {
      tEntry = { teacherId: tKey, teacherName: tName, courses: [] };
      teacherMap.set(tKey, tEntry);
    }
    tEntry.courses.push(item);

    let gEntry = groupMap.get(c.groupId);
    if (!gEntry) {
      gEntry = {
        groupId: c.groupId,
        groupName: c.groupName,
        gradeName: c.gradeName,
        gradeOrder: c.gradeOrder,
        studentCount,
        courses: [],
      };
      groupMap.set(c.groupId, gEntry);
    }
    gEntry.courses.push(item);
  }

  const totalCourses = courses.length;
  const teachers: TeacherComplianceRow[] = [...teacherMap.values()]
    .map((t) => {
      const count = t.courses.length;
      const gPct = count > 0 ? Math.round(t.courses.reduce((s, x) => s + x.gradesPercent, 0) / count) : 0;
      const lPct = count > 0 ? Math.round(t.courses.reduce((s, x) => s + x.logrosPercent, 0) / count) : 0;
      const complete = t.courses.filter((x) => x.status === "COMPLETE").length;
      const hasAnyCol = t.courses.some((x) => x.columnCount > 0);
      return {
        teacherId: t.teacherId,
        teacherName: t.teacherName,
        courseCount: count,
        gradesPercent: gPct,
        logrosPercent: lPct,
        completeCourses: complete,
        status: classifyCompliance(gPct, lPct, hasAnyCol),
        courses: t.courses,
      };
    })
    // Ordena primero quienes tienen menor avance para que Rectoría los identifique al instante.
    .sort(
      (a, b) =>
        a.gradesPercent + a.logrosPercent - (b.gradesPercent + b.logrosPercent) ||
        a.teacherName.localeCompare(b.teacherName, "es"),
    );

  const groupRows: GroupComplianceRow[] = [...groupMap.values()]
    .map((g) => {
      const count = g.courses.length;
      const gPct = count > 0 ? Math.round(g.courses.reduce((s, x) => s + x.gradesPercent, 0) / count) : 0;
      const lPct = count > 0 ? Math.round(g.courses.reduce((s, x) => s + x.logrosPercent, 0) / count) : 0;
      return {
        groupId: g.groupId,
        groupName: g.groupName,
        gradeName: g.gradeName,
        gradeOrder: g.gradeOrder,
        studentCount: g.studentCount,
        courseCount: count,
        gradesPercent: gPct,
        logrosPercent: lPct,
        readyForReportCards: gPct >= 90 && lPct >= 100,
      };
    })
    .sort((a, b) => a.gradeOrder - b.gradeOrder || a.groupName.localeCompare(b.groupName, "es"));

  const teachersComplete = teachers.filter((t) => t.status === "COMPLETE").length;

  return {
    summary: {
      overallGradesPercent: totalCourses > 0 ? Math.round(sumGradesPct / totalCourses) : 0,
      overallLogrosPercent: totalCourses > 0 ? Math.round(sumLogrosPct / totalCourses) : 0,
      coursesWithColumnsPercent: totalCourses > 0 ? Math.round((coursesWithColumns / totalCourses) * 100) : 0,
      totalCourses,
      completeCourses,
      inProgressCourses,
      notStartedCourses,
      totalTeachers: teachers.length,
      teachersComplete,
      teachersPending: teachers.length - teachersComplete,
    },
    teachers,
    groups: groupRows,
  };
}
