"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import {
  activities,
  courseThemes,
  courseUnits,
  enrollments,
  forumPosts,
  learningResources,
  resourceViews,
  submissions,
} from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import { ensureCompetencies } from "@/modules/siga/siee-grades/queries";
import { resolveCourseAccess } from "./access";
import { createLinkedSieeColumn, syncSubmissionScoreToSiee } from "./grade-sync/sync";
import { isLateSubmission, sanitizeAulaText, sanitizeSafeUrl } from "./sanitize";
import {
  createActivitySchema,
  createForumPostSchema,
  createResourceSchema,
  createUnitSchema,
  gradeSubmissionSchema,
  markResourceViewedSchema,
  submitAssignmentSchema,
} from "./schemas";
import {
  deletePrivateAulaFile,
  MAX_IMAGE_FILE_BYTES,
  MAX_RESOURCE_PDF_BYTES,
  MAX_SUBMISSION_FILE_BYTES,
  savePrivateAulaFile,
} from "./storage";
import {
  ACCENT_TONES,
  BANNER_PRESETS,
  COURSE_ICONS,
  COURSE_LAYOUTS,
  normalizeCustomHex,
} from "./themes";

export interface AulaActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

/** Crea una nueva unidad temática en un curso y periodo (solo docente titular). */
export async function createUnitAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = createUnitSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    periodId: formText(formData, "periodId"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los campos de la unidad." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede crear unidades en este curso." };
  }

  const title = sanitizeAulaText(input.title);
  const description = sanitizeAulaText(input.description);
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [countRow] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(courseUnits)
      .where(
        and(eq(courseUnits.courseAssignmentId, input.courseAssignmentId), eq(courseUnits.periodId, input.periodId)),
      );

    const [created] = await tx
      .insert(courseUnits)
      .values({
        courseAssignmentId: input.courseAssignmentId,
        periodId: input.periodId,
        title,
        description,
        displayOrder: countRow?.total ?? 0,
        isPublished: true,
      })
      .returning({ id: courseUnits.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_UNIT_CREATED",
        entityType: "course_unit",
        entityId: created!.id,
        after: { title, courseAssignmentId: input.courseAssignmentId, periodId: input.periodId },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: `Unidad «${title}» creada.` };
}

/** Agrega un recurso (lectura, video o enlace seguro) a una unidad del curso. */
export async function createResourceAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = createResourceSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    unitId: formText(formData, "unitId"),
    type: formText(formData, "type"),
    title: formText(formData, "title"),
    contentTextOrUrl: formText(formData, "contentTextOrUrl"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el recurso." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede agregar recursos." };
  }

  const [unit] = await db
    .select({ id: courseUnits.id })
    .from(courseUnits)
    .where(and(eq(courseUnits.id, input.unitId), eq(courseUnits.courseAssignmentId, input.courseAssignmentId)))
    .limit(1);
  if (!unit) return { status: "error", message: "La unidad no pertenece a este curso." };

  const cleanTitle = sanitizeAulaText(input.title);
  let cleanContent = "";
  let storageKey: string | null = null;
  let fileSizeBytes: number | null = null;

  if (input.type === "PDF") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Selecciona un archivo PDF para subir (máx. 10 MB)." };
    }
    const stored = await savePrivateAulaFile({
      folder: "resources",
      file,
      allowedMimes: ["application/pdf"],
      maxBytes: MAX_RESOURCE_PDF_BYTES,
    });
    if (!stored.ok) return { status: "error", message: stored.message };
    storageKey = stored.storageKey;
    fileSizeBytes = stored.sizeBytes;
    cleanContent = sanitizeAulaText(input.contentTextOrUrl);
  } else if (input.type === "LINK" || input.type === "VIDEO") {
    const safeUrl = sanitizeSafeUrl(input.contentTextOrUrl);
    if (!safeUrl) {
      return { status: "error", message: "Ingresa un enlace válido que empiece por https://." };
    }
    cleanContent = safeUrl;
  } else {
    cleanContent = sanitizeAulaText(input.contentTextOrUrl);
    if (cleanContent.length < 4) {
      return { status: "error", message: "Escribe un contenido de texto válido." };
    }
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const [countRow] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(learningResources)
      .where(eq(learningResources.unitId, unit.id));

    const [created] = await tx
      .insert(learningResources)
      .values({
        unitId: unit.id,
        type: input.type,
        title: cleanTitle,
        contentTextOrUrl: cleanContent,
        storageKey,
        fileSizeBytes,
        displayOrder: countRow?.total ?? 0,
        isPublished: true,
      })
      .returning({ id: learningResources.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_RESOURCE_CREATED",
        entityType: "learning_resource",
        entityId: created!.id,
        after: { title: cleanTitle, type: input.type, unitId: unit.id },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: `Recurso «${cleanTitle}» agregado.` };
}

/** Marca un recurso como visto por el estudiante (avance del curso). */
export async function markResourceViewedAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = markResourceViewedSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    resourceId: formText(formData, "resourceId"),
  });
  if (!parsed.success) return { status: "error", message: "Recurso inválido." };

  const access = await resolveCourseAccess(actor, parsed.data.courseAssignmentId);
  if (!access?.canSubmit || !access.viewerEnrollmentId) {
    return { status: "error", message: "Solo el estudiante matriculado puede marcar su avance." };
  }

  const [resource] = await db
    .select({ id: learningResources.id })
    .from(learningResources)
    .innerJoin(courseUnits, eq(courseUnits.id, learningResources.unitId))
    .where(
      and(
        eq(learningResources.id, parsed.data.resourceId),
        eq(courseUnits.courseAssignmentId, parsed.data.courseAssignmentId),
      ),
    )
    .limit(1);
  if (!resource) return { status: "error", message: "El recurso no pertenece a este curso." };

  await db
    .insert(resourceViews)
    .values({ resourceId: resource.id, enrollmentId: access.viewerEnrollmentId })
    .onConflictDoNothing();

  refresh();
  return { status: "success", message: "Marcado como visto." };
}

/** Crea una tarea en Órbita Virtual y, si el docente lo activa, la vincula con una columna SIGA. */
export async function createActivityAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const syncToSiga = formData.get("syncToSiga") === "on";
  const parsed = createActivitySchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    unitId: formText(formData, "unitId"),
    title: formText(formData, "title"),
    instructions: formText(formData, "instructions"),
    dueDate: formText(formData, "dueDate"),
    allowLate: formData.get("allowLate") !== "off",
    syncToSiga,
    sieeDimension: syncToSiga ? formText(formData, "sieeDimension") : undefined,
    weightPercent: syncToSiga ? formText(formData, "weightPercent")?.replace(",", ".") : undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los campos de la tarea." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede crear tareas en este curso." };
  }

  const [unit] = await db
    .select({ id: courseUnits.id, periodId: courseUnits.periodId })
    .from(courseUnits)
    .where(and(eq(courseUnits.id, input.unitId), eq(courseUnits.courseAssignmentId, input.courseAssignmentId)))
    .limit(1);
  if (!unit) return { status: "error", message: "La unidad no pertenece a este curso." };

  let dueDate: Date | null = null;
  if (input.dueDate) {
    const parsedDate = new Date(`${input.dueDate}T23:59:00-05:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return { status: "error", message: "Fecha límite inválida." };
    }
    dueDate = parsedDate;
  }

  if (input.syncToSiga) {
    if (!input.sieeDimension || !input.weightPercent) {
      return {
        status: "error",
        message: "Para sincronizar con SIGA elige la dimensión (Saber/Hacer/Ser) y el peso en %.",
      };
    }
    await ensureCompetencies(input.courseAssignmentId, unit.periodId, access.course.assessmentMode);
  }

  const cleanTitle = sanitizeAulaText(input.title);
  const cleanInstructions = sanitizeAulaText(input.instructions);
  const { ip } = await getRequestMeta();

  const txResult = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(activities)
      .values({
        unitId: unit.id,
        type: "ASSIGNMENT",
        title: cleanTitle,
        instructionsSanitized: cleanInstructions,
        dueDate,
        allowLate: input.allowLate,
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
        title: cleanTitle,
        weightPercent: input.weightPercent,
        actorUserId: actor.id,
        ipAddress: ip,
      });
      if (!linked.ok) {
        throw new Error(linked.message);
      }
    }

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_ACTIVITY_CREATED",
        entityType: "activity",
        entityId: created!.id,
        after: { title: cleanTitle, unitId: unit.id, syncToSiga: input.syncToSiga },
        ipAddress: ip,
      },
      tx,
    );

    return { ok: true as const };
  }).catch((err: unknown) => ({
    ok: false as const,
    message: err instanceof Error ? err.message : "No pudimos crear la tarea.",
  }));

  if (!txResult.ok) return { status: "error", message: txResult.message };

  refresh();
  return {
    status: "success",
    message: input.syncToSiga
      ? `Tarea «${cleanTitle}» creada y vinculada a la planilla SIGA.`
      : `Tarea «${cleanTitle}» publicada en el curso.`,
  };
}

/** Envío o actualización de entrega (exclusivo del estudiante matriculado; acudientes bloqueados). */
export async function submitAssignmentAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = submitAssignmentSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    activityId: formText(formData, "activityId"),
    textResponse: formText(formData, "textResponse"),
    referenceUrl: formText(formData, "referenceUrl"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa tu entrega." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canSubmit || !access.viewerEnrollmentId) {
    return { status: "error", message: "Solo el estudiante matriculado puede enviar entregas de tareas." };
  }

  const [act] = await db
    .select({
      id: activities.id,
      dueDate: activities.dueDate,
      allowLate: activities.allowLate,
      isPublished: activities.isPublished,
    })
    .from(activities)
    .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
    .where(
      and(
        eq(activities.id, input.activityId),
        eq(courseUnits.courseAssignmentId, input.courseAssignmentId),
      ),
    )
    .limit(1);
  if (!act || !act.isPublished) return { status: "error", message: "La tarea no está disponible." };

  const now = new Date();
  const late = isLateSubmission(act.dueDate, now);
  if (late && !act.allowLate) {
    return { status: "error", message: "El plazo de entrega venció y esta tarea no admite entregas tardías." };
  }

  let safeUrl: string | null = null;
  if (input.referenceUrl) {
    safeUrl = sanitizeSafeUrl(input.referenceUrl);
    if (!safeUrl) {
      return { status: "error", message: "El enlace adjunto debe comenzar por https://." };
    }
  }

  const [existing] = await db
    .select({ id: submissions.id, score: submissions.score, attachmentKey: submissions.attachmentKey })
    .from(submissions)
    .where(and(eq(submissions.activityId, act.id), eq(submissions.enrollmentId, access.viewerEnrollmentId)))
    .limit(1);
  if (existing && existing.score !== null) {
    return { status: "error", message: "Esta entrega ya fue calificada y no se puede modificar." };
  }

  let attachmentKey = existing?.attachmentKey ?? null;
  const rawFile = formData.get("attachment");
  if (rawFile instanceof File && rawFile.size > 0) {
    const stored = await savePrivateAulaFile({
      folder: "submissions",
      file: rawFile,
      allowedMimes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      maxBytes: MAX_SUBMISSION_FILE_BYTES,
    });
    if (!stored.ok) return { status: "error", message: stored.message };
    attachmentKey = stored.storageKey;
  }

  const cleanText = sanitizeAulaText(input.textResponse);
  if (cleanText.length < 5 && !attachmentKey && !safeUrl) {
    return {
      status: "error",
      message: "Escribe tu respuesta, adjunta un archivo (PDF/imagen) o incluye un enlace.",
    };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .insert(submissions)
      .values({
        activityId: act.id,
        enrollmentId: access.viewerEnrollmentId!,
        textResponse: cleanText,
        referenceUrl: safeUrl,
        attachmentKey,
        submittedAt: now,
        isLate: late,
      })
      .onConflictDoUpdate({
        target: [submissions.activityId, submissions.enrollmentId],
        set: {
          textResponse: cleanText,
          referenceUrl: safeUrl,
          attachmentKey,
          submittedAt: now,
          isLate: late,
        },
      });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_SUBMISSION_SENT",
        entityType: "submission",
        entityId: `${act.id}:${access.viewerEnrollmentId}`,
        after: { isLate: late, hasUrl: Boolean(safeUrl), hasAttachment: Boolean(attachmentKey) },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return {
    status: "success",
    message: late
      ? "Entrega enviada (registrada fuera de fecha límite)."
      : "¡Entrega enviada correctamente!",
  };
}

/** Califica una entrega y sincroniza automáticamente la nota con SIGA en la misma transacción. */
export async function gradeSubmissionAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = gradeSubmissionSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    activityId: formText(formData, "activityId"),
    enrollmentId: formText(formData, "enrollmentId"),
    score: formText(formData, "score")?.replace(",", "."),
    teacherFeedback: formText(formData, "teacherFeedback"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Nota inválida." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede calificar entregas." };
  }

  const [act, enr] = await Promise.all([
    db
      .select({ id: activities.id, maxScore: activities.maxScore, syncToSiga: activities.syncToSiga })
      .from(activities)
      .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
      .where(
        and(
          eq(activities.id, input.activityId),
          eq(courseUnits.courseAssignmentId, input.courseAssignmentId),
        ),
      )
      .limit(1),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.id, input.enrollmentId), eq(enrollments.groupId, access.course.groupId)))
      .limit(1),
  ]);
  if (!act[0] || !enr[0]) {
    return { status: "error", message: "La actividad o el estudiante no pertenecen a este curso." };
  }

  const feedback = sanitizeAulaText(input.teacherFeedback);
  const now = new Date();
  const { ip } = await getRequestMeta();

  const syncOutcome = await db.transaction(async (tx) => {
    await tx
      .insert(submissions)
      .values({
        activityId: act[0]!.id,
        enrollmentId: enr[0]!.id,
        textResponse: "",
        submittedAt: now,
        isLate: false,
        score: input.score,
        teacherFeedback: feedback || null,
        gradedBy: actor.id,
        gradedAt: now,
      })
      .onConflictDoUpdate({
        target: [submissions.activityId, submissions.enrollmentId],
        set: {
          score: input.score,
          teacherFeedback: feedback || null,
          gradedBy: actor.id,
          gradedAt: now,
        },
      });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_SUBMISSION_GRADED",
        entityType: "submission",
        entityId: `${act[0]!.id}:${enr[0]!.id}`,
        after: { score: input.score },
        ipAddress: ip,
      },
      tx,
    );

    if (act[0]!.syncToSiga) {
      return syncSubmissionScoreToSiee(tx, {
        activityId: act[0]!.id,
        enrollmentId: enr[0]!.id,
        rawScore: input.score,
        maxScore: act[0]!.maxScore,
        actorUserId: actor.id,
        ipAddress: ip,
        now,
      });
    }
    return { synced: false };
  });

  refresh();
  if (syncOutcome.warning) {
    return { status: "success", message: syncOutcome.warning };
  }
  return {
    status: "success",
    message: syncOutcome.synced
      ? `Nota ${input.score.toFixed(1)} guardada y sincronizada con la planilla SIGA.`
      : `Nota ${input.score.toFixed(1)} guardada.`,
  };
}

/** Publica un aviso o consulta en el muro del curso (docentes, estudiantes matriculados y staff). */
export async function createForumPostAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const parsed = createForumPostSchema.safeParse({
    courseAssignmentId: formText(formData, "courseAssignmentId"),
    body: formText(formData, "body"),
    isPinned: formData.get("isPinned") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Escribe un mensaje válido." };
  }
  const input = parsed.data;
  const access = await resolveCourseAccess(actor, input.courseAssignmentId);
  if (!access?.canPostForum) {
    return { status: "error", message: "No tienes permiso para publicar en el muro de este curso." };
  }

  const cleanBody = sanitizeAulaText(input.body);
  if (cleanBody.length < 4) return { status: "error", message: "Escribe al menos 4 caracteres válidos." };

  const isPinned = access.canManage ? input.isPinned : false;
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(forumPosts)
      .values({
        courseAssignmentId: input.courseAssignmentId,
        authorId: actor.id,
        bodySanitized: cleanBody,
        isPinned,
      })
      .returning({ id: forumPosts.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_FORUM_POSTED",
        entityType: "forum_post",
        entityId: created!.id,
        after: { courseAssignmentId: input.courseAssignmentId, isPinned },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Mensaje publicado en el curso." };
}

/** Guarda la personalización visual que el docente elige para su curso en Órbita Virtual. */
export async function saveCourseThemeAction(
  _prev: AulaActionState,
  formData: FormData,
): Promise<AulaActionState> {
  const actor = await requireSession();
  const courseAssignmentId = formText(formData, "courseAssignmentId");
  if (!courseAssignmentId) return { status: "error", message: "Curso inválido." };

  const access = await resolveCourseAccess(actor, courseAssignmentId);
  if (!access?.canManage) {
    return { status: "error", message: "Solo el docente titular puede personalizar este curso." };
  }

  const rawBanner = formText(formData, "bannerPreset") ?? "constellation";
  const rawTone = formText(formData, "accentTone") ?? "cobalt";
  const rawCustomHex = formText(formData, "customColorHex") ?? "";
  const rawIcon = formText(formData, "iconKey") ?? "book";
  const rawLayout = formText(formData, "layoutStyle") ?? "cards";
  const rawWelcome = formText(formData, "welcomeMessage") ?? "";
  const removeBannerImage = formText(formData, "removeBannerImage") === "1";

  if (!(BANNER_PRESETS as readonly string[]).includes(rawBanner)) {
    return { status: "error", message: "Estilo de portada inválido." };
  }
  if (!(ACCENT_TONES as readonly string[]).includes(rawTone)) {
    return { status: "error", message: "Color institucional inválido." };
  }
  if (!(COURSE_ICONS as readonly string[]).includes(rawIcon)) {
    return { status: "error", message: "Ícono inválido." };
  }
  if (!(COURSE_LAYOUTS as readonly string[]).includes(rawLayout)) {
    return { status: "error", message: "Diseño de unidades inválido." };
  }

  const customColorHex = rawCustomHex.trim() ? normalizeCustomHex(rawCustomHex) : null;
  if (rawCustomHex.trim() && !customColorHex) {
    return { status: "error", message: "El color personalizado debe tener formato #RRGGBB." };
  }

  const [existingTheme] = await db
    .select({ bannerImageKey: courseThemes.bannerImageKey })
    .from(courseThemes)
    .where(eq(courseThemes.courseAssignmentId, courseAssignmentId))
    .limit(1);

  let nextBannerImageKey: string | null = existingTheme?.bannerImageKey ?? null;
  let oldKeyToDelete: string | null = null;

  const rawFile = formData.get("bannerImage");
  if (rawFile instanceof File && rawFile.size > 0) {
    const stored = await savePrivateAulaFile({
      folder: "banners",
      file: rawFile,
      allowedMimes: ["image/png", "image/jpeg", "image/webp"],
      maxBytes: MAX_IMAGE_FILE_BYTES,
    });
    if (!stored.ok) return { status: "error", message: stored.message };
    oldKeyToDelete = nextBannerImageKey;
    nextBannerImageKey = stored.storageKey;
  } else if (removeBannerImage && nextBannerImageKey) {
    oldKeyToDelete = nextBannerImageKey;
    nextBannerImageKey = null;
  }

  const welcomeMessage = sanitizeAulaText(rawWelcome).slice(0, 240);
  const { ip } = await getRequestMeta();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(courseThemes)
      .values({
        courseAssignmentId,
        bannerPreset: rawBanner,
        accentTone: rawTone,
        customColorHex,
        bannerImageKey: nextBannerImageKey,
        iconKey: rawIcon,
        layoutStyle: rawLayout,
        welcomeMessage,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: courseThemes.courseAssignmentId,
        set: {
          bannerPreset: rawBanner,
          accentTone: rawTone,
          customColorHex,
          bannerImageKey: nextBannerImageKey,
          iconKey: rawIcon,
          layoutStyle: rawLayout,
          welcomeMessage,
          updatedAt: now,
        },
      });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "AULA_COURSE_THEME_UPDATED",
        entityType: "course_assignment",
        entityId: courseAssignmentId,
        after: {
          bannerPreset: rawBanner,
          accentTone: rawTone,
          customColorHex,
          hasBannerImage: Boolean(nextBannerImageKey),
          iconKey: rawIcon,
          layoutStyle: rawLayout,
        },
        ipAddress: ip,
      },
      tx,
    );
  });

  if (oldKeyToDelete) {
    await deletePrivateAulaFile(oldKeyToDelete);
  }

  refresh();
  return { status: "success", message: "Personalización del curso guardada." };
}
