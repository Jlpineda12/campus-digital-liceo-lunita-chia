"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { circularReads, circulars } from "@/db/schema";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { formText } from "@/modules/core/auth/schemas";
import { getRequestMeta } from "@/modules/core/auth/session";
import {
  canPublishCircular,
  canPublishInstitutional,
  matchesCircularAudience,
  sanitizeCircularText,
} from "./meta";
import { listAudienceOptionsForActor, resolveViewerAudience } from "./queries";
import { circularIdSchema, createCircularSchema } from "./schemas";

export interface AgendaActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

/** Publica una nueva circular o comunicado escolar (Rectoría, Coordinación o Docente en sus grupos). */
export async function createCircularAction(
  _prev: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const actor = await requireSession();
  if (!canPublishCircular(actor.role)) {
    return { status: "error", message: "No tienes permiso para publicar circulares." };
  }

  const parsed = createCircularSchema.safeParse({
    title: formText(formData, "title"),
    body: formText(formData, "body"),
    targetScope: formText(formData, "targetScope"),
    targetLevelId: formText(formData, "targetLevelId") || undefined,
    targetGradeId: formText(formData, "targetGradeId") || undefined,
    targetGroupId: formText(formData, "targetGroupId") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los campos de la circular." };
  }

  const input = parsed.data;
  const context = await getCurrentAcademicContext();
  if (!context) return { status: "error", message: "No hay un año lectivo activo." };

  const allowed = await listAudienceOptionsForActor(actor, context.year.id);
  if (input.targetScope !== "GROUP" && !canPublishInstitutional(actor.role)) {
    return {
      status: "error",
      message: "Como docente solo puedes enviar avisos a tus grupos asignados o dirección de grupo.",
    };
  }

  const targetLevelId = input.targetScope === "LEVEL" ? input.targetLevelId ?? null : null;
  const targetGradeId = input.targetScope === "GRADE" ? input.targetGradeId ?? null : null;
  const targetGroupId = input.targetScope === "GROUP" ? input.targetGroupId ?? null : null;

  if (targetLevelId && !allowed.levels.some((l) => l.id === targetLevelId)) {
    return { status: "error", message: "El nivel seleccionado no es válido." };
  }
  if (targetGradeId && !allowed.grades.some((g) => g.id === targetGradeId)) {
    return { status: "error", message: "El grado seleccionado no es válido." };
  }
  if (targetGroupId && !allowed.groups.some((g) => g.id === targetGroupId)) {
    return { status: "error", message: "No tienes autorización para publicar en ese grupo." };
  }

  const cleanTitle = sanitizeCircularText(input.title);
  const cleanBody = sanitizeCircularText(input.body);
  if (cleanTitle.length < 4 || cleanBody.length < 12) {
    return { status: "error", message: "El título o el mensaje no contienen suficiente texto válido." };
  }

  const now = new Date();
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(circulars)
      .values({
        title: cleanTitle,
        bodySanitized: cleanBody,
        targetScope: input.targetScope,
        targetLevelId,
        targetGradeId,
        targetGroupId,
        authorId: actor.id,
        publishedAt: now,
      })
      .returning({ id: circulars.id });

    await recordAudit(
      {
        actorUserId: actor.id,
        action: "CIRCULAR_CREATED",
        entityType: "circular",
        entityId: created!.id,
        after: { title: cleanTitle, targetScope: input.targetScope, targetGroupId, targetGradeId, targetLevelId },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Circular publicada correctamente." };
}

/** Confirma lectura ("Enterado") de una circular visible para el usuario en sesión. */
export async function markCircularReadAction(
  _prev: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const actor = await requireSession();
  const parsed = circularIdSchema.safeParse({ circularId: formText(formData, "circularId") });
  if (!parsed.success) return { status: "error", message: "Circular inválida." };

  const context = await getCurrentAcademicContext();
  if (!context) return { status: "error", message: "No hay un año lectivo activo." };

  const [circular] = await db
    .select({
      id: circulars.id,
      targetScope: circulars.targetScope,
      targetLevelId: circulars.targetLevelId,
      targetGradeId: circulars.targetGradeId,
      targetGroupId: circulars.targetGroupId,
      authorId: circulars.authorId,
      publishedAt: circulars.publishedAt,
    })
    .from(circulars)
    .where(eq(circulars.id, parsed.data.circularId))
    .limit(1);

  if (!circular || !circular.publishedAt) {
    return { status: "error", message: "La circular no existe o no está publicada." };
  }

  const viewer = await resolveViewerAudience(actor, context.year.id);
  if (!matchesCircularAudience(circular, viewer)) {
    return { status: "error", message: "No tienes acceso a esta circular." };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(circularReads)
      .values({ circularId: circular.id, userId: actor.id })
      .onConflictDoNothing()
      .returning({ id: circularReads.id });

    if (inserted.length > 0) {
      await recordAudit(
        {
          actorUserId: actor.id,
          action: "CIRCULAR_READ",
          entityType: "circular",
          entityId: circular.id,
          ipAddress: ip,
        },
        tx,
      );
    }
  });

  refresh();
  return { status: "success", message: "Lectura confirmada." };
}

/** Elimina una circular (autor, Coordinación o Rectoría/Secretaría). */
export async function deleteCircularAction(
  _prev: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const actor = await requireSession();
  const parsed = circularIdSchema.safeParse({ circularId: formText(formData, "circularId") });
  if (!parsed.success) return { status: "error", message: "Circular inválida." };

  const [circular] = await db
    .select({ id: circulars.id, title: circulars.title, authorId: circulars.authorId })
    .from(circulars)
    .where(eq(circulars.id, parsed.data.circularId))
    .limit(1);
  if (!circular) return { status: "error", message: "La circular ya no existe." };

  const canDelete =
    actor.role === "ADMIN" || actor.role === "COORDINATOR" || circular.authorId === actor.id;
  if (!canDelete) {
    return { status: "error", message: "Solo el autor o Dirección pueden eliminar esta circular." };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.delete(circulars).where(eq(circulars.id, circular.id));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "CIRCULAR_DELETED",
        entityType: "circular",
        entityId: circular.id,
        before: { title: circular.title },
        ipAddress: ip,
      },
      tx,
    );
  });

  refresh();
  return { status: "success", message: "Circular eliminada." };
}
