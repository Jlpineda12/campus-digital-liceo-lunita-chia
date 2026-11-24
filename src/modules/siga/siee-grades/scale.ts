import type { Tone } from "@/modules/core/auth/roles";

/**
 * Escala de valoración institucional del SIEE (Decreto 1290 — REGLAS.md §2.1).
 * Archivo puro: se puede importar desde servidor y cliente.
 */
export const PERFORMANCE_LEVELS = ["SUPERIOR", "ALTO", "BASICO", "BAJO"] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];

export interface PerformanceMeta {
  label: string;
  short: string;
  tone: Tone;
}

export const PERFORMANCE_META: Record<PerformanceLevel, PerformanceMeta> = {
  SUPERIOR: { label: "Desempeño Superior", short: "S", tone: "green" },
  ALTO: { label: "Desempeño Alto", short: "A", tone: "sky" },
  BASICO: { label: "Desempeño Básico", short: "Bs", tone: "orange" },
  BAJO: { label: "Desempeño Bajo", short: "Bj", tone: "red" },
};

export const MIN_SCORE = 1.0;
export const MAX_SCORE = 5.0;

export interface SieeScale {
  /** Límite inferior de Desempeño Superior. */
  superiorFrom: number;
  /** Límite inferior de Desempeño Alto. */
  altoFrom: number;
  /** Nota mínima aprobatoria (límite inferior de Básico). Configurable por año lectivo. */
  minPassing: number;
}

export const DEFAULT_SIEE_SCALE: SieeScale = {
  superiorFrom: 4.6,
  altoFrom: 4.0,
  minPassing: 3.5,
};

/**
 * Las notas institucionales se expresan con un decimal. Se redondea "mitad hacia
 * arriba" antes de clasificar para que no existan huecos entre rangos
 * (p. ej. 4.55 → 4.6 → Superior).
 */
export function roundScore(score: number): number {
  return Math.round((score + Number.EPSILON) * 10) / 10;
}

export function isValidScore(score: number): boolean {
  return Number.isFinite(score) && score >= MIN_SCORE && score <= MAX_SCORE;
}

export function getPerformanceLevel(
  score: number,
  scale: SieeScale = DEFAULT_SIEE_SCALE,
): PerformanceLevel {
  if (!isValidScore(score)) {
    throw new RangeError(`La nota ${score} está fuera de la escala ${MIN_SCORE}–${MAX_SCORE}.`);
  }
  const rounded = roundScore(score);
  if (rounded >= scale.superiorFrom) return "SUPERIOR";
  if (rounded >= scale.altoFrom) return "ALTO";
  if (rounded >= scale.minPassing) return "BASICO";
  return "BAJO";
}

/** Rangos legibles de la escala, para leyendas y boletines. */
export function describeScale(scale: SieeScale = DEFAULT_SIEE_SCALE) {
  const prev = (n: number) => roundScore(n - 0.1).toFixed(1);
  return [
    { level: "SUPERIOR", from: scale.superiorFrom.toFixed(1), to: MAX_SCORE.toFixed(1) },
    { level: "ALTO", from: scale.altoFrom.toFixed(1), to: prev(scale.superiorFrom) },
    { level: "BASICO", from: scale.minPassing.toFixed(1), to: prev(scale.altoFrom) },
    { level: "BAJO", from: MIN_SCORE.toFixed(1), to: prev(scale.minPassing) },
  ] as const satisfies ReadonlyArray<{ level: PerformanceLevel; from: string; to: string }>;
}
