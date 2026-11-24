"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Link2,
  Maximize2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import type { AulaActionState } from "@/modules/aula/actions";
import { startQuizAttemptAction, submitQuizAttemptAction } from "@/modules/aula/quizzes/actions";
import type {
  QuizWorkspaceData,
  StudentQuizAttemptSummary,
  StudentQuizQuestionView,
} from "@/modules/aula/quizzes/queries";
import type { SieeScale } from "@/modules/siga/siee-grades/scale";

const INITIAL: AulaActionState = { status: "idle" };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Anillo SVG de calificación SIEE (1.0–5.0) con acento cromático accesible. */
function ScoreRingSvg({ score, percent }: { score: number; percent: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const strokeColor =
    score >= 4.6 ? "#2F7D00" : score >= 4.0 ? "#0369A1" : score >= 3.0 ? "#B45309" : "#B91C1C";

  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <svg viewBox="0 0 108 108" className="size-28 -rotate-90" aria-hidden="true">
        <circle cx="54" cy="54" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="9" />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span className="block text-2xl leading-none font-black text-navy tabular-nums">
            {score.toFixed(1)}
          </span>
          <span className="mt-0.5 block text-[0.68rem] font-bold text-muted tabular-nums">
            {clamped}%
          </span>
        </div>
      </div>
    </div>
  );
}

/** Revisión detallada pregunta por pregunta de un intento ya calificado. */
function AttemptReviewCard({
  attempt,
  questions,
  syncToSiga,
  scale,
}: {
  attempt: StudentQuizAttemptSummary;
  questions: StudentQuizQuestionView[];
  syncToSiga: boolean;
  scale: SieeScale;
}) {
  const evaluation = attempt.evaluation;
  const score = attempt.finalScore ?? evaluation?.sieeScore ?? 1.0;
  const percent = evaluation?.percent ?? 0;
  const correctCount = evaluation?.perQuestion.filter((p) => p.isCorrect).length ?? 0;

  return (
    <section aria-label="Resultado del cuestionario" className="grid gap-5">
      <div className="card flex flex-wrap items-center justify-between gap-5 bg-white">
        <div className="flex items-center gap-4">
          <ScoreRingSvg score={score} percent={percent} />
          <div>
            <p className="text-xs font-extrabold tracking-wider text-sky-solid uppercase">
              Intento #{attempt.attemptNumber}
              {attempt.submittedAt ? ` · ${dateFormat.format(attempt.submittedAt)}` : ""}
            </p>
            <h2 className="mt-0.5 text-xl font-black text-navy">
              {score >= 4.6
                ? "¡Desempeño sobresaliente!"
                : score >= 4.0
                  ? "¡Muy buen trabajo!"
                  : score >= 3.0
                    ? "Cuestionario aprobado"
                    : "Sigue practicando, puedes mejorar"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Acertaste <strong className="text-navy">{correctCount}</strong> de{" "}
              <strong className="text-navy">{questions.length}</strong>{" "}
              {questions.length === 1 ? "pregunta" : "preguntas"}
              {evaluation
                ? ` (${evaluation.earnedPoints}/${evaluation.totalPoints} pts).`
                : "."}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <PerformanceBadge score={score} scale={scale} />
              {syncToSiga && (
                <Chip tone="sky">
                  <Link2 aria-hidden /> Sincronizado con SIGA
                </Chip>
              )}
            </div>
          </div>
        </div>
      </div>

      {evaluation && (
        <div className="grid gap-3">
          <h3 className="px-1 text-xs font-extrabold tracking-wider text-muted uppercase">
            Revisión paso a paso
          </h3>
          <ol className="grid gap-3">
            {questions.map((q, index) => {
              const res = evaluation.perQuestion.find((p) => p.questionId === q.id);
              const chosen = new Set(attempt.answersByQuestion[q.id] ?? []);
              const correct = new Set(q.correctOptionIds ?? []);
              const isOk = res?.isCorrect ?? false;

              return (
                <li key={q.id} className="card grid gap-3 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-black text-white ${
                          isOk ? "bg-green-solid" : "bg-red-solid"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <p className="text-sm font-bold text-navy">{q.prompt}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        isOk ? "bg-green-l text-green-solid" : "bg-red-l text-red-solid"
                      }`}
                    >
                      {isOk ? (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      ) : (
                        <XCircle className="size-3.5" aria-hidden />
                      )}
                      {res?.earnedPoints ?? 0}/{q.points} pts
                    </span>
                  </div>

                  {q.hasImage && (
                    <div className="pl-8">
                      <figure className="inline-block max-w-md overflow-hidden rounded-control border border-line bg-bg-2/50 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/aula/archivos?tipo=quiz-imagen&id=${q.id}`}
                          alt={q.imageAlt || `Imagen de apoyo de la pregunta ${index + 1}`}
                          className="max-h-52 w-auto max-w-full rounded bg-white object-contain"
                        />
                        {q.imageAlt && (
                          <figcaption className="mt-1.5 text-[0.7rem] text-muted">{q.imageAlt}</figcaption>
                        )}
                      </figure>
                    </div>
                  )}

                  <ul className="grid gap-1.5 pl-8">
                    {q.options.map((opt, optIdx) => {
                      const wasChosen = chosen.has(opt.id);
                      const isRight = correct.has(opt.id);
                      let style = "border-line bg-white text-ink-2";
                      if (isRight && wasChosen) {
                        style = "border-green-solid/50 bg-green-l/60 text-navy font-semibold";
                      } else if (isRight) {
                        style = "border-green-solid/40 bg-green-l/35 text-navy";
                      } else if (wasChosen) {
                        style = "border-red-solid/45 bg-red-l/60 text-red-solid font-semibold";
                      }

                      return (
                        <li
                          key={opt.id}
                          className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-xs ${style}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-black text-muted">{LETTERS[optIdx] ?? "•"}.</span>
                            <span>{opt.label}</span>
                          </span>
                          <span className="shrink-0 text-[0.7rem] font-bold">
                            {isRight && wasChosen
                              ? "Tu respuesta · Correcta"
                              : isRight
                                ? "Respuesta correcta"
                                : wasChosen
                                  ? "Tu respuesta"
                                  : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

/** Experiencia interactiva de cuestionario para estudiantes y vista de resultados para acudientes. */
export function QuizPlayer({
  courseAssignmentId,
  workspace,
  canSubmit,
  isGuardian,
  scale,
}: {
  courseAssignmentId: string;
  workspace: QuizWorkspaceData;
  canSubmit: boolean;
  isGuardian: boolean;
  scale: SieeScale;
}) {
  const { quiz, questions, activeAttempt, completedAttempts } = workspace;
  const [startState, startAction, starting] = useActionState(startQuizAttemptAction, INITIAL);

  // Estado del runner en vivo
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(
    () => activeAttempt?.answersByQuestion ?? {},
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [submitState, setSubmitState] = useState<AulaActionState>(INITIAL);
  const [submitting, startSubmitTransition] = useTransition();
  const autoSubmittedRef = useRef(false);

  const deadlineMs = useMemo(() => {
    if (!activeAttempt || !quiz.timeLimitMinutes) return null;
    return new Date(activeAttempt.startedAt).getTime() + quiz.timeLimitMinutes * 60_000;
  }, [activeAttempt, quiz.timeLimitMinutes]);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!deadlineMs) return null;
    return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  });

  const handleSubmitAttempt = useCallback(() => {
    if (!activeAttempt || submitting) return;
    setConfirmOpen(false);
    startSubmitTransition(async () => {
      const res = await submitQuizAttemptAction({
        courseAssignmentId,
        activityId: quiz.id,
        attemptId: activeAttempt.id,
        answersByQuestion: answers,
      });
      setSubmitState(res);
      if (res.status === "success") {
        emitToast({ title: "¡Cuestionario calificado!", description: res.message, tone: "success" });
      } else if (res.status === "error" && res.message) {
        emitToast({ title: "Revisa tu envío", description: res.message, tone: "error" });
      }
    });
  }, [activeAttempt, answers, courseAssignmentId, quiz.id, submitting]);

  // Temporizador en vivo con auto-envío al agotarse el tiempo
  useEffect(() => {
    if (!deadlineMs || !activeAttempt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        handleSubmitAttempt();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineMs, activeAttempt, handleSubmitAttempt]);

  /* -------------------------------------------------------------------------
     MODO 1: INTENTO ACTIVO EN CURSO (Runner enfocado sin distracciones)
     ------------------------------------------------------------------------- */
  if (activeAttempt && questions.length > 0) {
    const safeIdx = Math.min(currentIndex, questions.length - 1);
    const currentQ = questions[safeIdx]!;
    const selectedIds = answers[currentQ.id] ?? [];
    const answeredCount = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
    const progressPct = Math.round((answeredCount / questions.length) * 100);
    const isMulti = currentQ.questionType === "MULTI_CHOICE";
    const isLowTime = secondsLeft !== null && secondsLeft <= 120;

    function toggleOption(optionId: string) {
      setAnswers((prev) => {
        const cur = prev[currentQ.id] ?? [];
        if (isMulti) {
          const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
          return { ...prev, [currentQ.id]: next };
        }
        return { ...prev, [currentQ.id]: [optionId] };
      });
    }

    return (
      <section aria-label="Cuestionario en curso" className="grid gap-5">
        {/* Barra de estado fija: progreso + reloj + navegador rápido */}
        <div className="card grid gap-3.5 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-pill bg-navy px-2.5 py-1 text-xs font-extrabold text-white tabular-nums">
                Pregunta {safeIdx + 1} de {questions.length}
              </span>
              <span className="text-xs font-semibold text-muted tabular-nums">
                {answeredCount}/{questions.length} respondidas
              </span>
            </div>

            {secondsLeft !== null && (
              <div
                aria-live="polite"
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-black tabular-nums ${
                  isLowTime
                    ? "border-red-solid/40 bg-red-l text-red-solid"
                    : "border-line-2 bg-cloud text-navy"
                }`}
              >
                <Clock className="size-3.5" aria-hidden />
                {formatCountdown(secondsLeft)}
              </div>
            )}
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-cobalt transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Pastillas de navegación entre preguntas */}
          <nav aria-label="Ir a la pregunta" className="flex flex-wrap gap-1.5">
            {questions.map((q, idx) => {
              const isCurrent = idx === safeIdx;
              const isAnswered = (answers[q.id]?.length ?? 0) > 0;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Pregunta ${idx + 1}${isAnswered ? " (respondida)" : ""}`}
                  className={`grid size-8 place-items-center rounded-control border text-xs font-extrabold tabular-nums transition-colors ${
                    isCurrent
                      ? "border-navy bg-navy text-white"
                      : isAnswered
                        ? "border-green-solid/45 bg-green-l text-green-solid hover:bg-green-l/80"
                        : "border-line-2 bg-white text-muted hover:border-sky-solid hover:text-navy"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tarjeta protagonista de la pregunta */}
        <article className="card grid gap-5 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chip tone={isMulti ? "purple" : "sky"}>
              {isMulti
                ? "Selección múltiple · marca todas las correctas"
                : currentQ.questionType === "TRUE_FALSE"
                  ? "Verdadero o Falso"
                  : "Selección única"}
            </Chip>
            <span className="text-xs font-bold text-muted tabular-nums">
              {currentQ.points} {currentQ.points === 1 ? "punto" : "puntos"}
            </span>
          </div>

          <h2 className="text-lg leading-snug font-bold text-navy">{currentQ.prompt}</h2>

          {currentQ.hasImage && (
            <figure className="overflow-hidden rounded-card border border-line bg-bg-2/60 p-3">
              <div className="relative flex justify-center rounded-control bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/aula/archivos?tipo=quiz-imagen&id=${currentQ.id}`}
                  alt={currentQ.imageAlt || `Imagen del ejercicio de la pregunta ${safeIdx + 1}`}
                  className="max-h-72 w-auto max-w-full cursor-zoom-in rounded object-contain"
                  onClick={() =>
                    setZoomImage({
                      src: `/api/aula/archivos?tipo=quiz-imagen&id=${currentQ.id}`,
                      alt: currentQ.imageAlt || `Imagen del ejercicio — Pregunta ${safeIdx + 1}`,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setZoomImage({
                      src: `/api/aula/archivos?tipo=quiz-imagen&id=${currentQ.id}`,
                      alt: currentQ.imageAlt || `Imagen del ejercicio — Pregunta ${safeIdx + 1}`,
                    })
                  }
                  className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-pill bg-navy/85 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-navy"
                >
                  <Maximize2 className="size-3.5" aria-hidden /> Ampliar imagen
                </button>
              </div>
              {currentQ.imageAlt && (
                <figcaption className="mt-2 text-center text-xs font-medium text-muted">
                  {currentQ.imageAlt}
                </figcaption>
              )}
            </figure>
          )}

          <div className="grid gap-2.5" role="group" aria-label="Opciones de respuesta">
            {currentQ.options.map((opt, optIdx) => {
              const selected = selectedIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleOption(opt.id)}
                  className={`flex w-full items-center gap-3.5 rounded-card border-2 px-4 py-3.5 text-left transition-all ${
                    selected
                      ? "border-cobalt bg-sky-l/40 shadow-xs"
                      : "border-line bg-white hover:border-sky-solid/60 hover:bg-cloud/60"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-control text-xs font-black transition-colors ${
                      selected
                        ? "bg-cobalt text-white"
                        : "bg-cloud text-navy"
                    }`}
                  >
                    {selected ? <Check className="size-4" aria-hidden /> : LETTERS[optIdx] ?? optIdx + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-navy">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {submitState.message && (
            <p
              role={submitState.status === "error" ? "alert" : "status"}
              className={`text-sm font-semibold ${
                submitState.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {submitState.message}
            </p>
          )}

          {/* Confirmación inline antes de finalizar */}
          {confirmOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-orange-solid/40 bg-orange-l/45 px-4 py-3">
              <div className="flex items-start gap-2 text-xs text-navy">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-solid" aria-hidden />
                <p>
                  {answeredCount < questions.length ? (
                    <>
                      Tienes <strong>{questions.length - answeredCount}</strong>{" "}
                      {questions.length - answeredCount === 1
                        ? "pregunta sin responder"
                        : "preguntas sin responder"}
                      . ¿Deseas finalizar y calificar ahora?
                    </>
                  ) : (
                    <>Has respondido todas las preguntas. ¿Listo para enviar y ver tu nota al instante?</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className={pillButtonClass({ variant: "outline", size: "sm" })}
                >
                  Revisar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitAttempt}
                  className={pillButtonClass({ variant: "navy", size: "sm" })}
                >
                  <Send aria-hidden /> {submitting ? "Calificando…" : "Sí, enviar ahora"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <button
                type="button"
                disabled={safeIdx === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <ArrowLeft aria-hidden /> Anterior
              </button>

              <div className="flex items-center gap-2">
                {safeIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className={pillButtonClass({ variant: "navy", size: "sm" })}
                  >
                    Siguiente <ArrowRight aria-hidden />
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmOpen(true)}
                  className={pillButtonClass({
                    variant: safeIdx === questions.length - 1 ? "navy" : "outline",
                    size: "sm",
                  })}
                >
                  <Send aria-hidden /> Finalizar y calificar
                </button>
              </div>
            </div>
          )}
        </article>

        {/* Modal lightbox para ver la imagen del ejercicio en tamaño completo */}
        {zoomImage && (
          <div
            className="fixed inset-0 z-60 grid place-items-center bg-navy/75 p-4 backdrop-blur-xs"
            onClick={() => setZoomImage(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={zoomImage.alt}
              onClick={(e) => e.stopPropagation()}
              className="card max-h-[92dvh] max-w-4xl overflow-auto bg-white p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-navy">{zoomImage.alt}</p>
                <button
                  type="button"
                  onClick={() => setZoomImage(null)}
                  aria-label="Cerrar visor de imagen"
                  className="grid size-8 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomImage.src}
                alt={zoomImage.alt}
                className="mx-auto max-h-[78dvh] w-auto max-w-full rounded object-contain"
              />
            </div>
          </div>
        )}
      </section>
    );
  }

  /* -------------------------------------------------------------------------
     MODO 2: PORTADA DE INICIO + RESULTADOS DE INTENTOS COMPLETADOS
     ------------------------------------------------------------------------- */
  const attemptsUsed = completedAttempts.length;
  const remainingAttempts = Math.max(0, quiz.maxAttempts - attemptsUsed);
  const bestAttempt = completedAttempts.reduce<StudentQuizAttemptSummary | null>((best, curr) => {
    if (!best) return curr;
    return (curr.finalScore ?? 0) > (best.finalScore ?? 0) ? curr : best;
  }, null);
  const latestAttempt = completedAttempts[0] ?? null;

  return (
    <div className="grid gap-6">
      {/* Tarjeta de presentación / inicio */}
      <section aria-label="Resumen del cuestionario" className="card grid gap-5 bg-white">
        <div className="grid divide-y divide-line rounded-control border border-line bg-bg-2/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <p className="text-[0.68rem] font-bold tracking-wider text-muted uppercase">Preguntas</p>
            <p className="mt-1 text-lg font-black text-navy tabular-nums">{questions.length}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.68rem] font-bold tracking-wider text-muted uppercase">Tiempo límite</p>
            <p className="mt-1 text-lg font-black text-navy tabular-nums">
              {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Sin límite"}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.68rem] font-bold tracking-wider text-muted uppercase">Intentos</p>
            <p className="mt-1 text-lg font-black text-navy tabular-nums">
              {attemptsUsed}/{quiz.maxAttempts}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.68rem] font-bold tracking-wider text-muted uppercase">Mejor nota</p>
            <p className="mt-1 text-lg font-black text-navy tabular-nums">
              {bestAttempt?.finalScore != null ? bestAttempt.finalScore.toFixed(1) : "—"}
            </p>
          </div>
        </div>

        {quiz.instructions && (
          <div className="rounded-control border border-line bg-cloud/50 px-4 py-3 text-sm leading-relaxed text-ink-2">
            <p className="whitespace-pre-line">{quiz.instructions}</p>
          </div>
        )}

        {isGuardian && (
          <p className="text-xs text-muted">
            Vista de seguimiento para acudientes. El estudiante presenta el cuestionario desde su cuenta y aquí podrás
            revisar su calificación y retroalimentación inmediata.
          </p>
        )}

        {canSubmit && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles className="size-4 text-cobalt" aria-hidden />
              <span>
                Calificación instantánea en escala SIEE (1.0 a 5.0)
                {quiz.syncToSiga ? " y sincronización directa con tu boletín SIGA." : "."}
              </span>
            </div>

            {questions.length === 0 ? (
              <Chip tone="orange">El docente aún está cargando las preguntas</Chip>
            ) : remainingAttempts > 0 ? (
              <form action={startAction}>
                <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
                <input type="hidden" name="activityId" value={quiz.id} />
                <button type="submit" disabled={starting} className={pillButtonClass({ variant: "navy" })}>
                  {attemptsUsed > 0 ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
                  {starting
                    ? "Preparando…"
                    : attemptsUsed > 0
                      ? `Intentar nuevamente (${remainingAttempts} disp.)`
                      : "Comenzar cuestionario"}
                </button>
              </form>
            ) : (
              <Chip tone="green">
                <Award aria-hidden /> Intentos completados
              </Chip>
            )}
          </div>
        )}

        {(startState.message || submitState.message) && (
          <p
            role={(startState.status === "error" || submitState.status === "error") ? "alert" : "status"}
            className={`text-sm font-semibold ${
              startState.status === "error" || submitState.status === "error"
                ? "text-red-solid"
                : "text-green-solid"
            }`}
          >
            {submitState.message || startState.message}
          </p>
        )}
      </section>

      {latestAttempt && (
        <AttemptReviewCard
          attempt={latestAttempt}
          questions={questions}
          syncToSiga={quiz.syncToSiga}
          scale={scale}
        />
      )}
    </div>
  );
}
