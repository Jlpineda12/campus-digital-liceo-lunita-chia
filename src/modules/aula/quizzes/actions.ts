"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  activities,
  courseUnits,
  quizAttempts,
  quizQuestions,
} from "@/db/schema";
import { SIEE_DIMENSIONS } from "@/db/schema/siga";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { ensureCompetencies } from "@/modules/siga/siee-grades/queries";
import { resolveCourseAccess } from "../access";
import type { AulaActionState } from "../actions";
import { createLinkedSieeColumn, syncSubmissionScoreToSiee } from "../grade-sync/sync";
import { sanitizeAulaText } from "../sanitize";
import { deletePrivateAulaFile, MAX_IMAGE_FILE_BYTES, savePrivateAulaFile } from "../storage";
import {
  evaluateQuizAttempt,
  isQuizWithinTimeLimit,
  type AutoQuestionType,
} from "./evaluator";

const createQuizSchema = z.object({
  courseAssignmentId: z.uuid(),
  unitId: z.uuid({ error: "Selecciona una unidad." }),
  title: z.string({ error: "Escribe un título." }).trim().min(3, "Mínimo 3 caracteres.").max(120),
  instructions: z.string().trim().max(2000).optional().default(""),
  dueDate: z.string().trim().optional().default(""),
  timeLimitMinutes: z.coerce.number().int().min(0).max(180).default(20),
  maxAttempts: z.coerce.number().int().min(1).max(3).default(1),
  syncToSiga: z.boolean().default(false),
  sieeDimension: z.enum(SIEE_DIMENSIONS).optional(),
  weightPercent: z.coerce.number().min(1).max(100).optional(),
});

/** Crea un cuestionario autocalificable (con sincronización opcional a SIGA). */
export async function createQuizAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const syncToSiga = formData.get("syncToSiga") === "on";
  const parsed = createQuizSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    unitId: formText(formData, "unitId"),
    title: formText(formData, "title"),
    instructions: formText(formData, "instructions"),
    dueDate: formText(formData, "dueDate"),
    timeLimitMinutes: formText(formData, "timeLimitMinutes") || "20",
    maxAttempts: formText(formData, "maxAttempts") || "1",
    syncToSiga,
    sieeDimension: syncToSiga ? formText(formData, "sieeDimension") : undefined,
    weightPercent: syncToSiga ? formText(formData, "weightPercent")?.replace(",", ".") : undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del cuestionario." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede crear cuestionarios." };
  }

  const [unit] = await db
    .select({ id: courseUnits.id, periodId: courseUnits.periodId })
    .from(courseUnits)
    .where(and(eq(courseUnits.id, input.unitId), eq(courseUnits.courseAssignmentId, input.courseAssignmentId)))
    .limit(1);
  if (!unit) return { status: "error", message: "La unidad no pertenece a este curso." };

  let dueDate: Date | null = null;
  if (input.dueDate) {
    const d = new Date(`${input.dueDate}T23:59:00-05:00`);
    if (Number.isNaN(d.getTime())) return { status: "error", message: "Fecha límite inválida." };
    dueDate = d;
  }

  if (input.syncToSiga) {
    if (!input.sieeDimension || !input.weightPercent) {
      return { status: "error", message: "Para sincronizar con SIGA indica la dimensión y el porcentaje." };
    }
    await ensureCompetencies(input.courseAssignmentId, unit.periodId, access.course.assessmentMode);
  }

  const title = sanitizeAulaText(input.title);
  const instructions = sanitizeAulaText(input.instructions);
  const { ip } = await getRequestMeta();

  const txResult = await db
    .transaction(async (tx) => {
      const [created] = await tx
        .insert(activities)
        .values({
          unitId: unit.id,
          type: "QUIZ",
          title,
          instructionsSanitized: instructions,
          dueDate,
          timeLimitMinutes: input.timeLimitMinutes > 0 ? input.timeLimitMinutes : null,
          maxAttempts: input.maxAttempts,
          syncToSiga: input.syncToSiga,
          isPublished: true,
        })
        .returning({ id: activities.id });

      if (input.syncToSiga && input.sieeDimension && input.weightPercent) {
        const linked = await createLinkedSieeColumn(tx, {
          activityId: created!.id,
          courseAssignmentId: input.courseAssignmentId,
          periodId: unit.periodId,
          dimension: input.sieeDimension,
          title,
          weightPercent: input.weightPercent,
          actorUserId: actor.id,
          ipAddress: ip,
        });
        if (!linked.ok) throw new Error(linked.message);
      }

      await recordAudit(
        {
          actorUserId: actor.id,
          action: "AULA_ACTIVITY_CREATED",
          entityType: "quiz",
          entityId: created!.id,
          after: { title, timeLimitMinutes: input.timeLimitMinutes, syncToSiga: input.syncToSiga },
          ipAddress: ip,
        },
        tx,
      );
      return { ok: true as const };
    })
    .catch((err: unknown) => ({
      ok: false as const,
      message: err instanceof Error ? err.message : "No pudimos crear el cuestionario.",
    }));

  if (!txResult.ok) return { status: "error", message: txResult.message };

  refresh();
  return {
    status: "success",
    message: `Cuestionario «${title}» creado. Ábrelo para agregar sus preguntas.`,
  };
}

const addQuestionSchema = z.object({
  courseAssignmentId: z.uuid(),
  activityId: z.uuid(),
  questionType: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE"]),
  prompt: z.string({ error: "Escribe el enunciado de la pregunta." }).trim().min(5, "Mínimo 5 caracteres.").max(1000),
  imageAlt: z.string().trim().max(240).optional().default(""),
  points: z.coerce.number().min(0.5).max(50).default(1),
  options: z
    .array(z.object({ id: z.string().min(1), label: z.string().trim().min(1).max(300) }))
    .min(2, "Agrega al menos 2 opciones.")
    .max(6, "Máximo 6 opciones."),
  correctOptionIds: z.array(z.string().min(1)).min(1, "Marca al menos una respuesta correcta."),
});

/**
 * Agrega una pregunta autocalificable a un cuestionario (con imagen opcional de ejercicio
 * guardada en almacenamiento privado y validada por magic bytes). Solo docente titular.
 */
export async function addQuizQuestionAction(formData: FormData): Promise<AulaActionState> {
  const actor = await requireSession();

  let parsedOptions: unknown = [];
  let parsedCorrect: unknown = [];
  try {
    parsedOptions = JSON.parse(formText(formData, "optionsJson") ?? "[]");
    parsedCorrect = JSON.parse(formText(formData, "correctOptionIdsJson") ?? "[]");
  } catch {
    return { status: "error", message: "Opciones de respuesta con formato inválido." };
  }

  const parsed = addQuestionSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    activityId: formText(formData, "activityId"),
    questionType: formText(formData, "questionType"),
    prompt: formText(formData, "prompt"),
    imageAlt: formText(formData, "imageAlt") ?? "",
    points: formText(formData, "points") || "1",
    options: parsedOptions,
    correctOptionIds: parsedCorrect,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa la pregunta." };
  }
  const data = parsed.data;
  const access = await resolveCourseAccess(actor, data.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede editar preguntas." };
  }

  const [act] = await db
    .select({ id: activities.id })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .where(
      and(
        eq(activities.id, data.activityId),
        eq(activities.type, "QUIZ"),
        eq(courseUnits.courseAssignmentId, data.courseAssignmentId),
      ),
    )
    .limit(1);
  if (!act) return { status: "error", message: "Cuestionario no encontrado." };

  const validOptionIds = new Set(data.options.map((o) => o.id));
  const cleanCorrect = data.correctOptionIds.filter((id) => validOptionIds.has(id));
  if (cleanCorrect.length === 0) {
    return { status: "error", message: "Selecciona una respuesta correcta válida." };
  }
  if (data.questionType !== "MULTI_CHOICE" && cleanCorrect.length > 1) {
    return { status: "error", message: "Este tipo de pregunta solo admite una respuesta correcta." };
  }

  let imageStorageKey: string | null = null;
  const rawImage = formData.get("questionImage");
  if (rawImage instanceof File && rawImage.size > 0) {
    const stored = await savePrivateAulaFile({
      folder: "quiz-images",
      file: rawImage,
      allowedMimes: ["image/png", "image/jpeg", "image/webp"],
      maxBytes: MAX_IMAGE_FILE_BYTES,
    });
    if (!stored.ok) return { status: "error", message: stored.message };
    imageStorageKey = stored.storageKey;
  }

  const cleanPrompt = sanitizeAulaText(data.prompt);
  const cleanImageAlt = sanitizeAulaText(data.imageAlt).slice(0, 240);
  const cleanOptions = data.options.map((o) => ({ id: o.id, label: sanitizeAulaText(o.label) }));
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [cnt] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(quizQuestions)
      .where(eq(quizQuestions.activityId, act.id));

    const [created] = await tx
      .insert(quizQuestions)
      .values({
        activityId: act.id,
        questionType: data.questionType,
        promptSanitized: cleanPrompt,
        imageStorageKey,
        imageAlt: cleanImageAlt,
        optionsJson: cleanOptions,
        correctAnswerJson: cleanCorrect,
        points: data.points,
        displayOrder: cnt?.total ?? 0,
      })
      .returning({ id: quizQuestions.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_QUIZ_QUESTION_SAVED",
        entityType: "quiz_question",
        entityId: created!.id,
        after: {
          activityId: act.id,
          questionType: data.questionType,
          points: data.points,
          hasImage: Boolean(imageStorageKey),
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: imageStorageKey
      ? "Pregunta con imagen de ejercicio agregada al cuestionario."
      : "Pregunta agregada al cuestionario.",
  };
}

/** Elimina una pregunta de un cuestionario y limpia su imagen privada si existe (solo docente titular). */
export async function deleteQuizQuestionAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const courseAssignmentId = formText(formData, "courseAssignmentId");
  const questionId = formText(formData, "questionId");
  if (!courseAssignmentId || !questionId) return { status: "error", message: "Parámetros inválidos." };

  const access = await resolveCourseAccess(actor, courseAssignmentId);
  if (!access?.canManage) return { status: "error", message: "No autorizado." };

  const [q] = await db
    .select({ id: quizQuestions.id, imageStorageKey: quizQuestions.imageStorageKey })
    .from(quizQuestions)
    .innerJoin(activities, eq(activities.id, quizQuestions.activityId))
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .where(and(eq(quizQuestions.id, questionId), eq(courseUnits.courseAssignmentId, courseAssignmentId)))
    .limit(1);
  if (!q) return { status: "error", message: "Pregunta no encontrada." };

  await db.delete(quizQuestions).where(eq(quizQuestions.id, q.id));
  await deletePrivateAulaFile(q.imageStorageKey);
  refresh();
  return { status: "success", message: "Pregunta eliminada." };
}

/** Inicia un intento de cuestionario marcando `startedAt` en el reloj del servidor (solo estudiante). */
export async function startQuizAttemptAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const courseAssignmentId = formText(formData, "courseAssignmentId");
  const activityId = formText(formData, "activityId");
  if (!courseAssignmentId || !activityId) return { status: "error", message: "Datos inválidos." };

  const access = await resolveCourseAccess(actor, courseAssignmentId);
  if (!access?.canSubmit || !access.viewerEnrollmentId) {
    return { status: "error", message: "Solo el estudiante matriculado puede presentar el cuestionario." };
  }

  const [act] = await db
    .select({ id: activities.id, maxAttempts: activities.maxAttempts })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .where(
      and(
        eq(activities.id, activityId),
        eq(activities.type, "QUIZ"),
        eq(activities.isPublished, true),
        eq(courseUnits.courseAssignmentId, courseAssignmentId),
      ),
    )
    .limit(1);
  if (!act) return { status: "error", message: "Cuestionario no disponible." };

  const [qCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quizQuestions)
    .where(eq(quizQuestions.activityId, act.id));
  if ((qCount?.total ?? 0) === 0) {
    return { status: "error", message: "El docente aún no ha publicado preguntas en este cuestionario." };
  }

  const existing = await db
    .select({ id: quizAttempts.id, attemptNumber: quizAttempts.attemptNumber, submittedAt: quizAttempts.submittedAt })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.activityId, act.id), eq(quizAttempts.enrollmentId, access.viewerEnrollmentId)));

  if (existing.some((a) => a.submittedAt === null)) {
    refresh();
    return { status: "success", message: "Retomando tu intento en curso." };
  }

  if (existing.length >= act.maxAttempts) {
    return { status: "error", message: `Ya utilizaste tus ${act.maxAttempts} intento(s) permitidos.` };
  }

  const nextNum = existing.reduce((max, a) => Math.max(max, a.attemptNumber), 0) + 1;
  await db.insert(quizAttempts).values({
    activityId: act.id,
    enrollmentId: access.viewerEnrollmentId,
    attemptNumber: nextNum,
    startedAt: new Date(),
  });

  refresh();
  return { status: "success", message: "Cuestionario iniciado. ¡Mucho éxito!" };
}

const submitQuizSchema = z.object({
  courseAssignmentId: z.uuid(),
  activityId: z.uuid(),
  attemptId: z.uuid(),
  answersByQuestion: z.record(z.string(), z.array(z.string())),
});

/**
 * Recibe las respuestas del estudiante, valida reloj en servidor, autocalifica
 * a escala SIEE (1.0–5.0) y sincroniza la mejor nota con SIGA en una sola transacción.
 */
export async function submitQuizAttemptAction(
  input: z.input<typeof submitQuizSchema>,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = submitQuizSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Respuestas con formato inválido." };

  const data = parsed.data;
  const access = await resolveCourseAccess(actor, data.courseAssignmentId);
  if (!access?.canSubmit || !access.viewerEnrollmentId) {
    return { status: "error", message: "Solo el estudiante matriculado puede enviar este intento." };
  }

  const [attempt] = await db
    .select({
      id: quizAttempts.id,
      activityId: quizAttempts.activityId,
      enrollmentId: quizAttempts.enrollmentId,
      startedAt: quizAttempts.startedAt,
      submittedAt: quizAttempts.submittedAt,
      timeLimitMinutes: activities.timeLimitMinutes,
      syncToSiga: activities.syncToSiga,
      maxScore: activities.maxScore,
    })
    .from(quizAttempts)
    .innerJoin(activities, eq(activities.id, quizAttempts.activityId))
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .where(
      and(
        eq(quizAttempts.id, data.attemptId),
        eq(quizAttempts.activityId, data.activityId),
        eq(quizAttempts.enrollmentId, access.viewerEnrollmentId),
        eq(courseUnits.courseAssignmentId, data.courseAssignmentId),
      ),
    )
    .limit(1);

  if (!attempt) return { status: "error", message: "No encontramos tu intento activo." };
  if (attempt.submittedAt !== null) {
    return { status: "error", message: "Este intento ya fue enviado y calificado." };
  }

  const rawQuestions = await db
    .select({
      id: quizQuestions.id,
      questionType: quizQuestions.questionType,
      points: quizQuestions.points,
      correctAnswerJson: quizQuestions.correctAnswerJson,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.activityId, attempt.activityId))
    .orderBy(asc(quizQuestions.displayOrder));

  const evaluable = rawQuestions
    .filter((q) => q.questionType !== "SHORT_TEXT")
    .map((q) => ({
      id: q.id,
      questionType: q.questionType as AutoQuestionType,
      points: Number(q.points) || 1,
      correctOptionIds: Array.isArray(q.correctAnswerJson) ? q.correctAnswerJson.map(String) : [],
    }));

  const now = new Date();
  const withinTime = isQuizWithinTimeLimit({
    startedAt: attempt.startedAt,
    submittedAt: now,
    timeLimitMinutes: attempt.timeLimitMinutes,
  });

  const evaluation = evaluateQuizAttempt(evaluable, data.answersByQuestion);
  const { ip } = await getRequestMeta();

  const syncOutcome = await db.transaction(async (tx) => {
    await tx
      .update(quizAttempts)
      .set({
        submittedAt: now,
        answersJson: data.answersByQuestion,
        autoScore: evaluation.sieeScore,
        finalScore: evaluation.sieeScore,
      })
      .where(eq(quizAttempts.id, attempt.id));

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_QUIZ_ATTEMPT_SUBMITTED",
        entityType: "quiz_attempt",
        entityId: attempt.id,
        after: {
          activityId: attempt.activityId,
          sieeScore: evaluation.sieeScore,
          percent: evaluation.percent,
          withinTime,
        },
        ipAddress: ip,
      },
      tx,
    );

    // Si está sincronizado con SIGA, sube la mejor nota de los intentos del estudiante.
    if (attempt.syncToSiga) {
      const allScores = await tx
        .select({ finalScore: quizAttempts.finalScore })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.activityId, attempt.activityId),
            eq(quizAttempts.enrollmentId, attempt.enrollmentId),
          ),
        );
      const best = Math.max(
        evaluation.sieeScore,
        ...allScores.map((r) => r.finalScore ?? 1.0),
      );

      return syncSubmissionScoreToSiee(tx, {
        activityId: attempt.activityId,
        enrollmentId: attempt.enrollmentId,
        rawScore: best,
        maxScore: attempt.maxScore,
        actorUserId: actor.id,
        ipAddress: ip,
        now,
      });
    }
    return { synced: false };
  });

  refresh();
  const timeNote = withinTime ? "" : " (enviado tras concluir el temporizador)";
  return {
    status: "success",
    message: syncOutcome.synced
      ? `¡Calificado al instante! Nota: ${evaluation.sieeScore.toFixed(1)} (${evaluation.percent}%) — sincronizada con SIGA${timeNote}.`
      : `¡Calificado al instante! Nota: ${evaluation.sieeScore.toFixed(1)} (${evaluation.percent}%)${timeNote}.`,
  };
}
