import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectAllowedMagicBytes, type AllowedMime } from "./magic-bytes";

export { detectAllowedMagicBytes, type AllowedMime };

/**
 * Almacenamiento privado en disco (fuera de `public/`) con validación estricta
 * de magic bytes. Nunca sirve archivos directamente sin verificación RBAC.
 */

export const MAX_RESOURCE_PDF_BYTES = 10 * 1024 * 1024; // 10 MB para guías docentes
export const MAX_SUBMISSION_FILE_BYTES = 5 * 1024 * 1024; // 5 MB para entregas de estudiantes
export const MAX_IMAGE_FILE_BYTES = 4 * 1024 * 1024; // 4 MB para banners de cursos e imágenes de quices

export type AulaStorageFolder = "resources" | "submissions" | "banners" | "quiz-images";

const EXT_BY_MIME: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<string, AllowedMime> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function getStorageRoot(): string {
  const configured = process.env.PRIVATE_STORAGE_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.VERCEL) return path.resolve("/tmp", "campus-storage");
  return path.resolve(process.cwd(), ".storage", "campus");
}

function resolveSafeKeyPath(storageKey: string): string {
  // Solo permite llaves seguras dentro de `aula/<folder>/<uuid>.<ext>`.
  if (!/^aula\/(resources|submissions|banners|quiz-images)\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/i.test(storageKey)) {
    throw new Error("Llave de almacenamiento inválida.");
  }
  const root = getStorageRoot();
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ruta de almacenamiento fuera de la raíz permitida.");
  }
  return full;
}

export async function savePrivateAulaFile(options: {
  folder: AulaStorageFolder;
  file: File;
  allowedMimes: readonly AllowedMime[];
  maxBytes: number;
}): Promise<{ ok: true; storageKey: string; sizeBytes: number; mime: AllowedMime } | { ok: false; message: string }> {
  const { folder, file, allowedMimes, maxBytes } = options;
  if (file.size <= 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, message: `El archivo supera el límite máximo de ${mb} MB.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectAllowedMagicBytes(buffer);
  if (!detected || !allowedMimes.includes(detected)) {
    const label =
      allowedMimes.length === 1 && allowedMimes[0] === "application/pdf"
        ? "Solo se permiten documentos PDF válidos."
        : !allowedMimes.includes("application/pdf")
          ? "Solo se permiten imágenes PNG, JPG o WebP válidas."
          : "Solo se permiten archivos PDF o imágenes (PNG, JPG, WebP) válidas.";
    return { ok: false, message: label };
  }

  const ext = EXT_BY_MIME[detected];
  const storageKey = `aula/${folder}/${randomUUID()}.${ext}`;
  const targetPath = resolveSafeKeyPath(storageKey);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer, { mode: 0o600 });

  return { ok: true, storageKey, sizeBytes: buffer.length, mime: detected };
}

export async function readPrivateAulaFile(storageKey: string): Promise<{
  buffer: Buffer;
  mime: AllowedMime;
  ext: string;
} | null> {
  try {
    const fullPath = resolveSafeKeyPath(storageKey);
    const buffer = await readFile(fullPath);
    const ext = path.extname(storageKey).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/pdf";
    return { buffer, mime, ext };
  } catch {
    return null;
  }
}

export async function deletePrivateAulaFile(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return;
  try {
    const fullPath = resolveSafeKeyPath(storageKey);
    await unlink(fullPath);
  } catch {
    // Si el archivo ya no existe en disco, ignorar silenciosamente.
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
