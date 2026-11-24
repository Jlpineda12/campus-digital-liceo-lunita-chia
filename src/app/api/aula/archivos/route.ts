import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  activities,
  courseThemes,
  courseUnits,
  learningResources,
  quizQuestions,
  submissions,
} from "@/db/schema";
import { resolveCourseAccess } from "@/modules/aula/access";
import { readPrivateAulaFile } from "@/modules/aula/storage";
import { getSession } from "@/modules/core/auth/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Set(["recurso", "entrega", "banner", "quiz-imagen"]);

function safeDownloadFilename(title: string, ext: string): string {
  const base = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${base || "archivo"}.${ext}`;
}

/**
 * Descarga / vista segura de archivos privados del Aula Virtual:
 * - `recurso`: guías PDF docentes
 * - `entrega`: adjuntos de tareas de estudiantes (anti-IDOR por matrícula)
 * - `banner`: portada personalizada de curso subida por el docente
 * - `quiz-imagen`: imagen de apoyo / ejercicio en una pregunta de cuestionario
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autenticación requerida." }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  const id = request.nextUrl.searchParams.get("id");
  const download = request.nextUrl.searchParams.get("descargar") === "1";

  if (!id || !UUID_RE.test(id) || !ALLOWED_TYPES.has(tipo)) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  let storageKey: string | null = null;
  let title = "documento";
  let isImageAsset = false;

  if (tipo === "recurso") {
    const [row] = await db
      .select({
        storageKey: learningResources.storageKey,
        title: learningResources.title,
        courseAssignmentId: courseUnits.courseAssignmentId,
      })
      .from(learningResources)
      .innerJoin(courseUnits, eq(courseUnits.id, learningResources.unitId))
      .where(eq(learningResources.id, id))
      .limit(1);

    if (!row || !row.storageKey) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    const access = await resolveCourseAccess(session.user, row.courseAssignmentId);
    if (!access) {
      return NextResponse.json({ error: "Sin acceso a este curso." }, { status: 403 });
    }

    storageKey = row.storageKey;
    title = row.title;
  } else if (tipo === "entrega") {
    const [row] = await db
      .select({
        attachmentKey: submissions.attachmentKey,
        enrollmentId: submissions.enrollmentId,
        activityTitle: activities.title,
        courseAssignmentId: courseUnits.courseAssignmentId,
      })
      .from(submissions)
      .innerJoin(activities, eq(activities.id, submissions.activityId))
      .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
      .where(eq(submissions.id, id))
      .limit(1);

    if (!row || !row.attachmentKey) {
      return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
    }

    const access = await resolveCourseAccess(session.user, row.courseAssignmentId);
    if (!access) {
      return NextResponse.json({ error: "Sin acceso a este curso." }, { status: 403 });
    }

    // Si es estudiante o acudiente, SOLO puede descargar la entrega de su propia matrícula / hijo.
    if (access.viewerEnrollmentId && access.viewerEnrollmentId !== row.enrollmentId) {
      return NextResponse.json({ error: "No autorizado para ver entregas de otro estudiante." }, { status: 403 });
    }

    storageKey = row.attachmentKey;
    title = `entrega-${row.activityTitle}`;
  } else if (tipo === "banner") {
    const access = await resolveCourseAccess(session.user, id);
    if (!access) {
      return NextResponse.json({ error: "Sin acceso a este curso." }, { status: 403 });
    }

    const [row] = await db
      .select({ bannerImageKey: courseThemes.bannerImageKey })
      .from(courseThemes)
      .where(eq(courseThemes.courseAssignmentId, id))
      .limit(1);

    if (!row?.bannerImageKey) {
      return NextResponse.json({ error: "Portada personalizada no encontrada." }, { status: 404 });
    }

    storageKey = row.bannerImageKey;
    title = `portada-${access.course.subjectName}`;
    isImageAsset = true;
  } else {
    // tipo === "quiz-imagen"
    const [row] = await db
      .select({
        imageStorageKey: quizQuestions.imageStorageKey,
        courseAssignmentId: courseUnits.courseAssignmentId,
      })
      .from(quizQuestions)
      .innerJoin(activities, eq(activities.id, quizQuestions.activityId))
      .innerJoin(courseUnits, eq(courseUnits.id, activities.unitId))
      .where(eq(quizQuestions.id, id))
      .limit(1);

    if (!row?.imageStorageKey) {
      return NextResponse.json({ error: "Imagen del ejercicio no encontrada." }, { status: 404 });
    }

    const access = await resolveCourseAccess(session.user, row.courseAssignmentId);
    if (!access) {
      return NextResponse.json({ error: "Sin acceso a este curso." }, { status: 403 });
    }

    storageKey = row.imageStorageKey;
    title = `ejercicio-quiz-${id.slice(0, 8)}`;
    isImageAsset = true;
  }

  const file = await readPrivateAulaFile(storageKey);
  if (!file) {
    return NextResponse.json({ error: "El archivo ya no se encuentra disponible." }, { status: 404 });
  }

  const filename = safeDownloadFilename(title, file.ext);
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(file.buffer.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": isImageAsset ? "private, max-age=300" : "private, no-store",
    },
  });
}
