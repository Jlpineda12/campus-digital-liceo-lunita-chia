"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  ImagePlus,
  ListChecks,
  Maximize2,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import type { AulaActionState } from "@/modules/aula/actions";
import { addQuizQuestionAction, deleteQuizQuestionAction } from "@/modules/aula/quizzes/actions";
import type { AutoQuestionType } from "@/modules/aula/quizzes/evaluator";
import type { QuizWorkspaceData } from "@/modules/aula/quizzes/queries";
import type { SieeScale } from "@/modules/siga/siee-grades/scale";

const INITIAL: AulaActionState = { status: "idle" };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

const TYPE_LABELS: Record<AutoQuestionType, string> = {
  SINGLE_CHOICE: "Selección única",
  TRUE_FALSE: "Verdadero / Falso",
  MULTI_CHOICE: "Selección múltiple",
};

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

interface DraftOption {
  id: string;
  label: string;
}

function defaultOptionsFor(type: AutoQuestionType): DraftOption[] {
  if (type === "TRUE_FALSE") {
    return [
      { id: "opt-true", label: "Verdadero" },
      { id: "opt-false", label: "Falso" },
    ];
  }
  return [
    { id: "opt-a", label: "" },
    { id: "opt-b", label: "" },
    { id: "opt-c", label: "" },
    { id: "opt-d", label: "" },
  ];
}

function DeleteQuestionButton({
  courseAssignmentId,
  questionId,
}: {
  courseAssignmentId: string;
  questionId: string;
}) {
  const [state, action, pending] = useActionState(deleteQuizQuestionAction, INITIAL);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      emitToast({ title: "Pregunta eliminada del cuestionario", tone: "info" });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "No pudimos quitar la pregunta", description: state.message, tone: "error" });
    }
  }, [state]);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 rounded-control border border-red-solid/35 bg-red-l/45 px-2.5 py-1">
        <span className="text-[0.7rem] font-bold text-navy">¿Quitar?</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-control px-1.5 py-0.5 text-[0.7rem] font-semibold text-navy hover:bg-white"
        >
          No
        </button>
        <form action={action}>
          <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
          <input type="hidden" name="questionId" value={questionId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-red-solid px-2 py-0.5 text-[0.7rem] font-bold text-white hover:brightness-95"
          >
            {pending ? "…" : "Sí"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Eliminar pregunta"
      className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-red-l hover:text-red-solid"
    >
      <Trash2 className="size-3.5" aria-hidden />
      Quitar
    </button>
  );
}

/** Constructor rápido de preguntas y analítica visual del cuestionario para docentes y directivos. */
export function QuizBuilderPanel({
  courseAssignmentId,
  workspace,
  canManage,
  scale,
}: {
  courseAssignmentId: string;
  workspace: QuizWorkspaceData;
  canManage: boolean;
  scale: SieeScale;
}) {
  const { quiz, questions, roster, questionStats } = workspace;
  const [composerOpen, setComposerOpen] = useState(questions.length === 0 && canManage);
  const [questionType, setQuestionType] = useState<AutoQuestionType>("SINGLE_CHOICE");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState("1");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [options, setOptions] = useState<DraftOption[]>(() => defaultOptionsFor("SINGLE_CHOICE"));
  const [correctIds, setCorrectIds] = useState<string[]>(["opt-a"]);
  const [feedback, setFeedback] = useState<AulaActionState>(INITIAL);
  const [saving, startSaving] = useTransition();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const id = useId();

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function clearSelectedImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageAlt("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  // Estadísticas del grupo
  const completedRows = roster.filter((r) => r.attemptsUsed > 0);
  const scores = completedRows.map((r) => r.bestScore).filter((s): s is number => s !== null);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const completionPct = roster.length > 0 ? Math.round((completedRows.length / roster.length) * 100) : 0;

  function handleTypeChange(nextType: AutoQuestionType) {
    setQuestionType(nextType);
    const nextOpts = defaultOptionsFor(nextType);
    setOptions(nextOpts);
    setCorrectIds([nextOpts[0]!.id]);
    setFeedback(INITIAL);
  }

  function toggleCorrect(optId: string) {
    if (questionType === "MULTI_CHOICE") {
      setCorrectIds((prev) =>
        prev.includes(optId) ? (prev.length > 1 ? prev.filter((x) => x !== optId) : prev) : [...prev, optId],
      );
    } else {
      setCorrectIds([optId]);
    }
  }

  function addOption() {
    if (options.length >= 6) return;
    const nextId = `opt-${Date.now().toString(36)}-${options.length}`;
    setOptions((prev) => [...prev, { id: nextId, label: "" }]);
  }

  function removeOption(optId: string) {
    if (options.length <= 2) return;
    const next = options.filter((o) => o.id !== optId);
    setOptions(next);
    setCorrectIds((prev) => {
      const filtered = prev.filter((x) => x !== optId);
      return filtered.length > 0 ? filtered : [next[0]!.id];
    });
  }

  function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    const filledOptions = options
      .map((o) => ({ id: o.id, label: o.label.trim() }))
      .filter((o) => o.label.length > 0);

    if (filledOptions.length < 2) {
      setFeedback({ status: "error", message: "Escribe texto en al menos 2 opciones de respuesta." });
      return;
    }

    const validCorrect = correctIds.filter((cid) => filledOptions.some((o) => o.id === cid));
    if (validCorrect.length === 0) {
      setFeedback({ status: "error", message: "Marca cuál opción con texto es la correcta." });
      return;
    }

    startSaving(async () => {
      const fd = new FormData();
      fd.set("courseAssignmentId", courseAssignmentId);
      fd.set("activityId", quiz.id);
      fd.set("questionType", questionType);
      fd.set("prompt", prompt.trim());
      fd.set("points", String(Number(points) || 1));
      fd.set("optionsJson", JSON.stringify(filledOptions));
      fd.set("correctOptionIdsJson", JSON.stringify(validCorrect));
      fd.set("imageAlt", imageAlt.trim());
      if (imageFile) {
        fd.set("questionImage", imageFile);
      }

      const res = await addQuizQuestionAction(fd);
      setFeedback(res);
      if (res.status === "success") {
        emitToast({ title: "Pregunta agregada", description: res.message, tone: "success" });
        setPrompt("");
        clearSelectedImage();
        const fresh = defaultOptionsFor(questionType);
        setOptions(fresh);
        setCorrectIds([fresh[0]!.id]);
      } else if (res.message) {
        emitToast({ title: "Revisa la pregunta", description: res.message, tone: "error" });
      }
    });
  }

  return (
    <div className="grid gap-6">
      {/* Franja de KPIs del cuestionario */}
      <section
        aria-label="Resumen del cuestionario"
        className="card grid divide-y divide-line p-0 sm:grid-cols-4 sm:divide-x sm:divide-y-0"
      >
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Preguntas</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {questions.length}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Participación</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {completedRows.length}
            <span className="ml-1 text-sm font-semibold text-muted">/{roster.length}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-cobalt" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Promedio SIEE</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {avgScore !== null ? avgScore.toFixed(1) : "—"}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Reglas</p>
          <p className="mt-1.5 text-sm font-bold text-navy">
            {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Sin límite"} · {quiz.maxAttempts}{" "}
            {quiz.maxAttempts === 1 ? "intento" : "intentos"}
          </p>
        </div>
      </section>

      {/* Banco de preguntas + constructor rápido */}
      <section aria-label="Preguntas del cuestionario" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-cobalt" aria-hidden />
            <h2 className="text-base font-bold text-navy">Banco de preguntas ({questions.length})</h2>
          </div>

          {canManage && !composerOpen && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className={pillButtonClass({ variant: "navy", size: "sm" })}
            >
              <Plus aria-hidden /> Agregar pregunta
            </button>
          )}
        </div>

        {canManage && composerOpen && (
          <form onSubmit={handleSaveQuestion} className="card grid gap-4 border-cobalt/30 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <p className="text-sm font-bold text-navy">Nueva pregunta autocalificable</p>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy"
                >
                  <X className="size-3.5" aria-hidden /> Cerrar
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div>
                <p className="field-label">Tipo de pregunta</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(["SINGLE_CHOICE", "TRUE_FALSE", "MULTI_CHOICE"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`rounded-control border px-3 py-1.5 text-xs font-bold transition-colors ${
                        questionType === t
                          ? "border-navy bg-navy text-white"
                          : "border-line-2 bg-white text-navy hover:bg-cloud"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor={`${id}-pts`} className="field-label">
                  Puntos
                </label>
                <input
                  id={`${id}-pts`}
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="input min-h-9 text-sm font-bold tabular"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-prompt`} className="field-label">
                Enunciado de la pregunta
              </label>
              <textarea
                id={`${id}-prompt`}
                rows={2}
                required
                minLength={5}
                maxLength={1000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej. Observa la gráfica adjunta. Si la recta pasa por (0, 2) y (2, 6), ¿cuál es su pendiente?"
                className="input min-h-20 resize-y py-2 text-sm font-normal"
              />
            </div>

            {/* Imagen opcional de ejercicio / gráfica / fórmula / diagrama */}
            <div className="grid gap-3 rounded-control border border-dashed border-cobalt/35 bg-cloud/45 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-navy">
                    Imagen de ejercicio / gráfica / diagrama (opcional · PNG, JPG o WebP, máx. 4 MB)
                  </p>
                  <p className="text-[0.7rem] text-muted">
                    Ideal para fórmulas matemáticas, mapas, circuitos, figuras geométricas o lecturas visuales.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-cobalt/35 bg-white px-3 py-1.5 text-xs font-bold text-cobalt transition-colors hover:bg-cobalt hover:text-white">
                    <ImagePlus className="size-3.5" aria-hidden />
                    {imagePreviewUrl ? "Cambiar imagen" : "Adjuntar imagen"}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                  {imagePreviewUrl && (
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      className="inline-flex items-center gap-1 rounded-control border border-red-solid/30 bg-white px-2.5 py-1.5 text-xs font-bold text-red-solid hover:bg-red-l/50"
                    >
                      <X className="size-3.5" aria-hidden /> Quitar
                    </button>
                  )}
                </div>
              </div>

              {imagePreviewUrl && (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-center">
                  <div className="overflow-hidden rounded-control border border-line bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt={imageAlt || "Vista previa de imagen del ejercicio"}
                      className="max-h-28 w-full rounded object-contain"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-imgalt`} className="field-label">
                      Pie de imagen / descripción accesible (opcional)
                    </label>
                    <input
                      id={`${id}-imgalt`}
                      type="text"
                      maxLength={240}
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      placeholder="Ej. Gráfica de función lineal en el plano cartesiano"
                      className="input min-h-9 text-xs font-normal"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="field-label">
                  Opciones (haz clic en el chulo para marcar{" "}
                  {questionType === "MULTI_CHOICE" ? "las correctas" : "la correcta"})
                </p>
                {questionType !== "TRUE_FALSE" && options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-solid hover:underline"
                  >
                    <Plus className="size-3.5" aria-hidden /> Añadir opción
                  </button>
                )}
              </div>

              <div className="grid gap-2">
                {options.map((opt, idx) => {
                  const isCorrect = correctIds.includes(opt.id);
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(opt.id)}
                        aria-pressed={isCorrect}
                        aria-label={`Marcar opción ${LETTERS[idx]} como correcta`}
                        className={`grid size-9 shrink-0 place-items-center rounded-control border-2 transition-colors ${
                          isCorrect
                            ? "border-green-solid bg-green-solid text-white"
                            : "border-line-2 bg-white text-muted hover:border-green-solid/60"
                        }`}
                      >
                        <Check className="size-4" aria-hidden />
                      </button>

                      <span className="w-5 text-center text-xs font-black text-muted">
                        {LETTERS[idx]}.
                      </span>

                      <input
                        type="text"
                        value={opt.label}
                        readOnly={questionType === "TRUE_FALSE"}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((item) =>
                              item.id === opt.id ? { ...item, label: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder={`Escribe la opción ${LETTERS[idx]}…`}
                        className={`input min-h-9 flex-1 text-sm ${
                          isCorrect ? "border-green-solid/50 bg-green-l/25 font-semibold" : "font-normal"
                        }`}
                      />

                      {questionType !== "TRUE_FALSE" && options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(opt.id)}
                          aria-label={`Eliminar opción ${LETTERS[idx]}`}
                          className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-red-l hover:text-red-solid"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {feedback.message && (
              <p
                role={feedback.status === "error" ? "alert" : "status"}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  feedback.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {feedback.status === "success" && <CheckCircle2 className="size-4" aria-hidden />}
                {feedback.message}
              </p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <Plus aria-hidden /> {saving ? "Guardando…" : "Guardar pregunta"}
              </button>
            </div>
          </form>
        )}

        {questions.length === 0 ? (
          <div className="card py-8 text-center text-sm text-muted">
            Aún no hay preguntas en este cuestionario. Agrega la primera arriba para que tus estudiantes puedan
            presentarlo.
          </div>
        ) : (
          <ol className="grid gap-3">
            {questions.map((q, idx) => {
              const correctSet = new Set(q.correctOptionIds ?? []);
              return (
                <li key={q.id} className="card grid gap-3 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-navy text-xs font-black text-white">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-navy">{q.prompt}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {TYPE_LABELS[q.questionType]} · {q.points} {q.points === 1 ? "pto" : "pts"}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <DeleteQuestionButton courseAssignmentId={courseAssignmentId} questionId={q.id} />
                    )}
                  </div>

                  {q.hasImage && (
                    <div className="pl-8">
                      <figure className="inline-block max-w-md overflow-hidden rounded-control border border-line bg-bg-2/50 p-2">
                        <button
                          type="button"
                          onClick={() =>
                            setZoomImage({
                              src: `/api/aula/archivos?tipo=quiz-imagen&id=${q.id}`,
                              alt: q.imageAlt || `Imagen del punto ${idx + 1}`,
                            })
                          }
                          className="group relative block overflow-hidden rounded bg-white"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/aula/archivos?tipo=quiz-imagen&id=${q.id}`}
                            alt={q.imageAlt || `Imagen del punto ${idx + 1}`}
                            className="max-h-48 w-auto max-w-full object-contain"
                          />
                          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-navy/85 px-2 py-0.5 text-[0.65rem] font-bold text-white opacity-90 group-hover:opacity-100">
                            <Maximize2 className="size-3" aria-hidden /> Ampliar
                          </span>
                        </button>
                        {q.imageAlt && (
                          <figcaption className="mt-1.5 text-[0.7rem] text-muted">{q.imageAlt}</figcaption>
                        )}
                      </figure>
                    </div>
                  )}

                  <ul className="grid gap-1.5 pl-8 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => {
                      const isRight = correctSet.has(opt.id);
                      return (
                        <li
                          key={opt.id}
                          className={`flex items-center justify-between gap-2 rounded-control border px-3 py-1.5 text-xs ${
                            isRight
                              ? "border-green-solid/45 bg-green-l/50 font-semibold text-navy"
                              : "border-line bg-bg-2/40 text-ink-2"
                          }`}
                        >
                          <span className="truncate">
                            <strong className="mr-1.5 text-muted">{LETTERS[optIdx]}.</strong>
                            {opt.label}
                          </span>
                          {isRight && <CheckCircle2 className="size-3.5 shrink-0 text-green-solid" aria-hidden />}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Analítica por pregunta (diagrama de barras de precisión) */}
      {questionStats.some((s) => s.answeredCount > 0) && (
        <section aria-label="Precisión por pregunta" className="card grid gap-4 bg-white">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <BarChart3 className="size-4 text-cobalt" aria-hidden />
            <div>
              <h2 className="text-base font-bold text-navy">Precisión por pregunta</h2>
              <p className="text-xs text-muted">
                Detecta en segundos qué conceptos domina el grupo y cuáles conviene reforzar en clase.
              </p>
            </div>
          </div>

          <ul className="grid gap-3">
            {questionStats.map((stat, idx) => {
              const barColor =
                stat.accuracyPercent >= 80
                  ? "bg-green-solid"
                  : stat.accuracyPercent >= 60
                    ? "bg-orange-solid"
                    : "bg-red-solid";
              return (
                <li key={stat.questionId} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <p className="truncate font-semibold text-navy">
                      <span className="mr-1.5 font-black text-muted">P{idx + 1}.</span>
                      {stat.prompt}
                    </p>
                    <span className="shrink-0 font-black text-navy tabular-nums">
                      {stat.accuracyPercent}%{" "}
                      <span className="font-normal text-muted">({stat.answeredCount} resp.)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stat.accuracyPercent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Resultados del grupo */}
      <section aria-label="Resultados por estudiante" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-cobalt" aria-hidden />
            <h2 className="text-base font-bold text-navy">
              Resultados del grupo ({completedRows.length}/{roster.length})
            </h2>
          </div>
          {quiz.syncToSiga && (
            <Chip tone="sky">Mejor nota sincronizada automáticamente con SIGA</Chip>
          )}
        </div>

        <ul className="card divide-y divide-line p-0">
          {roster.map((row) => (
            <li key={row.enrollmentId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="text-sm font-bold text-navy">{row.studentName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {row.attemptsUsed > 0
                    ? `${row.attemptsUsed} ${row.attemptsUsed === 1 ? "intento" : "intentos"}${
                        row.lastSubmittedAt ? ` · Último: ${dateFormat.format(row.lastSubmittedAt)}` : ""
                      }`
                    : "Aún no ha presentado el cuestionario"}
                </p>
              </div>
              <div>
                {row.bestScore !== null ? (
                  <PerformanceBadge score={row.bestScore} scale={scale} />
                ) : (
                  <Chip tone="orange">Pendiente</Chip>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {/* Visor ampliado de imagen de ejercicio */}
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
            className="card relative max-h-[90dvh] max-w-4xl overflow-auto bg-white p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-navy">{zoomImage.alt}</p>
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                aria-label="Cerrar imagen"
                className="grid size-8 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomImage.src}
              alt={zoomImage.alt}
              className="mx-auto max-h-[75dvh] w-auto max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
