import "server-only";
import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  attendanceExcuses,
  courseAssignments,
  courseUnits,
  enrollments,
  observerRecords,
  quizAttempts,
  sieeGradeColumns,
  studentGrades,
  submissions,
} from "@/db/schema";
import {
  getCurrentAcademicContext,
  getDirectedGroups,
  getGroupCourses,
  getGuardianChildren,
  getInstitutionOverview,
  getStudentPlacement,
  getTeacherCourseLoad,
  type AcademicContext,
  type DirectedGroup,
  type GroupCourse,
  type GuardianChild,
  type InstitutionOverview,
  type StudentPlacement,
  type TeacherCourse,
} from "@/modules/core/academic-structure/queries";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { stageForLevel, type Stage } from "./stage";

export interface PeriodTrendPoint {
  periodNumber: number;
  label: string;
  average: number | null;
}

export interface StudentView {
  studentId: string;
  firstName: string;
  fullName: string;
  placement: StudentPlacement | null;
  courses: GroupCourse[];
  /** Registro visual del bloque académico (primaria / bachillerato). */
  stage: Stage;
  pendingObserverStatements: number;
  pendingGuardianAcknowledgements: number;
  /** Progreso real en Órbita Virtual (tareas + cuestionarios completados). */
  orbitProgress: { completed: number; total: number; percent: number };
  /** Evolución de promedio numérico por periodo para el gráfico de curvas SVG. */
  periodTrend: PeriodTrendPoint[];
}

export type DashboardData =
  | { role: "STUDENT"; context: AcademicContext | null; student: StudentView }
  | {
      role: "GUARDIAN";
      context: AcademicContext | null;
      children: GuardianChild[];
      selected: StudentView | null;
    }
  | {
      role: "TEACHER";
      context: AcademicContext | null;
      load: TeacherCourse[];
      directed: DirectedGroup[];
      totals: { courses: number; groups: number; students: number; weeklyHours: number };
    }
  | {
      role: "COORDINATOR" | "ADMIN";
      context: AcademicContext | null;
      overview: InstitutionOverview | null;
      alerts: { pendingObserver: number; pendingExcuses: number };
    };

async function buildStudentView(
  studentId: string,
  names: { firstName: string; lastName: string },
  context: AcademicContext | null,
): Promise<StudentView> {
  const placement = context ? await getStudentPlacement(studentId, context.year.id) : null;
  const [courses, statementRow, ackRow, groupActs, periodScores] = placement
    ? await Promise.all([
        getGroupCourses(placement.groupId),
        db
          .select({ total: count() })
          .from(observerRecords)
          .where(
            and(
              eq(observerRecords.enrollmentId, placement.enrollmentId),
              ne(observerRecords.category, "PRAISE"),
              isNull(observerRecords.studentStatement),
            ),
          ),
        db
          .select({ total: count() })
          .from(observerRecords)
          .where(
            and(
              eq(observerRecords.enrollmentId, placement.enrollmentId),
              isNull(observerRecords.guardianAcknowledgedAt),
            ),
          ),
        context
          ? db
              .select({ id: activities.id })
              .from(activities)
              .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
              .innerJoin(courseAssignments, eq(courseAssignments.id, courseUnits.courseAssignmentId))
              .where(
                and(
                  eq(courseAssignments.groupId, placement.groupId),
                  eq(courseAssignments.academicYearId, context.year.id),
                  eq(courseUnits.isPublished, true),
                  eq(activities.isPublished, true),
                ),
              )
          : Promise.resolve([]),
        db
          .select({
            periodId: sieeGradeColumns.periodId,
            avgScore: sql<number>`round(avg(${studentGrades.numericScore})::numeric, 1)::float`,
          })
          .from(studentGrades)
          .innerJoin(sieeGradeColumns, eq(sieeGradeColumns.id, studentGrades.columnId))
          .where(
            and(
              eq(studentGrades.enrollmentId, placement.enrollmentId),
              sql`${studentGrades.numericScore} is not null`,
            ),
          )
          .groupBy(sieeGradeColumns.periodId),
      ])
    : [[], [{ total: 0 }], [{ total: 0 }], [], []];

  let completedActivities = 0;
  if (placement && groupActs.length > 0) {
    const actIds = groupActs.map((a) => a.id);
    const [subs, quizDone] = await Promise.all([
      db
        .select({ activityId: submissions.activityId })
        .from(submissions)
        .where(and(eq(submissions.enrollmentId, placement.enrollmentId), inArray(submissions.activityId, actIds))),
      db
        .select({ activityId: quizAttempts.activityId })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.enrollmentId, placement.enrollmentId),
            inArray(quizAttempts.activityId, actIds),
            sql`${quizAttempts.submittedAt} is not null`,
          ),
        ),
    ]);
    completedActivities = new Set([
      ...subs.map((s) => s.activityId),
      ...quizDone.map((q) => q.activityId),
    ]).size;
  }

  const avgByPeriodId = new Map(periodScores.map((r) => [r.periodId, Number(r.avgScore)]));
  const periodTrend: PeriodTrendPoint[] = (context?.periods ?? []).map((p) => ({
    periodNumber: p.number,
    label: `P${p.number}`,
    average: avgByPeriodId.get(p.id) ?? null,
  }));

  const totalActivities = groupActs.length;
  const orbitPercent =
    totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 100;

  return {
    studentId,
    firstName: names.firstName,
    fullName: `${names.firstName} ${names.lastName}`,
    placement,
    courses,
    stage: stageForLevel(placement?.levelCode),
    pendingObserverStatements: statementRow[0]?.total ?? 0,
    pendingGuardianAcknowledgements: ackRow[0]?.total ?? 0,
    orbitProgress: { completed: completedActivities, total: totalActivities, percent: orbitPercent },
    periodTrend,
  };
}

/**
 * Datos del panel principal según el rol en sesión. Cada rama solo consulta
 * información que el actor tiene permitido ver (REGLAS.md §3.3).
 */
export async function getDashboardData(actor: SessionUser): Promise<DashboardData> {
  const context = await getCurrentAcademicContext();
  const yearId = context?.year.id ?? null;

  switch (actor.role) {
    case "STUDENT":
      return {
        role: "STUDENT",
        context,
        student: await buildStudentView(actor.id, actor, context),
      };

    case "GUARDIAN": {
      // La lista sale de guardian_links del propio acudiente: es la autorización.
      // La cookie del hijo activo es solo una preferencia dentro de esa lista.
      const children = await getGuardianChildren(actor.id, yearId);
      const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
      const child = children.find((c) => c.studentId === selectedId);
      const selected = child ? await buildStudentView(child.studentId, child, context) : null;
      return { role: "GUARDIAN", context, children, selected };
    }

    case "TEACHER": {
      const [load, directed] = yearId
        ? await Promise.all([getTeacherCourseLoad(actor.id, yearId), getDirectedGroups(actor.id, yearId)])
        : [[], []];
      const groupStudents = new Map(load.map((c) => [c.groupId, c.studentCount]));
      return {
        role: "TEACHER",
        context,
        load,
        directed,
        totals: {
          courses: load.length,
          groups: groupStudents.size,
          students: [...groupStudents.values()].reduce((sum, n) => sum + n, 0),
          weeklyHours: load.reduce((sum, c) => sum + c.weeklyHours, 0),
        },
      };
    }

    case "COORDINATOR":
    case "ADMIN": {
      if (!yearId) {
        return {
          role: actor.role,
          context,
          overview: null,
          alerts: { pendingObserver: 0, pendingExcuses: 0 },
        };
      }
      const [overview, pendingObsRow, pendingExcRow] = await Promise.all([
        getInstitutionOverview(yearId),
        db
          .select({ total: count() })
          .from(observerRecords)
          .innerJoin(enrollments, eq(enrollments.id, observerRecords.enrollmentId))
          .where(and(eq(enrollments.academicYearId, yearId), isNull(observerRecords.guardianAcknowledgedAt))),
        db
          .select({ total: count() })
          .from(attendanceExcuses)
          .innerJoin(enrollments, eq(enrollments.id, attendanceExcuses.enrollmentId))
          .where(and(eq(enrollments.academicYearId, yearId), eq(attendanceExcuses.status, "PENDING"))),
      ]);
      return {
        role: actor.role,
        context,
        overview,
        alerts: {
          pendingObserver: pendingObsRow[0]?.total ?? 0,
          pendingExcuses: pendingExcRow[0]?.total ?? 0,
        },
      };
    }
  }
}
