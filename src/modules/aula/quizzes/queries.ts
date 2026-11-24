import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  academicPeriods,
  activities,
  courseUnits,
  enrollments,
  grades,
  groups,
  levels,
  quizAttempts,
  quizQuestions,
  sieeCompetencies,
  sieeGradeColumns,
  users,
} from "@/db/schema";
import type { LevelCode } from "@/modules/core/academic-structure/constants";
import type { AulaCourseAccess } from "../access";
import {
  evaluateQuizAttempt,
  type AutoQuestionType,
  type QuizEvaluationResult,
  type QuizOption,
} from "./evaluator";

export interface StudentQuizQuestionView {
  id: string;
  questionType: AutoQuestionType;
  prompt: string;
  hasImage: boolean;
  imageAlt: string;
  options: QuizOption[];
  points: number;
  /** Solo se envía a docentes o al estudiante DESPUÉS de finalizar un intento. */
  correctOptionIds?: string[];
}

export interface StudentQuizAttemptSummary {
  id: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  finalScore: number | null;
  answersByQuestion: Record<string, string[]>;
  evaluation: QuizEvaluationResult | null;
}

export interface TeacherQuizRosterRow {
  enrollmentId: string;
  studentName: string;
  attemptsUsed: number;
  bestScore: number | null;
  lastSubmittedAt: Date | null;
}

export interface QuizQuestionStat {
  questionId: string;
  prompt: string;
  accuracyPercent: number;
  answeredCount: number;
}

export interface QuizWorkspaceData {
  quiz: {
    id: string;
    unitTitle: string;
    periodId: string;
    periodName: string;
    title: string;
    instructions: string;
    dueDate: Date | null;
    timeLimitMinutes: number | null;
    maxAttempts: number;
    syncToSiga: boolean;
    sigaLabel: string | null;
  };
  levelCode: LevelCode;
  questions: StudentQuizQuestionView[];
  /** Intento actualmente abierto del estudiante (si ya comenzó y no ha enviado). */
  activeAttempt: StudentQuizAttemptSummary | null;
  /** Intentos ya finalizados del estudiante (del más reciente al más antiguo). */
  completedAttempts: StudentQuizAttemptSummary[];
  /** Resumen y estadísticas por pregunta (solo para docentes y directivos). */
  roster: TeacherQuizRosterRow[];
  questionStats: QuizQuestionStat[];
}

function parseOptionsJson(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { id: string; label: string } =>
        Boolean(item && typeof item === "object" && "id" in item && "label" in item),
    )
    .map((item) => ({ id: String(item.id), label: String(item.label) }));
}

function parseStringArrayJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v));
}

function parseAnswersJson(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.map(String);
  }
  return out;
}

/** Carga el espacio de cuestionario ocultando respuestas correctas mientras haya intento abierto. */
export async function getQuizWorkspace(
  access: AulaCourseAccess,
  activityId: string,
): Promise<QuizWorkspaceData | null> {
  const [act] = await db
    .select({
      id: activities.id,
      type: activities.type,
      unitTitle: courseUnits.title,
      periodId: courseUnits.periodId,
      periodName: academicPeriods.name,
      title: activities.title,
      instructions: activities.instructionsSanitized,
      dueDate: activities.dueDate,
      timeLimitMinutes: activities.timeLimitMinutes,
      maxAttempts: activities.maxAttempts,
      syncToSiga: activities.syncToSiga,
    })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, courseUnits.periodId))
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.type, "QUIZ"),
        eq(courseUnits.courseAssignmentId, access.course.courseAssignmentId),
      ),
    )
    .limit(1);

  if (!act) return null;

  const [levelRow, sigaCol, rawQuestions] = await Promise.all([
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
    db
      .select({
        id: quizQuestions.id,
        questionType: quizQuestions.questionType,
        prompt: quizQuestions.promptSanitized,
        imageStorageKey: quizQuestions.imageStorageKey,
        imageAlt: quizQuestions.imageAlt,
        optionsJson: quizQuestions.optionsJson,
        correctAnswerJson: quizQuestions.correctAnswerJson,
        points: quizQuestions.points,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.activityId, act.id))
      .orderBy(asc(quizQuestions.displayOrder)),
  ]);

  const sigaLabel = sigaCol[0] ? `${sigaCol[0].dimension} · ${sigaCol[0].weightPercent}%` : null;
  const evaluableQuestions = rawQuestions
    .filter((q) => q.questionType !== "SHORT_TEXT")
    .map((q) => ({
      id: q.id,
      questionType: q.questionType as AutoQuestionType,
      prompt: q.prompt,
      hasImage: Boolean(q.imageStorageKey),
      imageAlt: q.imageAlt,
      options: parseOptionsJson(q.optionsJson),
      correctOptionIds: parseStringArrayJson(q.correctAnswerJson),
      points: Number(q.points) || 1,
    }));

  // Rama Estudiante / Acudiente
  if (access.viewerEnrollmentId) {
    const attempts = await db
      .select({
        id: quizAttempts.id,
        attemptNumber: quizAttempts.attemptNumber,
        startedAt: quizAttempts.startedAt,
        submittedAt: quizAttempts.submittedAt,
        answersJson: quizAttempts.answersJson,
        finalScore: quizAttempts.finalScore,
      })
      .from(quizAttempts)
      .where(
        and(eq(quizAttempts.activityId, act.id), eq(quizAttempts.enrollmentId, access.viewerEnrollmentId)),
      )
      .orderBy(desc(quizAttempts.attemptNumber));

    const openRaw = attempts.find((a) => a.submittedAt === null) ?? null;
    const doneRaw = attempts.filter((a) => a.submittedAt !== null);

    // SEGURIDAD: si hay intento abierto, JAMÁS exponer `correctOptionIds` al navegador del estudiante.
    const revealAnswers = !openRaw && doneRaw.length > 0;

    return {
      quiz: {
        id: act.id,
        unitTitle: act.unitTitle,
        periodId: act.periodId,
        periodName: act.periodName,
        title: act.title,
        instructions: act.instructions,
        dueDate: act.dueDate,
        timeLimitMinutes: act.timeLimitMinutes,
        maxAttempts: act.maxAttempts,
        syncToSiga: act.syncToSiga,
        sigaLabel,
      },
      levelCode: levelRow[0]?.levelCode ?? "BACHILLERATO",
      questions: evaluableQuestions.map((q) => ({
        id: q.id,
        questionType: q.questionType,
        prompt: q.prompt,
        hasImage: q.hasImage,
        imageAlt: q.imageAlt,
        options: q.options,
        points: q.points,
        ...(revealAnswers ? { correctOptionIds: q.correctOptionIds } : {}),
      })),
      activeAttempt: openRaw
        ? {
            id: openRaw.id,
            attemptNumber: openRaw.attemptNumber,
            startedAt: openRaw.startedAt,
            submittedAt: null,
            finalScore: null,
            answersByQuestion: parseAnswersJson(openRaw.answersJson),
            evaluation: null,
          }
        : null,
      completedAttempts: doneRaw.map((a) => {
        const answers = parseAnswersJson(a.answersJson);
        return {
          id: a.id,
          attemptNumber: a.attemptNumber,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          finalScore: a.finalScore,
          answersByQuestion: answers,
          evaluation: revealAnswers ? evaluateQuizAttempt(evaluableQuestions, answers) : null,
        };
      }),
      roster: [],
      questionStats: [],
    };
  }

  // Rama Docente / Directivos: resultados del grupo y precisión por pregunta
  const [roster, allAttempts] = await Promise.all([
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
        enrollmentId: quizAttempts.enrollmentId,
        submittedAt: quizAttempts.submittedAt,
        answersJson: quizAttempts.answersJson,
        finalScore: quizAttempts.finalScore,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.activityId, act.id)),
  ]);

  const completedAll = allAttempts.filter((a) => a.submittedAt !== null);
  const byEnrollment = new Map<string, typeof completedAll>();
  for (const a of completedAll) {
    const list = byEnrollment.get(a.enrollmentId) ?? [];
    list.push(a);
    byEnrollment.set(a.enrollmentId, list);
  }

  const questionRight = new Map<string, number>();
  const questionTotal = new Map<string, number>();
  for (const a of completedAll) {
    const evalRes = evaluateQuizAttempt(evaluableQuestions, parseAnswersJson(a.answersJson));
    for (const pq of evalRes.perQuestion) {
      questionTotal.set(pq.questionId, (questionTotal.get(pq.questionId) ?? 0) + 1);
      if (pq.isCorrect) questionRight.set(pq.questionId, (questionRight.get(pq.questionId) ?? 0) + 1);
    }
  }

  return {
    quiz: {
      id: act.id,
      unitTitle: act.unitTitle,
      periodId: act.periodId,
      periodName: act.periodName,
      title: act.title,
      instructions: act.instructions,
      dueDate: act.dueDate,
      timeLimitMinutes: act.timeLimitMinutes,
      maxAttempts: act.maxAttempts,
      syncToSiga: act.syncToSiga,
      sigaLabel,
    },
    levelCode: levelRow[0]?.levelCode ?? "BACHILLERATO",
    questions: evaluableQuestions.map((q) => ({
      id: q.id,
      questionType: q.questionType,
      prompt: q.prompt,
      hasImage: q.hasImage,
      imageAlt: q.imageAlt,
      options: q.options,
      points: q.points,
      correctOptionIds: q.correctOptionIds,
    })),
    activeAttempt: null,
    completedAttempts: [],
    roster: roster.map((r) => {
      const list = byEnrollment.get(r.enrollmentId) ?? [];
      const scores = list.map((x) => x.finalScore).filter((s): s is number => s !== null);
      const last = list.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0];
      return {
        enrollmentId: r.enrollmentId,
        studentName: `${r.lastName}, ${r.firstName}`,
        attemptsUsed: list.length,
        bestScore: scores.length > 0 ? Math.max(...scores) : null,
        lastSubmittedAt: last?.submittedAt ?? null,
      };
    }),
    questionStats: evaluableQuestions.map((q) => {
      const answeredCount = questionTotal.get(q.id) ?? 0;
      const rightCount = questionRight.get(q.id) ?? 0;
      return {
        questionId: q.id,
        prompt: q.prompt,
        answeredCount,
        accuracyPercent: answeredCount > 0 ? Math.round((rightCount / answeredCount) * 100) : 0,
      };
    }),
  };
}
