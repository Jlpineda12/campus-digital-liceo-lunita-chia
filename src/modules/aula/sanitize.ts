import { MAX_SCORE, MIN_SCORE, roundScore } from "@/modules/siga/siee-grades/scale";

/**
 * Utilidades puras de seguridad y evaluación para Órbita Virtual (Aula Virtual).
 * Previenen XSS (cero HTML crudo), bloquean esquemas peligrosos (`javascript:`)
 * y normalizan calificaciones a la escala institucional SIEE (1.0 – 5.0).
 */

export function sanitizeAulaText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Permite únicamente URLs `https://` o `http://` válidas. Rechaza `javascript:`,
 * `data:`, `vbscript:` y URLs malformadas.
 */
export function sanitizeSafeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Determina si una entrega se realiza después de la fecha límite (con 60 s de gracia). */
export function isLateSubmission(dueDate: Date | null, submittedAt: Date): boolean {
  if (!dueDate) return false;
  return submittedAt.getTime() > dueDate.getTime() + 60_000;
}

/** Normaliza una calificación del Aula Virtual (0..maxScore) a la escala SIEE 1.0–5.0. */
export function normalizeToSieeScore(score: number, maxScore: number = MAX_SCORE): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw new RangeError("Calificación fuera de rango.");
  }
  const scaled = maxScore === MAX_SCORE ? score : MIN_SCORE + (score / maxScore) * (MAX_SCORE - MIN_SCORE);
  const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, scaled));
  return roundScore(clamped);
}
