import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectAllowedMagicBytes, type AllowedMime } from "@/modules/aula/magic-bytes";

/**
 * Almacenamiento privado para los 8 documentos de admisión y soportes de pago
 * (fuera de `public/`, Ley 1581). Valida magic bytes reales (PDF, PNG, JPG, WebP).
 */

export const MAX_ADMISSION_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ADMISSION_KEY_RE = /^admissions\/[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/i;

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

function resolveAdmissionFilePath(storageKey: string): string {
  if (!ADMISSION_KEY_RE.test(storageKey)) {
    throw new Error("Llave de documento de matrícula inválida.");
  }
  const root = getStorageRoot();
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ruta fuera del almacenamiento privado.");
  }
  return full;
}

export async function savePrivateAdmissionFile(
  file: File,
): Promise<{ ok: true; storageKey: string; sizeBytes: number; originalName: string } | { ok: false; message: string }> {
  if (file.size <= 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > MAX_ADMISSION_FILE_BYTES) {
    return { ok: false, message: "Cada documento debe pesar máximo 5 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectAllowedMagicBytes(buffer);
  if (!detected) {
    return { ok: false, message: "Solo se admiten documentos PDF o imágenes reales (PNG, JPG, WebP)." };
  }

  const ext = EXT_BY_MIME[detected];
  const storageKey = `admissions/${randomUUID()}.${ext}`;
  const fullPath = resolveAdmissionFilePath(storageKey);

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer, { mode: 0o600 });

  const safeOriginal = (file.name || `documento.${ext}`).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return { ok: true, storageKey, sizeBytes: buffer.length, originalName: safeOriginal };
}

export async function readPrivateAdmissionFile(
  storageKey: string,
): Promise<{ buffer: Buffer; mime: AllowedMime; ext: string } | null> {
  if (!ADMISSION_KEY_RE.test(storageKey)) return null;
  try {
    const fullPath = resolveAdmissionFilePath(storageKey);
    const buffer = await readFile(fullPath);
    const ext = path.extname(storageKey).slice(1).toLowerCase();
    return { buffer, mime: MIME_BY_EXT[ext] ?? "application/pdf", ext };
  } catch {
    return null;
  }
}
