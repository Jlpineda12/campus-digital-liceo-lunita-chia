import {
  DEFAULT_SIEE_SCALE,
  getPerformanceLevel,
  MAX_SCORE,
  MIN_SCORE,
  roundScore,
  type PerformanceLevel,
  type SieeScale,
} from "./scale";

/**
 * Motor de cálculo SIEE (docs/secciones/06 §3.1). Archivo puro: lo usan el
 * servidor (fuente de verdad) y la planilla (cálculo en vivo).
 */
export type SieeDimension = "SABER" | "HACER" | "SER" | "QUALITATIVE";

/** Valoración cualitativa de Preescolar (docs/secciones/04 §2.B). */
export const QUALITATIVE_LEVELS = ["ALCANZADO", "EN_PROCESO", "REQUIERE_ACOMPANAMIENTO"] as const;
export type QualitativeLevel = (typeof QUALITATIVE_LEVELS)[number];
export const QUALITATIVE_LABELS: Record<QualitativeLevel, string> = {
  ALCANZADO: "Alcanzado",
  EN_PROCESO: "En proceso",
  REQUIERE_ACOMPANAMIENTO: "Requiere acompañamiento",
};
export function isQualitativeLevel(value: unknown): value is QualitativeLevel {
  return typeof value === "string" && (QUALITATIVE_LEVELS as readonly string[]).includes(value);
}
export type NumericDimension = Exclude<SieeDimension, "QUALITATIVE">;

export const DIMENSION_LABELS: Record<SieeDimension, string> = {
  SABER: "Saber",
  HACER: "Hacer",
  SER: "Ser",
  QUALITATIVE: "Valoración cualitativa",
};

export const DIMENSION_HINTS: Record<SieeDimension, string> = {
  SABER: "Cognitivo",
  HACER: "Procedimental",
  SER: "Actitudinal",
  QUALITATIVE: "Dimensiones del desarrollo",
};

/**
 * Peso institucional de cada dimensión en la definitiva del periodo.
 * ⚠ Propuesta: Coordinación Académica debe validarla con el SIEE del colegio.
 */
export const DEFAULT_DIMENSION_WEIGHTS: Record<NumericDimension, number> = {
  SABER: 40,
  HACER: 40,
  SER: 20,
};

export interface WeightedValue {
  value: number | null | undefined;
  weight: number;
}

/** Promedio ponderado ignorando valores vacíos (promedio parcial del periodo). */
export function weightedAverage(items: readonly WeightedValue[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const { value, weight } of items) {
    if (value === null || value === undefined || !(weight > 0)) continue;
    sum += value * weight;
    weights += weight;
  }
  return weights > 0 ? sum / weights : null;
}

export interface CalcDimension {
  competencyId: string;
  dimension: SieeDimension;
  weightPercent: number;
  columns: ReadonlyArray<{ id: string; weightPercent: number }>;
}

export interface StudentPeriodResult {
  /** Promedio (sin redondear) por `competencyId`. */
  byDimension: Record<string, number | null>;
  final: number | null;
  level: PerformanceLevel | null;
  gradedColumns: number;
  totalColumns: number;
}

/**
 * Definitiva del periodo: promedio ponderado de columnas dentro de cada dimensión
 * y de las dimensiones entre sí; se redondea a 1 decimal antes de clasificar.
 * Con notas faltantes se calcula sobre lo registrado (promedio parcial).
 */
export function computeStudentPeriod(
  dimensions: readonly CalcDimension[],
  scoreOf: (columnId: string) => number | null | undefined,
  scale: SieeScale = DEFAULT_SIEE_SCALE,
): StudentPeriodResult {
  const byDimension: Record<string, number | null> = {};
  let gradedColumns = 0;
  let totalColumns = 0;

  for (const dim of dimensions) {
    if (dim.dimension === "QUALITATIVE") continue;
    const values = dim.columns.map((c) => {
      const value = scoreOf(c.id);
      totalColumns += 1;
      if (value !== null && value !== undefined) gradedColumns += 1;
      return { value, weight: c.weightPercent };
    });
    byDimension[dim.competencyId] = weightedAverage(values);
  }

  const raw = weightedAverage(
    dimensions
      .filter((d) => d.dimension !== "QUALITATIVE")
      .map((d) => ({ value: byDimension[d.competencyId], weight: d.weightPercent })),
  );
  const final = raw === null ? null : roundScore(raw);
  return {
    byDimension,
    final,
    level: final === null ? null : getPerformanceLevel(final, scale),
    gradedColumns,
    totalColumns,
  };
}

/** Definitiva anual: pondera los periodos con nota según `academic_periods.weight_percent`. */
export function computeAnnualFinal(
  periods: ReadonlyArray<{ weightPercent: number; final: number | null }>,
): number | null {
  const raw = weightedAverage(periods.map((p) => ({ value: p.final, weight: p.weightPercent })));
  return raw === null ? null : roundScore(raw);
}

/** Peso disponible en una dimensión para una columna nueva. */
export function remainingWeight(columns: ReadonlyArray<{ weightPercent: number }>): number {
  const used = columns.reduce((sum, c) => sum + c.weightPercent, 0);
  return Math.max(0, Math.round((100 - used) * 100) / 100);
}

export type ParsedScore = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Lee lo que escribe el docente en una celda: vacío borra la nota; acepta coma o
 * punto decimal ("4,5" o "4.5"); máximo un decimal y rango institucional.
 */
export function parseScoreInput(raw: string): ParsedScore {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: true, value: null };
  if (!/^\d(\.\d)?$/.test(text)) {
    return { ok: false, error: `Escribe una nota entre ${MIN_SCORE.toFixed(1)} y ${MAX_SCORE.toFixed(1)} con un decimal.` };
  }
  const value = Number(text);
  if (value < MIN_SCORE || value > MAX_SCORE) {
    return { ok: false, error: `La nota debe estar entre ${MIN_SCORE.toFixed(1)} y ${MAX_SCORE.toFixed(1)}.` };
  }
  return { ok: true, value };
}

/** Formato institucional: siempre un decimal ("4.0"). */
export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : roundScore(value).toFixed(1);
}
