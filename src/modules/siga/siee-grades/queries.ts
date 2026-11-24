import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  academicPeriods,
  academicYears,
  courseAssignments,
  enrollments,
  grades,
  groups,
  periodUnlockWindows,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
  subjects,
  users,
} from "@/db/schema";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { can } from "@/modules/core/auth/permissions";
import type { Role } from "@/modules/core/auth/roles";
import {
  computeStudentPeriod,
  DEFAULT_DIMENSION_WEIGHTS,
  type CalcDimension,
  type SieeDimension,
  type StudentPeriodResult,
} from "./calculator";
import { getPeriodEditState, type PeriodEditState } from "./lock";
import { DEFAULT_SIEE_SCALE, type SieeScale } from "./scale";
import type { CourseContext } from "./access";

export interface PeriodInfo {
  id: string;
  number: number;
  name: string;
  gradesLocked: boolean;
  startDate: string;
  endDate: string;
  weightPercent: number;
}

export async function getYearPeriods(academicYearId: string): Promise<PeriodInfo[]> {
  return db
    .select({
      id: academicPeriods.id,
      number: academicPeriods.number,
      name: academicPeriods.name,
      gradesLocked: academicPeriods.gradesLocked,
      startDate: academicPeriods.startDate,
      endDate: academicPeriods.endDate,
      weightPercent: academicPeriods.weightPercent,
    })
    .from(academicPeriods)
    .where(eq(academicPeriods.academicYearId, academicYearId))
    .orderBy(asc(academicPeriods.number));
}

export async function getScaleForYear(academicYearId: string): Promise<SieeScale> {
  const [year] = await db
    .select({ minPassingScore: academicYears.minPassingScore })
    .from(academicYears)
    .where(eq(academicYears.id, academicYearId))
    .limit(1);
  return { ...DEFAULT_SIEE_SCALE, minPassing: year?.minPassingScore ?? DEFAULT_SIEE_SCALE.minPassing };
}

export async function getEditState(
  period: { id: string; gradesLocked: boolean },
  courseAssignmentId: string,
): Promise<PeriodEditState> {
  if (!period.gradesLocked) return { editable: true, via: "open" };
  const windows = await db
    .select({
      id: periodUnlockWindows.id,
      courseAssignmentId: periodUnlockWindows.courseAssignmentId,
      opensAt: periodUnlockWindows.opensAt,
      expiresAt: periodUnlockWindows.expiresAt,
      closedAt: periodUnlockWindows.closedAt,
    })
    .from(periodUnlockWindows)
    .where(eq(periodUnlockWindows.periodId, period.id));
  return getPeriodEditState(period, windows, courseAssignmentId);
}

/**
 * Garantiza las dimensiones SIEE de una carga en un periodo: Saber/Hacer/Ser
 * (numérica) o una dimensión cualitativa (Preescolar). Idempotente.
 */
export async function ensureCompetencies(
  courseAssignmentId: string,
  periodId: string,
  assessmentMode: CourseContext["assessmentMode"],
): Promise<void> {
  const rows =
    assessmentMode === "QUALITATIVE"
      ? [{ dimension: "QUALITATIVE" as const, weightPercent: 100, displayOrder: 0 }]
      : (Object.entries(DEFAULT_DIMENSION_WEIGHTS) as Array<[SieeDimension, number]>).map(
          ([dimension, weightPercent], displayOrder) => ({ dimension, weightPercent, displayOrder }),
        );
  await db
    .insert(sieeCompetencies)
    .values(rows.map((r) => ({ ...r, courseAssignmentId, periodId })))
    .onConflictDoNothing();
}

export interface GradebookDimension extends CalcDimension {
  description: string;
  columns: Array<{ id: string; title: string; weightPercent: number; linked: boolean }>;
}

export interface GradebookStudent {
  enrollmentId: string;
  firstName: string;
  lastName: string;
}

export interface Gradebook {
  dimensions: GradebookDimension[];
  students: GradebookStudent[];
  /** Notas por celda: `${columnId}:${enrollmentId}`. */
  scores: Record<string, number>;
  qualitative: Record<string, string>;
}

export const cellKey = (columnId: string, enrollmentId: string) => `${columnId}:${enrollmentId}`;

export async function getGradebook(course: CourseContext, periodId: string): Promise<Gradebook> {
  await ensureCompetencies(course.courseAssignmentId, periodId, course.assessmentMode);

  const [competencies, columns, students] = await Promise.all([
    db
      .select({
        id: sieeCompetencies.id,
        dimension: sieeCompetencies.dimension,
        description: sieeCompetencies.description,
        weightPercent: sieeCompetencies.weightPercent,
      })
      .from(sieeCompetencies)
      .where(
        and(
          eq(sieeCompetencies.courseAssignmentId, course.courseAssignmentId),
          eq(sieeCompetencies.periodId, periodId),
        ),
      )
      .orderBy(asc(sieeCompetencies.displayOrder)),
    db
      .select({
        id: sieeGradeColumns.id,
        competencyId: sieeGradeColumns.competencyId,
        title: sieeGradeColumns.title,
        weightPercent: sieeGradeColumns.weightPercent,
        linkedActivityId: sieeGradeColumns.linkedActivityId,
      })
      .from(sieeGradeColumns)
      .where(
        and(
          eq(sieeGradeColumns.courseAssignmentId, course.courseAssignmentId),
          eq(sieeGradeColumns.periodId, periodId),
        ),
      )
      .orderBy(asc(sieeGradeColumns.displayOrder), asc(sieeGradeColumns.createdAt)),
    db
      .select({ enrollmentId: enrollments.id, firstName: users.firstName, lastName: users.lastName })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .where(
        and(
          eq(enrollments.groupId, course.groupId),
          eq(enrollments.academicYearId, course.academicYearId),
          eq(enrollments.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(users.lastName), asc(users.firstName)),
  ]);

  const gradeRows =
    columns.length && students.length
      ? await db
          .select({
            columnId: studentGrades.columnId,
            enrollmentId: studentGrades.enrollmentId,
            numericScore: studentGrades.numericScore,
            qualitativeLevel: studentGrades.qualitativeLevel,
          })
          .from(studentGrades)
          .where(
            inArray(
              studentGrades.columnId,
              columns.map((c) => c.id),
            ),
          )
      : [];

  const scores: Record<string, number> = {};
  const qualitative: Record<string, string> = {};
  for (const g of gradeRows) {
    if (g.numericScore !== null) scores[cellKey(g.columnId, g.enrollmentId)] = g.numericScore;
    if (g.qualitativeLevel !== null) qualitative[cellKey(g.columnId, g.enrollmentId)] = g.qualitativeLevel;
  }

  return {
    dimensions: competencies.map((c) => ({
      competencyId: c.id,
      dimension: c.dimension,
      description: c.description,
      weightPercent: c.weightPercent,
      columns: columns
        .filter((col) => col.competencyId === c.id)
        .map((col) => ({
          id: col.id,
          title: col.title,
          weightPercent: col.weightPercent,
          linked: col.linkedActivityId !== null,
        })),
    })),
    students,
    scores,
    qualitative,
  };
}

export interface GradebookCourseOption {
  courseAssignmentId: string;
  groupName: string;
  gradeOrder: number;
  subjectName: string;
  pillar: StheamiPillar;
  teacherId: string | null;
}

/**
 * Cargas que el actor puede abrir en la planilla: las propias y las de su
 * dirección de grupo (docente), o todas (directivos con `reportCards.preview`).
 */
export async function listGradebookCourses(
  actor: { id: string; role: Role },
  academicYearId: string,
): Promise<GradebookCourseOption[]> {
  if (actor.role !== "TEACHER" && !can(actor.role, "reportCards.preview")) {
    return [];
  }
  const scope =
    actor.role === "TEACHER"
      ? and(
          eq(courseAssignments.academicYearId, academicYearId),
          or(eq(courseAssignments.teacherId, actor.id), eq(groups.directorTeacherId, actor.id)),
        )
      : eq(courseAssignments.academicYearId, academicYearId);
  const rows = await db
    .select({
      courseAssignmentId: courseAssignments.id,
      groupName: groups.name,
      gradeOrder: grades.displayOrder,
      subjectName: subjects.name,
      pillar: subjects.stheamiPillar,
      teacherId: courseAssignments.teacherId,
    })
    .from(courseAssignments)
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .where(scope);
  return rows.sort(
    (a, b) => a.gradeOrder - b.gradeOrder || a.subjectName.localeCompare(b.subjectName, "es"),
  );
}

/* ---------------------------------------------------------------------------
   Vista del estudiante / acudiente
   --------------------------------------------------------------------------- */

export interface StudentSubjectGrades {
  courseAssignmentId: string;
  subjectName: string;
  pillar: StheamiPillar;
  teacherName: string | null;
  dimensions: Array<{
    competencyId: string;
    dimension: SieeDimension;
    description: string;
    weightPercent: number;
    columns: Array<{ id: string; title: string; weightPercent: number; score: number | null; qualitative: string | null; linked: boolean }>;
  }>;
  result: StudentPeriodResult;
}

/**
 * Notas de un estudiante en un periodo, por asignatura. Quien llama debe haber
 * verificado `canAccessStudent` (docs/secciones/02 y 03).
 */
export async function getStudentPeriodGrades(options: {
  enrollmentId: string;
  groupId: string;
  periodId: string;
  scale: SieeScale;
}): Promise<StudentSubjectGrades[]> {
  const { enrollmentId, groupId, periodId, scale } = options;

  const courses = await db
    .select({
      courseAssignmentId: courseAssignments.id,
      subjectName: subjects.name,
      pillar: subjects.stheamiPillar,
      teacherFirst: users.firstName,
      teacherLast: users.lastName,
    })
    .from(courseAssignments)
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .leftJoin(users, eq(users.id, courseAssignments.teacherId))
    .where(eq(courseAssignments.groupId, groupId));
  if (courses.length === 0) return [];
  const courseIds = courses.map((c) => c.courseAssignmentId);

  const [competencies, columns] = await Promise.all([
    db
      .select({
        id: sieeCompetencies.id,
        courseAssignmentId: sieeCompetencies.courseAssignmentId,
        dimension: sieeCompetencies.dimension,
        description: sieeCompetencies.description,
        weightPercent: sieeCompetencies.weightPercent,
        displayOrder: sieeCompetencies.displayOrder,
      })
      .from(sieeCompetencies)
      .where(
        and(inArray(sieeCompetencies.courseAssignmentId, courseIds), eq(sieeCompetencies.periodId, periodId)),
      ),
    db
      .select({
        id: sieeGradeColumns.id,
        competencyId: sieeGradeColumns.competencyId,
        title: sieeGradeColumns.title,
        weightPercent: sieeGradeColumns.weightPercent,
        linkedActivityId: sieeGradeColumns.linkedActivityId,
      })
      .from(sieeGradeColumns)
      .where(
        and(
          inArray(sieeGradeColumns.courseAssignmentId, courseIds),
          eq(sieeGradeColumns.periodId, periodId),
          eq(sieeGradeColumns.isPublished, true),
        ),
      )
      .orderBy(asc(sieeGradeColumns.displayOrder), asc(sieeGradeColumns.createdAt)),
  ]);

  const grades = columns.length
    ? await db
        .select({
          columnId: studentGrades.columnId,
          numericScore: studentGrades.numericScore,
          qualitativeLevel: studentGrades.qualitativeLevel,
        })
        .from(studentGrades)
        .where(
          and(
            eq(studentGrades.enrollmentId, enrollmentId),
            inArray(
              studentGrades.columnId,
              columns.map((c) => c.id),
            ),
          ),
        )
    : [];
  const byColumn = new Map(grades.map((g) => [g.columnId, g]));

  return courses
    .map((course) => {
      const dims = competencies
        .filter((c) => c.courseAssignmentId === course.courseAssignmentId)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((c) => ({
          competencyId: c.id,
          dimension: c.dimension,
          description: c.description,
          weightPercent: c.weightPercent,
          columns: columns
            .filter((col) => col.competencyId === c.id)
            .map((col) => ({
              id: col.id,
              title: col.title,
              weightPercent: col.weightPercent,
              score: byColumn.get(col.id)?.numericScore ?? null,
              qualitative: byColumn.get(col.id)?.qualitativeLevel ?? null,
              linked: col.linkedActivityId !== null,
            })),
        }));
      return {
        courseAssignmentId: course.courseAssignmentId,
        subjectName: course.subjectName,
        pillar: course.pillar,
        teacherName: course.teacherFirst ? `${course.teacherFirst} ${course.teacherLast}` : null,
        dimensions: dims,
        result: computeStudentPeriod(dims, (id) => byColumn.get(id)?.numericScore ?? null, scale),
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"));
}

export interface CopyableLogroSource {
  key: string;
  label: string;
  byDimension: Partial<Record<SieeDimension, string>>;
}

/**
 * Fuentes con logros ya escritos que el docente puede copiar en 1 clic:
 * otros periodos del mismo curso u otros grupos de la misma asignatura que dicta.
 */
export async function listCopyableLogroSources(options: {
  actor: { id: string; role: Role };
  course: CourseContext;
  currentPeriodId: string;
}): Promise<CopyableLogroSource[]> {
  const { actor, course, currentPeriodId } = options;

  const [currentAssign] = await db
    .select({ subjectId: courseAssignments.subjectId })
    .from(courseAssignments)
    .where(eq(courseAssignments.id, course.courseAssignmentId))
    .limit(1);
  if (!currentAssign) return [];

  const scope =
    actor.role === "TEACHER"
      ? and(
          eq(courseAssignments.academicYearId, course.academicYearId),
          eq(courseAssignments.subjectId, currentAssign.subjectId),
          eq(courseAssignments.teacherId, actor.id),
        )
      : and(
          eq(courseAssignments.academicYearId, course.academicYearId),
          eq(courseAssignments.subjectId, currentAssign.subjectId),
        );

  const relatedCourses = await db
    .select({
      courseAssignmentId: courseAssignments.id,
      groupName: groups.name,
    })
    .from(courseAssignments)
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .where(scope);

  if (relatedCourses.length === 0) return [];
  const groupByCourse = new Map(relatedCourses.map((c) => [c.courseAssignmentId, c.groupName]));

  const rows = await db
    .select({
      courseAssignmentId: sieeCompetencies.courseAssignmentId,
      periodId: sieeCompetencies.periodId,
      periodNumber: academicPeriods.number,
      periodName: academicPeriods.name,
      dimension: sieeCompetencies.dimension,
      description: sieeCompetencies.description,
    })
    .from(sieeCompetencies)
    .innerJoin(academicPeriods, eq(academicPeriods.id, sieeCompetencies.periodId))
    .where(
      inArray(
        sieeCompetencies.courseAssignmentId,
        relatedCourses.map((c) => c.courseAssignmentId),
      ),
    )
    .orderBy(asc(academicPeriods.number));

  const grouped = new Map<
    string,
    CopyableLogroSource & { sameCourse: boolean; periodNumber: number }
  >();
  for (const r of rows) {
    const trimmed = r.description.trim();
    if (!trimmed) continue;
    if (r.courseAssignmentId === course.courseAssignmentId && r.periodId === currentPeriodId) continue;

    const key = `${r.courseAssignmentId}:${r.periodId}`;
    const groupName = groupByCourse.get(r.courseAssignmentId) ?? "";
    const sameCourse = r.courseAssignmentId === course.courseAssignmentId;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        key,
        sameCourse,
        periodNumber: r.periodNumber,
        label: sameCourse ? `${r.periodName} (este mismo grupo)` : `${groupName} · ${r.periodName}`,
        byDimension: {},
      };
      grouped.set(key, entry);
    }
    entry.byDimension[r.dimension] = trimmed;
  }

  return [...grouped.values()]
    .sort(
      (a, b) =>
        Number(b.sameCourse) - Number(a.sameCourse) ||
        b.periodNumber - a.periodNumber ||
        a.label.localeCompare(b.label, "es"),
    )
    .map(({ key, label, byDimension }) => ({ key, label, byDimension }));
}
