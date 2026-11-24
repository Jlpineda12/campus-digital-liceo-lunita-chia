"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/modules/core/audit/service";
import { requireSession } from "@/modules/core/auth/guards";
import { getRequestMeta } from "@/modules/core/auth/session";
import {
  deletePrivateAvatarFile,
  isValidAvatarKey,
  savePrivateAvatarFile,
} from "./storage";

export interface ProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

/** Sube o reemplaza la foto de perfil del usuario autenticado (estudiantes, docentes, familias y directivos). */
export async function uploadProfilePhotoAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const actor = await requireSession();
  const rawFile = formData.get("avatar");
  if (!(rawFile instanceof File) || rawFile.size === 0) {
    return { status: "error", message: "Elige una imagen PNG, JPG o WebP (máx. 2 MB)." };
  }

  const saved = await savePrivateAvatarFile(rawFile);
  if (!saved.ok) {
    return { status: "error", message: saved.message };
  }

  const [existing] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ avatarUrl: saved.avatarKey }).where(eq(users.id, actor.id));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "PROFILE_AVATAR_UPDATED",
        entityType: "user",
        entityId: actor.id,
        after: { hasAvatar: true, sizeBytes: saved.sizeBytes },
        ipAddress: ip,
      },
      tx,
    );
  });

  if (isValidAvatarKey(existing?.avatarUrl)) {
    await deletePrivateAvatarFile(existing.avatarUrl);
  }

  refresh();
  return { status: "success", message: "Foto de perfil actualizada." };
}

/** Elimina la foto de perfil actual y vuelve a las iniciales institucionales. */
export async function removeProfilePhotoAction(
  prev: ProfileActionState,
): Promise<ProfileActionState> {
  void prev;
  const actor = await requireSession();
  const [existing] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);

  if (!existing?.avatarUrl) {
    return { status: "success", message: "Tu perfil ya usa iniciales." };
  }

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ avatarUrl: null }).where(eq(users.id, actor.id));
    await recordAudit(
      {
        actorUserId: actor.id,
        action: "PROFILE_AVATAR_UPDATED",
        entityType: "user",
        entityId: actor.id,
        after: { hasAvatar: false },
        ipAddress: ip,
      },
      tx,
    );
  });

  await deletePrivateAvatarFile(existing.avatarUrl);
  refresh();
  return { status: "success", message: "Foto de perfil eliminada." };
}
