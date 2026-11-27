/**
 * Boletín final del año (archivo puro: servidor y pruebas).
 *
 * La definitiva de cada asignatura pondera los periodos con nota según
 * `academic_periods.weight_percent` (`computeAnnualFinal`). Si faltan periodos
 * por habilitar, la definitiva es PARCIAL y así se rotula.
 * La promoción NO se decide aquí: la define la Comisión de Evaluación y
 * Promoción (Decreto 1290 de 2009); solo se informan las asignaturas en Bajo.
 */
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { computeAnnualFinal } from "@/modules/siga/siee-grades/calculator";
import {
  getPerformanceLevel,
  roundScore,
  type PerformanceLevel,
  type SieeScale,
} from "@/modules/siga/siee-grades/scale";

export interface AnnualPeriodInput {
  id: string;
  number: number;
  name: string;
  weightPercent: number;
  /** Para familias: el periodo cuenta solo si Rectoría habilitó su boletín. */
  included: boolean;
}

export interface PeriodSubjectFinal {
  courseAssignmentId: string;
  subjectName: string;
  pillar: StheamiPillar;
  final: number | null;
}

export interface AnnualSubjectRow {
  courseAssignmentId: string;
  subjectName: string;
  pillar: StheamiPillar;
  /** Nota por periodo, en el orden de `periods` (null = sin nota o no habilitado). */
  finals: Array<number | null>;
  annual: number | null;
  level: PerformanceLevel | null;
}

export interface AnnualSummary {
  periods: AnnualPeriodInput[];
  subjects: AnnualSubjectRow[];
  overallAverage: number | null;
  overallLevel: PerformanceLevel | null;
  /** Asignaturas con definitiva en Bajo (posibles actividades de recuperación). */
  lowSubjects: string[];
  includedCount: number;
  isPartial: boolean;
}

export function buildAnnualSummary(
  periods: readonly AnnualPeriodInput[],
  perPeriod: ReadonlyMap<string, readonly PeriodSubjectFinal[]>,
  scale: SieeScale,
): AnnualSummary {
  const ordered = [...periods].sort((a, b) => a.number - b.number);
  const subjects = new Map<string, Omit<AnnualSubjectRow, "finals" | "annual" | "level">>();
  for (const period of ordered) {
    for (const s of perPeriod.get(period.id) ?? []) {
      if (!subjects.has(s.courseAssignmentId)) {
        subjects.set(s.courseAssignmentId, {
          courseAssignmentId: s.courseAssignmentId,
          subjectName: s.subjectName,
          pillar: s.pillar,
        });
      }
    }
  }

  const rows: AnnualSubjectRow[] = [...subjects.values()]
    .map((subject) => {
      const finals = ordered.map((p) =>
        p.included
          ? (perPeriod.get(p.id)?.find((s) => s.courseAssignmentId === subject.courseAssignmentId)?.final ?? null)
          : null,
      );
      const annual = computeAnnualFinal(
        ordered.map((p, i) => ({ weightPercent: p.weightPercent, final: finals[i] ?? null })),
      );
      return { ...subject, finals, annual, level: annual === null ? null : getPerformanceLevel(annual, scale) };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"));

  const annuals = rows.map((r) => r.annual).filter((v): v is number => v !== null);
  const overallAverage =
    annuals.length > 0 ? roundScore(annuals.reduce((sum, v) => sum + v, 0) / annuals.length) : null;
  const includedCount = ordered.filter((p) => p.included).length;

  return {
    periods: ordered,
    subjects: rows,
    overallAverage,
    overallLevel: overallAverage === null ? null : getPerformanceLevel(overallAverage, scale),
    lowSubjects: rows.filter((r) => r.level === "BAJO").map((r) => r.subjectName),
    includedCount,
    isPartial: includedCount < ordered.length,
  };
}
