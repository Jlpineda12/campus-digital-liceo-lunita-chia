import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectAllowedMagicBytes } from "@/modules/aula/magic-bytes";

/**
 * Almacenamiento privado de fotos de perfil (fuera de `public/`, Ley 1581).
 * Acepta únicamente PNG, JPEG o WebP verificados por magic bytes (máx. 2 MB).
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_KEY_RE = /^avatars\/[0-9a-f-]{36}\.(png|jpg|webp)$/i;

type AvatarMime = "image/png" | "image/jpeg" | "image/webp";

const EXT_BY_MIME: Record<AvatarMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<string, AvatarMime> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function isValidAvatarKey(key: string | null | undefined): key is string {
  return Boolean(key && AVATAR_KEY_RE.test(key));
}

/** Construye la URL autenticada de la foto de perfil con parámetro de versión anti-caché. */
export function buildAvatarApiUrl(userId: string, avatarKey: string | null | undefined): string | null {
  if (!isValidAvatarKey(avatarKey)) return null;
  const tag = avatarKey.slice(8, 16);
  return `/api/perfil/avatar/${userId}?v=${tag}`;
}

function getStorageRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.VERCEL) return path.resolve("/tmp", "campus-storage");
  return path.resolve(process.cwd(), ".storage", "campus");
}

function resolveAvatarPath(avatarKey: string): string {
  if (!isValidAvatarKey(avatarKey)) {
    throw new Error("Llave de foto de perfil inválida.");
  }
  const root = getStorageRoot();
  const full = path.resolve(root, avatarKey);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ruta fuera de la raíz de almacenamiento.");
  }
  return full;
}

export async function savePrivateAvatarFile(
  file: File,
): Promise<{ ok: true; avatarKey: string; sizeBytes: number } | { ok: false; message: string }> {
  if (file.size <= 0) return { ok: false, message: "Selecciona una imagen válida." };
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "La foto de perfil debe pesar máximo 2 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectAllowedMagicBytes(buffer);
  if (detected !== "image/png" && detected !== "image/jpeg" && detected !== "image/webp") {
    return { ok: false, message: "Solo se permiten imágenes reales en formato PNG, JPG o WebP." };
  }

  const ext = EXT_BY_MIME[detected];
  const avatarKey = `avatars/${randomUUID()}.${ext}`;
  const fullPath = resolveAvatarPath(avatarKey);

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer, { mode: 0o600 });

  return { ok: true, avatarKey, sizeBytes: buffer.length };
}

export async function readPrivateAvatarFile(avatarKey: string): Promise<{ buffer: Buffer; mime: AvatarMime } | null> {
  if (!isValidAvatarKey(avatarKey)) return null;
  try {
    const fullPath = resolveAvatarPath(avatarKey);
    const buffer = await readFile(fullPath);
    const ext = path.extname(avatarKey).slice(1).toLowerCase();
    return { buffer, mime: MIME_BY_EXT[ext] ?? "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deletePrivateAvatarFile(avatarKey: string | null | undefined): Promise<void> {
  if (!isValidAvatarKey(avatarKey)) return;
  try {
    await unlink(resolveAvatarPath(avatarKey));
  } catch {
    // Ignora si el archivo ya no existe en disco.
  }
}
