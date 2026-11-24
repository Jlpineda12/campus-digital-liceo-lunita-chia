import { MAX_SCORE, MIN_SCORE, roundScore } from "@/modules/siga/siee-grades/scale";

/**
 * Motor puro de autocalificación de cuestionarios (Órbita Virtual).
 * Soporta selección única, Verdadero/Falso y selección múltiple con validación
 * de reloj en servidor (30 s de gracia) y conversión a escala SIEE 1.0–5.0.
 */

export type AutoQuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE";

export interface QuizOption {
  id: string;
  label: string;
}

export interface EvaluableQuestion {
  id: string;
  questionType: AutoQuestionType;
  points: number;
  correctOptionIds: string[];
}

export interface EvaluatedQuestionResult {
  questionId: string;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
}

export interface QuizEvaluationResult {
  earnedPoints: number;
  totalPoints: number;
  percent: number;
  sieeScore: number;
  correctCount: number;
  totalQuestions: number;
  perQuestion: EvaluatedQuestionResult[];
}

/** Gracia en milisegundos para latencia de red al enviar un cuestionario temporizado. */
export const QUIZ_TIMER_GRACE_MS = 30_000;

export function isQuizWithinTimeLimit(options: {
  startedAt: Date;
  submittedAt: Date;
  timeLimitMinutes: number | null;
}): boolean {
  if (!options.timeLimitMinutes || options.timeLimitMinutes <= 0) return true;
  const elapsedMs = options.submittedAt.getTime() - options.startedAt.getTime();
  return elapsedMs <= options.timeLimitMinutes * 60_000 + QUIZ_TIMER_GRACE_MS;
}

/** Convierte porcentaje de acierto (0..1) a escala institucional SIEE (1.0 – 5.0). */
export function quizRatioToSieeScore(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return roundScore(MIN_SCORE + clamped * (MAX_SCORE - MIN_SCORE));
}

export function evaluateQuizAttempt(
  questions: readonly EvaluableQuestion[],
  answersByQuestionId: Record<string, string[]>,
): QuizEvaluationResult {
  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;

  const perQuestion: EvaluatedQuestionResult[] = questions.map((q) => {
    const maxPoints = Math.max(0.5, Number(q.points) || 1);
    totalPoints += maxPoints;

    const selected = [...new Set(answersByQuestionId[q.id] ?? [])].sort();
    const expected = [...new Set(q.correctOptionIds)].sort();

    let isCorrect = false;
    let earned = 0;

    if (expected.length > 0) {
      if (q.questionType === "MULTI_CHOICE") {
        // Selección múltiple: exacto = 100%, sin selecciones incorrectas otorga crédito proporcional.
        const expectedSet = new Set(expected);
        const wrongCount = selected.filter((id) => !expectedSet.has(id)).length;
        const rightCount = selected.filter((id) => expectedSet.has(id)).length;
        if (wrongCount === 0 && rightCount === expected.length) {
          isCorrect = true;
          earned = maxPoints;
        } else if (wrongCount === 0 && rightCount > 0) {
          earned = Math.round((maxPoints * (rightCount / expected.length)) * 100) / 100;
        }
      } else {
        isCorrect = selected.length === 1 && expected.length === 1 && selected[0] === expected[0];
        earned = isCorrect ? maxPoints : 0;
      }
    }

    if (isCorrect) correctCount += 1;
    earnedPoints += earned;

    return {
      questionId: q.id,
      selectedOptionIds: selected,
      correctOptionIds: expected,
      isCorrect,
      earnedPoints: earned,
      maxPoints,
    };
  });

  const ratio = totalPoints > 0 ? earnedPoints / totalPoints : 0;
  return {
    earnedPoints: Math.round(earnedPoints * 100) / 100,
    totalPoints: Math.round(totalPoints * 100) / 100,
    percent: Math.round(ratio * 100),
    sieeScore: quizRatioToSieeScore(ratio),
    correctCount,
    totalQuestions: questions.length,
    perQuestion,
  };
}
