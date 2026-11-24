import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  academicPeriods,
  activities,
  courseAssignments,
  courseThemes,
  courseUnits,
  enrollments,
  forumPosts,
  grades,
  groups,
  learningResources,
  levels,
  quizAttempts,
  quizQuestions,
  resourceViews,
  sieeCompetencies,
  sieeGradeColumns,
  subjects,
  submissions,
  users,
} from "@/db/schema";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import { getGuardianChildren, getStudentPlacement } from "@/modules/core/academic-structure/queries";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { remainingWeight, type SieeDimension } from "@/modules/siga/siee-grades/calculator";
import { ensureCompetencies } from "@/modules/siga/siee-grades/queries";
import type { AulaCourseAccess } from "./access";
import { normalizeCourseTheme, type CourseThemeConfig } from "./themes";

export interface AulaCourseCard {
  courseAssignmentId: string;
  subjectName: string;
  pillar: StheamiPillar;
  groupName: string;
  gradeName: string;
  teacherName: string | null;
  theme: CourseThemeConfig;
  unitCount: number;
  resourceCount: number;
  viewedResourceCount: number;
  activityCount: number;
  /** Tareas/cuestionarios pendientes del estudiante o entregas por calificar del docente. */
  pendingCount: number;
}

export interface AulaCoursesResult {
  courses: AulaCourseCard[];
  viewerLevelCode: LevelCode | null;
  viewerStudentName: string | null;
  viewerGroupLabel: string | null;
  totalPending: number;
}

/**
 * Lista los cursos visibles en Órbita Virtual (`/aula`) según el rol:
 * - Estudiante / Acudiente: materias de su grupo con progreso y tareas pendientes.
 * - Docente: cargas asignadas con conteo de entregas por calificar.
 * - Directivos: panorama institucional de cursos con contenido publicado.
 */
export async function listAulaCoursesForActor(
  actor: SessionUser,
  academicYearId: string,
): Promise<AulaCoursesResult> {
  let viewerEnrollmentId: string | null = null;
  let viewerLevelCode: LevelCode | null = null;
  let viewerStudentName: string | null = null;
  let viewerGroupLabel: string | null = null;

  let rawCourses: Array<{
    courseAssignmentId: string;
    subjectName: string;
    pillar: StheamiPillar;
    groupName: string;
    gradeName: string;
    gradeOrder: number;
    teacherFirst: string | null;
    teacherLast: string | null;
  }> = [];

  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    let studentId = actor.id;
    viewerStudentName = actor.firstName;
    if (actor.role === "GUARDIAN") {
      const children = await getGuardianChildren(actor.id, academicYearId);
      const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
      const child = children.find((c) => c.studentId === selectedId);
      if (!child) {
        return { courses: [], viewerLevelCode: null, viewerStudentName: null, viewerGroupLabel: null, totalPending: 0 };
      }
      studentId = child.studentId;
      viewerStudentName = child.firstName;
    }

    const placement = await getStudentPlacement(studentId, academicYearId);
    if (!placement) {
      return { courses: [], viewerLevelCode: null, viewerStudentName, viewerGroupLabel: null, totalPending: 0 };
    }
    viewerEnrollmentId = placement.enrollmentId;
    viewerLevelCode = placement.levelCode;
    viewerGroupLabel = `${placement.gradeName} · ${placement.groupName}`;

    rawCourses = await db
      .select({
        courseAssignmentId: courseAssignments.id,
        subjectName: subjects.name,
        pillar: subjects.stheamiPillar,
        groupName: groups.name,
        gradeName: grades.name,
        gradeOrder: grades.displayOrder,
        teacherFirst: users.firstName,
        teacherLast: users.lastName,
      })
      .from(courseAssignments)
      .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(users, eq(users.id, courseAssignments.teacherId))
      .where(eq(courseAssignments.groupId, placement.groupId))
      .orderBy(asc(subjects.name));
  } else {
    const scope =
      actor.role === "TEACHER"
        ? and(
            eq(courseAssignments.academicYearId, academicYearId),
            or(eq(courseAssignments.teacherId, actor.id), eq(groups.directorTeacherId, actor.id)),
          )
        : eq(courseAssignments.academicYearId, academicYearId);

    rawCourses = await db
      .select({
        courseAssignmentId: courseAssignments.id,
        subjectName: subjects.name,
        pillar: subjects.stheamiPillar,
        groupName: groups.name,
        gradeName: grades.name,
        gradeOrder: grades.displayOrder,
        teacherFirst: users.firstName,
        teacherLast: users.lastName,
      })
      .from(courseAssignments)
      .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
      .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .leftJoin(users, eq(users.id, courseAssignments.teacherId))
      .where(scope)
      .orderBy(asc(grades.displayOrder), asc(groups.name), asc(subjects.name));
  }

  if (rawCourses.length === 0) {
    return { courses: [], viewerLevelCode, viewerStudentName, viewerGroupLabel, totalPending: 0 };
  }

  const courseIds = rawCourses.map((c) => c.courseAssignmentId);

  const [themeRows, unitRows, resourceRows, activityRows] = await Promise.all([
    db
      .select()
      .from(courseThemes)
      .where(inArray(courseThemes.courseAssignmentId, courseIds)),
    db
      .select({
        courseAssignmentId: courseUnits.courseAssignmentId,
        total: sql<number>`count(*)::int`,
      })
      .from(courseUnits)
      .where(and(inArray(courseUnits.courseAssignmentId, courseIds), eq(courseUnits.isPublished, true)))
      .groupBy(courseUnits.courseAssignmentId),

    db
      .select({
        courseAssignmentId: courseUnits.courseAssignmentId,
        total: sql<number>`count(${learningResources.id})::int`,
      })
      .from(learningResources)
      .innerJoin(courseUnits, eq(courseUnits.id, learningResources.unitId))
      .where(
        and(
          inArray(courseUnits.courseAssignmentId, courseIds),
          eq(courseUnits.isPublished, true),
          eq(learningResources.isPublished, true),
        ),
      )
      .groupBy(courseUnits.courseAssignmentId),

    db
      .select({
        id: activities.id,
        type: activities.type,
        courseAssignmentId: courseUnits.courseAssignmentId,
      })
      .from(activities)
      .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
      .where(
        and(
          inArray(courseUnits.courseAssignmentId, courseIds),
          eq(courseUnits.isPublished, true),
          eq(activities.isPublished, true),
        ),
      ),
  ]);

  const themeMap = new Map(themeRows.map((t) => [t.courseAssignmentId, normalizeCourseTheme(t)]));
  const unitsMap = new Map(unitRows.map((u) => [u.courseAssignmentId, u.total]));
  const resourcesMap = new Map(resourceRows.map((r) => [r.courseAssignmentId, r.total]));
  const actCountMap = new Map<string, number>();
  const actIds = activityRows.map((a) => a.id);
  const quizIds = activityRows.filter((a) => a.type === "QUIZ").map((a) => a.id);
  const courseByAct = new Map<string, string>();
  for (const a of activityRows) {
    actCountMap.set(a.courseAssignmentId, (actCountMap.get(a.courseAssignmentId) ?? 0) + 1);
    courseByAct.set(a.id, a.courseAssignmentId);
  }

  const viewedMap = new Map<string, number>();
  const pendingMap = new Map<string, number>();

  if (viewerEnrollmentId) {
    const [views, submitted, doneQuizzes] = await Promise.all([
      db
        .select({
          courseAssignmentId: courseUnits.courseAssignmentId,
          total: sql<number>`count(${resourceViews.id})::int`,
        })
        .from(resourceViews)
        .innerJoin(learningResources, eq(learningResources.id, resourceViews.resourceId))
        .innerJoin(courseUnits, eq(courseUnits.id, learningResources.unitId))
        .where(
          and(
            eq(resourceViews.enrollmentId, viewerEnrollmentId),
            inArray(courseUnits.courseAssignmentId, courseIds),
          ),
        )
        .groupBy(courseUnits.courseAssignmentId),

      actIds.length > 0
        ? db
            .select({ activityId: submissions.activityId })
            .from(submissions)
            .where(and(eq(submissions.enrollmentId, viewerEnrollmentId), inArray(submissions.activityId, actIds)))
        : Promise.resolve([]),

      quizIds.length > 0
        ? db
            .select({ activityId: quizAttempts.activityId })
            .from(quizAttempts)
            .where(
              and(
                eq(quizAttempts.enrollmentId, viewerEnrollmentId),
                inArray(quizAttempts.activityId, quizIds),
                sql`${quizAttempts.submittedAt} is not null`,
              ),
            )
        : Promise.resolve([]),
    ]);

    for (const v of views) viewedMap.set(v.courseAssignmentId, v.total);
    const doneSet = new Set([
      ...submitted.map((s) => s.activityId),
      ...doneQuizzes.map((q) => q.activityId),
    ]);
    for (const a of activityRows) {
      if (!doneSet.has(a.id)) {
        pendingMap.set(a.courseAssignmentId, (pendingMap.get(a.courseAssignmentId) ?? 0) + 1);
      }
    }
  } else if (actIds.length > 0) {
    // Docentes y directivos: cuántas entregas están esperando calificación (`score IS NULL`).
    const ungraded = await db
      .select({
        activityId: submissions.activityId,
        total: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .where(and(inArray(submissions.activityId, actIds), sql`${submissions.score} is null`))
      .groupBy(submissions.activityId);

    for (const u of ungraded) {
      const cid = courseByAct.get(u.activityId);
      if (cid) pendingMap.set(cid, (pendingMap.get(cid) ?? 0) + u.total);
    }
  }

  const cards: AulaCourseCard[] = rawCourses.map((c) => ({
    courseAssignmentId: c.courseAssignmentId,
    subjectName: c.subjectName,
    pillar: c.pillar,
    groupName: c.groupName,
    gradeName: c.gradeName,
    teacherName: c.teacherFirst ? `${c.teacherFirst} ${c.teacherLast}` : null,
    theme: themeMap.get(c.courseAssignmentId) ?? normalizeCourseTheme(null),
    unitCount: unitsMap.get(c.courseAssignmentId) ?? 0,
    resourceCount: resourcesMap.get(c.courseAssignmentId) ?? 0,
    viewedResourceCount: viewedMap.get(c.courseAssignmentId) ?? 0,
    activityCount: actCountMap.get(c.courseAssignmentId) ?? 0,
    pendingCount: pendingMap.get(c.courseAssignmentId) ?? 0,
  }));

  const totalPending = cards.reduce((s, c) => s + c.pendingCount, 0);
  return { courses: cards, viewerLevelCode, viewerStudentName, viewerGroupLabel, totalPending };
}

/* ---------------------------------------------------------------------------
   Bandeja "¿Qué tareas tengo?" (/aula/tareas)
   --------------------------------------------------------------------------- */

export interface StudentTaskInboxItem {
  activityId: string;
  activityType: "ASSIGNMENT" | "QUIZ" | "FORUM";
  courseAssignmentId: string;
  subjectName: string;
  pillar: StheamiPillar;
  unitTitle: string;
  periodName: string;
  title: string;
  dueDate: Date | null;
  timeLimitMinutes: number | null;
  syncToSiga: boolean;
  status: "PENDING" | "SUBMITTED" | "GRADED";
  score: number | null;
  isLate: boolean;
  submittedAt: Date | null;
}

export async function listTasksInboxForActor(
  actor: SessionUser,
  academicYearId: string,
): Promise<{
  items: StudentTaskInboxItem[];
  levelCode: LevelCode | null;
  studentName: string | null;
  groupLabel: string | null;
}> {
  let studentId = actor.id;
  let studentName = actor.firstName;
  if (actor.role === "GUARDIAN") {
    const children = await getGuardianChildren(actor.id, academicYearId);
    const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
    const child = children.find((c) => c.studentId === selectedId);
    if (!child) return { items: [], levelCode: null, studentName: null, groupLabel: null };
    studentId = child.studentId;
    studentName = child.firstName;
  }

  const placement = await getStudentPlacement(studentId, academicYearId);
  if (!placement) return { items: [], levelCode: null, studentName, groupLabel: null };

  const rows = await db
    .select({
      activityId: activities.id,
      activityType: activities.type,
      courseAssignmentId: courseAssignments.id,
      subjectName: subjects.name,
      pillar: subjects.stheamiPillar,
      unitTitle: courseUnits.title,
      periodName: academicPeriods.name,
      title: activities.title,
      dueDate: activities.dueDate,
      timeLimitMinutes: activities.timeLimitMinutes,
      syncToSiga: activities.syncToSiga,
    })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, courseUnits.periodId))
    .innerJoin(courseAssignments, eq(courseAssignments.id, courseUnits.courseAssignmentId))
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .where(
      and(
        eq(courseAssignments.groupId, placement.groupId),
        eq(courseAssignments.academicYearId, academicYearId),
        eq(courseUnits.isPublished, true),
        eq(activities.isPublished, true),
      ),
    )
    .orderBy(asc(activities.dueDate), desc(activities.createdAt));

  if (rows.length === 0) {
    return {
      items: [],
      levelCode: placement.levelCode,
      studentName,
      groupLabel: `${placement.gradeName} · ${placement.groupName}`,
    };
  }

  const allIds = rows.map((r) => r.activityId);
  const [subs, attempts] = await Promise.all([
    db
      .select({
        activityId: submissions.activityId,
        score: submissions.score,
        isLate: submissions.isLate,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .where(and(eq(submissions.enrollmentId, placement.enrollmentId), inArray(submissions.activityId, allIds))),
    db
      .select({
        activityId: quizAttempts.activityId,
        finalScore: quizAttempts.finalScore,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.enrollmentId, placement.enrollmentId),
          inArray(quizAttempts.activityId, allIds),
          sql`${quizAttempts.submittedAt} is not null`,
        ),
      ),
  ]);

  const subByAct = new Map(subs.map((s) => [s.activityId, s]));
  const quizBestByAct = new Map<string, { score: number; submittedAt: Date }>();
  for (const a of attempts) {
    if (a.finalScore === null || !a.submittedAt) continue;
    const prev = quizBestByAct.get(a.activityId);
    if (!prev || a.finalScore > prev.score) {
      quizBestByAct.set(a.activityId, { score: a.finalScore, submittedAt: a.submittedAt });
    }
  }

  const items: StudentTaskInboxItem[] = rows.map((r) => {
    if (r.activityType === "QUIZ") {
      const q = quizBestByAct.get(r.activityId);
      return {
        ...r,
        status: q ? "GRADED" : "PENDING",
        score: q?.score ?? null,
        isLate: false,
        submittedAt: q?.submittedAt ?? null,
      };
    }
    const sub = subByAct.get(r.activityId);
    const status: StudentTaskInboxItem["status"] = !sub
      ? "PENDING"
      : sub.score !== null
        ? "GRADED"
        : "SUBMITTED";
    return {
      ...r,
      status,
      score: sub?.score ?? null,
      isLate: sub?.isLate ?? false,
      submittedAt: sub?.submittedAt ?? null,
    };
  });

  return {
    items,
    levelCode: placement.levelCode,
    studentName,
    groupLabel: `${placement.gradeName} · ${placement.groupName}`,
  };
}

/* ---------------------------------------------------------------------------
   Espacio del curso (/aula/[cursoId])
   --------------------------------------------------------------------------- */

export interface CourseWorkspaceUnit {
  id: string;
  title: string;
  description: string;
  resources: Array<{
    id: string;
    type: "PDF" | "VIDEO" | "LINK" | "RICH_TEXT";
    title: string;
    contentTextOrUrl: string;
    hasFile: boolean;
    fileSizeBytes: number | null;
    viewed: boolean;
  }>;
  activities: Array<{
    id: string;
    type: "ASSIGNMENT" | "QUIZ" | "FORUM";
    title: string;
    dueDate: Date | null;
    timeLimitMinutes: number | null;
    questionCount: number;
    syncToSiga: boolean;
    sigaLabel: string | null;
    studentStatus: "PENDING" | "SUBMITTED" | "GRADED" | null;
    studentScore: number | null;
    submittedCount: number;
    gradedCount: number;
  }>;
}

export interface CourseForumItem {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
}

export interface CourseWorkspaceData {
  theme: CourseThemeConfig;
  units: CourseWorkspaceUnit[];
  forumPosts: CourseForumItem[];
  totalStudents: number;
  levelCode: LevelCode;
  availableDimensions: Array<{ dimension: SieeDimension; availableWeight: number }>;
}

export async function getCourseWorkspace(
  access: AulaCourseAccess,
  periodId: string,
): Promise<CourseWorkspaceData> {
  const { course, viewerEnrollmentId, canManage } = access;

  if (canManage) {
    await ensureCompetencies(course.courseAssignmentId, periodId, course.assessmentMode);
  }

  const [themeRow, levelRow, studentCountRow, units, posts, comps, cols] = await Promise.all([
    db
      .select()
      .from(courseThemes)
      .where(eq(courseThemes.courseAssignmentId, course.courseAssignmentId))
      .limit(1),
    db
      .select({ levelCode: levels.code })
      .from(groups)
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(eq(groups.id, course.groupId))
      .limit(1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(eq(enrollments.groupId, course.groupId), eq(enrollments.status, "ACTIVE"))),
    db
      .select({
        id: courseUnits.id,
        title: courseUnits.title,
        description: courseUnits.description,
      })
      .from(courseUnits)
      .where(
        and(
          eq(courseUnits.courseAssignmentId, course.courseAssignmentId),
          eq(courseUnits.periodId, periodId),
          eq(courseUnits.isPublished, true),
        ),
      )
      .orderBy(asc(courseUnits.displayOrder), asc(courseUnits.createdAt)),
    db
      .select({
        id: forumPosts.id,
        body: forumPosts.bodySanitized,
        isPinned: forumPosts.isPinned,
        createdAt: forumPosts.createdAt,
        authorFirst: users.firstName,
        authorLast: users.lastName,
        authorRole: users.role,
      })
      .from(forumPosts)
      .innerJoin(users, eq(users.id, forumPosts.authorId))
      .where(eq(forumPosts.courseAssignmentId, course.courseAssignmentId))
      .orderBy(desc(forumPosts.isPinned), desc(forumPosts.createdAt))
      .limit(40),
    db
      .select({
        id: sieeCompetencies.id,
        dimension: sieeCompetencies.dimension,
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
        competencyId: sieeGradeColumns.competencyId,
        weightPercent: sieeGradeColumns.weightPercent,
        linkedActivityId: sieeGradeColumns.linkedActivityId,
      })
      .from(sieeGradeColumns)
      .where(
        and(
          eq(sieeGradeColumns.courseAssignmentId, course.courseAssignmentId),
          eq(sieeGradeColumns.periodId, periodId),
        ),
      ),
  ]);

  const compDimById = new Map(comps.map((c) => [c.id, c.dimension]));
  const sigaColByAct = new Map<string, string>();
  for (const col of cols) {
    if (col.linkedActivityId) {
      const dim = compDimById.get(col.competencyId);
      sigaColByAct.set(col.linkedActivityId, `${dim ?? "SIEE"} · ${col.weightPercent}%`);
    }
  }

  const availableDimensions = comps.map((c) => ({
    dimension: c.dimension,
    availableWeight: remainingWeight(cols.filter((col) => col.competencyId === c.id)),
  }));

  const unitIds = units.map((u) => u.id);
  const [resources, acts] =
    unitIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: learningResources.id,
              unitId: learningResources.unitId,
              type: learningResources.type,
              title: learningResources.title,
              contentTextOrUrl: learningResources.contentTextOrUrl,
              storageKey: learningResources.storageKey,
              fileSizeBytes: learningResources.fileSizeBytes,
            })
            .from(learningResources)
            .where(and(inArray(learningResources.unitId, unitIds), eq(learningResources.isPublished, true)))
            .orderBy(asc(learningResources.displayOrder), asc(learningResources.createdAt)),
          db
            .select({
              id: activities.id,
              type: activities.type,
              unitId: activities.unitId,
              title: activities.title,
              dueDate: activities.dueDate,
              timeLimitMinutes: activities.timeLimitMinutes,
              syncToSiga: activities.syncToSiga,
            })
            .from(activities)
            .where(and(inArray(activities.unitId, unitIds), eq(activities.isPublished, true)))
            .orderBy(asc(activities.dueDate), asc(activities.createdAt)),
        ])
      : [[], []];

  const resIds = resources.map((r) => r.id);
  const actIds = acts.map((a) => a.id);
  const quizIds = acts.filter((a) => a.type === "QUIZ").map((a) => a.id);

  const [viewedRows, mySubs, myQuizzes, subAggs, quizAggs, qCounts] = await Promise.all([
    viewerEnrollmentId && resIds.length > 0
      ? db
          .select({ resourceId: resourceViews.resourceId })
          .from(resourceViews)
          .where(and(eq(resourceViews.enrollmentId, viewerEnrollmentId), inArray(resourceViews.resourceId, resIds)))
      : Promise.resolve([]),
    viewerEnrollmentId && actIds.length > 0
      ? db
          .select({ activityId: submissions.activityId, score: submissions.score })
          .from(submissions)
          .where(and(eq(submissions.enrollmentId, viewerEnrollmentId), inArray(submissions.activityId, actIds)))
      : Promise.resolve([]),
    viewerEnrollmentId && quizIds.length > 0
      ? db
          .select({ activityId: quizAttempts.activityId, finalScore: quizAttempts.finalScore })
          .from(quizAttempts)
          .where(
            and(
              eq(quizAttempts.enrollmentId, viewerEnrollmentId),
              inArray(quizAttempts.activityId, quizIds),
              sql`${quizAttempts.submittedAt} is not null`,
            ),
          )
      : Promise.resolve([]),
    !viewerEnrollmentId && actIds.length > 0
      ? db
          .select({
            activityId: submissions.activityId,
            submittedCount: sql<number>`count(*)::int`,
            gradedCount: sql<number>`count(*) filter (where ${submissions.score} is not null)::int`,
          })
          .from(submissions)
          .where(inArray(submissions.activityId, actIds))
          .groupBy(submissions.activityId)
      : Promise.resolve([]),
    !viewerEnrollmentId && quizIds.length > 0
      ? db
          .select({
            activityId: quizAttempts.activityId,
            completedCount: sql<number>`count(distinct ${quizAttempts.enrollmentId})::int`,
          })
          .from(quizAttempts)
          .where(and(inArray(quizAttempts.activityId, quizIds), sql`${quizAttempts.submittedAt} is not null`))
          .groupBy(quizAttempts.activityId)
      : Promise.resolve([]),
    quizIds.length > 0
      ? db
          .select({
            activityId: quizQuestions.activityId,
            total: sql<number>`count(*)::int`,
          })
          .from(quizQuestions)
          .where(inArray(quizQuestions.activityId, quizIds))
          .groupBy(quizQuestions.activityId)
      : Promise.resolve([]),
  ]);

  const viewedSet = new Set(viewedRows.map((v) => v.resourceId));
  const mySubMap = new Map(mySubs.map((s) => [s.activityId, s]));
  const myQuizBestMap = new Map<string, number>();
  for (const q of myQuizzes) {
    if (q.finalScore !== null) {
      myQuizBestMap.set(q.activityId, Math.max(myQuizBestMap.get(q.activityId) ?? 0, q.finalScore));
    }
  }
  const aggMap = new Map(subAggs.map((a) => [a.activityId, a]));
  const quizAggMap = new Map(quizAggs.map((q) => [q.activityId, q.completedCount]));
  const qCountMap = new Map(qCounts.map((q) => [q.activityId, q.total]));

  return {
    theme: normalizeCourseTheme(themeRow[0] ?? null),
    levelCode: levelRow[0]?.levelCode ?? "BACHILLERATO",
    totalStudents: studentCountRow[0]?.total ?? 0,
    availableDimensions,
    units: units.map((u) => ({
      id: u.id,
      title: u.title,
      description: u.description,
      resources: resources
        .filter((r) => r.unitId === u.id)
        .map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          contentTextOrUrl: r.contentTextOrUrl,
          hasFile: Boolean(r.storageKey),
          fileSizeBytes: r.fileSizeBytes,
          viewed: viewedSet.has(r.id),
        })),
      activities: acts
        .filter((a) => a.unitId === u.id)
        .map((a) => {
          if (a.type === "QUIZ") {
            const best = myQuizBestMap.get(a.id);
            const done = quizAggMap.get(a.id) ?? 0;
            return {
              id: a.id,
              type: a.type,
              title: a.title,
              dueDate: a.dueDate,
              timeLimitMinutes: a.timeLimitMinutes,
              questionCount: qCountMap.get(a.id) ?? 0,
              syncToSiga: a.syncToSiga,
              sigaLabel: sigaColByAct.get(a.id) ?? null,
              studentStatus: viewerEnrollmentId ? (best !== undefined ? "GRADED" : "PENDING") : null,
              studentScore: best ?? null,
              submittedCount: done,
              gradedCount: done,
            };
          }
          const mySub = mySubMap.get(a.id);
          const agg = aggMap.get(a.id);
          return {
            id: a.id,
            type: a.type,
            title: a.title,
            dueDate: a.dueDate,
            timeLimitMinutes: null,
            questionCount: 0,
            syncToSiga: a.syncToSiga,
            sigaLabel: sigaColByAct.get(a.id) ?? null,
            studentStatus: viewerEnrollmentId
              ? !mySub
                ? "PENDING"
                : mySub.score !== null
                  ? "GRADED"
                  : "SUBMITTED"
              : null,
            studentScore: mySub?.score ?? null,
            submittedCount: agg?.submittedCount ?? 0,
            gradedCount: agg?.gradedCount ?? 0,
          };
        }),
    })),
    forumPosts: posts.map((p) => ({
      id: p.id,
      authorName: `${p.authorFirst} ${p.authorLast}`,
      authorRole: p.authorRole,
      body: p.body,
      isPinned: p.isPinned,
      createdAt: p.createdAt,
    })),
  };
}

/* ---------------------------------------------------------------------------
   Detalle de tarea: entregas y calificación (/aula/[cursoId]/tareas/[actividadId])
   --------------------------------------------------------------------------- */

export interface ActivitySubmissionRow {
  submissionId: string | null;
  enrollmentId: string;
  studentName: string;
  submittedAt: Date | null;
  isLate: boolean;
  textResponse: string;
  referenceUrl: string | null;
  hasAttachment: boolean;
  score: number | null;
  teacherFeedback: string | null;
  gradedAt: Date | null;
}

export interface ActivityWorkspaceData {
  activity: {
    id: string;
    unitTitle: string;
    periodId: string;
    periodName: string;
    title: string;
    instructions: string;
    dueDate: Date | null;
    maxScore: number;
    allowLate: boolean;
    syncToSiga: boolean;
    sigaLabel: string | null;
  };
  levelCode: LevelCode;
  mySubmission: ActivitySubmissionRow | null;
  rosterSubmissions: ActivitySubmissionRow[];
}

export async function getActivityWorkspace(
  access: AulaCourseAccess,
  activityId: string,
): Promise<ActivityWorkspaceData | null> {
  const [act] = await db
    .select({
      id: activities.id,
      courseAssignmentId: courseUnits.courseAssignmentId,
      unitTitle: courseUnits.title,
      periodId: courseUnits.periodId,
      periodName: academicPeriods.name,
      title: activities.title,
      instructions: activities.instructionsSanitized,
      dueDate: activities.dueDate,
      maxScore: activities.maxScore,
      allowLate: activities.allowLate,
      syncToSiga: activities.syncToSiga,
    })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, courseUnits.periodId))
    .where(and(eq(activities.id, activityId), eq(courseUnits.courseAssignmentId, access.course.courseAssignmentId)))
    .limit(1);

  if (!act) return null;

  const [levelRow, sigaCol] = await Promise.all([
    db
      .select({ levelCode: levels.code })
      .from(groups)
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .innerJoin(levels, eq(levels.id, grades.levelId))
      .where(eq(groups.id, access.course.groupId))
      .limit(1),
    db
      .select({
        weightPercent: sieeGradeColumns.weightPercent,
        dimension: sieeCompetencies.dimension,
      })
      .from(sieeGradeColumns)
      .innerJoin(sieeCompetencies, eq(sieeCompetencies.id, sieeGradeColumns.competencyId))
      .where(eq(sieeGradeColumns.linkedActivityId, act.id))
      .limit(1),
  ]);

  const sigaLabel = sigaCol[0] ? `${sigaCol[0].dimension} · ${sigaCol[0].weightPercent}%` : null;

  if (access.viewerEnrollmentId) {
    const [sub] = await db
      .select({
        id: submissions.id,
        enrollmentId: submissions.enrollmentId,
        submittedAt: submissions.submittedAt,
        isLate: submissions.isLate,
        textResponse: submissions.textResponse,
        referenceUrl: submissions.referenceUrl,
        attachmentKey: submissions.attachmentKey,
        score: submissions.score,
        teacherFeedback: submissions.teacherFeedback,
        gradedAt: submissions.gradedAt,
      })
      .from(submissions)
      .where(and(eq(submissions.activityId, act.id), eq(submissions.enrollmentId, access.viewerEnrollmentId)))
      .limit(1);

    return {
      activity: { ...act, sigaLabel },
      levelCode: levelRow[0]?.levelCode ?? "BACHILLERATO",
      mySubmission: sub
        ? {
            submissionId: sub.id,
            enrollmentId: sub.enrollmentId,
            studentName: access.viewerStudentName ?? "Estudiante",
            submittedAt: sub.submittedAt,
            isLate: sub.isLate,
            textResponse: sub.textResponse,
            referenceUrl: sub.referenceUrl,
            hasAttachment: Boolean(sub.attachmentKey),
            score: sub.score,
            teacherFeedback: sub.teacherFeedback,
            gradedAt: sub.gradedAt,
          }
        : null,
      rosterSubmissions: [],
    };
  }

  const [roster, subs] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .where(and(eq(enrollments.groupId, access.course.groupId), eq(enrollments.status, "ACTIVE")))
      .orderBy(asc(users.lastName), asc(users.firstName)),
    db
      .select({
        id: submissions.id,
        enrollmentId: submissions.enrollmentId,
        submittedAt: submissions.submittedAt,
        isLate: submissions.isLate,
        textResponse: submissions.textResponse,
        referenceUrl: submissions.referenceUrl,
        attachmentKey: submissions.attachmentKey,
        score: submissions.score,
        teacherFeedback: submissions.teacherFeedback,
        gradedAt: submissions.gradedAt,
      })
      .from(submissions)
      .where(eq(submissions.activityId, act.id)),
  ]);

  const subMap = new Map(subs.map((s) => [s.enrollmentId, s]));

  return {
    activity: { ...act, sigaLabel },
    levelCode: levelRow[0]?.levelCode ?? "BACHILLERATO",
    mySubmission: null,
    rosterSubmissions: roster.map((r) => {
      const s = subMap.get(r.enrollmentId);
      return {
        submissionId: s?.id ?? null,
        enrollmentId: r.enrollmentId,
        studentName: `${r.lastName}, ${r.firstName}`,
        submittedAt: s?.submittedAt ?? null,
        isLate: s?.isLate ?? false,
        textResponse: s?.textResponse ?? "",
        referenceUrl: s?.referenceUrl ?? null,
        hasAttachment: Boolean(s?.attachmentKey),
        score: s?.score ?? null,
        teacherFeedback: s?.teacherFeedback ?? null,
        gradedAt: s?.gradedAt ?? null,
      };
    }),
  };
}
