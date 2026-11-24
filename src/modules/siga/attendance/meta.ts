import type { Tone } from "@/modules/core/auth/roles";

/**
 * Catálogo y reglas puras del módulo de Asistencia y Excusas
 * (docs/secciones/04 §3, 03 §D y 06). Archivo puro (servidor y cliente).
 */
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export interface AttendanceStatusMeta {
  code: "P" | "F" | "R" | "E";
  label: string;
  tone: Tone;
}

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, AttendanceStatusMeta> = {
  PRESENT: { code: "P", label: "Presente", tone: "green" },
  ABSENT: { code: "F", label: "Falla", tone: "red" },
  LATE: { code: "R", label: "Retardo", tone: "orange" },
  EXCUSED: { code: "E", label: "Excusa", tone: "sky" },
};

export const EXCUSE_REASON_TYPES = ["MEDICA", "CALAMIDAD", "INSTITUCIONAL", "OTRA"] as const;
export type ExcuseReasonType = (typeof EXCUSE_REASON_TYPES)[number];

export const EXCUSE_REASON_LABELS: Record<ExcuseReasonType, string> = {
  MEDICA: "Incapacidad o cita médica",
  CALAMIDAD: "Calamidad doméstica",
  INSTITUCIONAL: "Representación institucional (Banda / STHEAMI)",
  OTRA: "Otro motivo justificado",
};

export const EXCUSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ExcuseStatus = (typeof EXCUSE_STATUSES)[number];

export function isExcuseStatus(value: unknown): value is ExcuseStatus {
  return typeof value === "string" && (EXCUSE_STATUSES as readonly string[]).includes(value);
}

export const EXCUSE_STATUS_META: Record<ExcuseStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "En revisión", tone: "orange" },
  APPROVED: { label: "Aprobada", tone: "green" },
  REJECTED: { label: "Rechazada", tone: "red" },
};

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Porcentaje de asistencia cubierta (Presente + Retardo + Excusa sobre total). */
  ratePercent: number;
}

export function computeAttendanceStats(counts: {
  present: number;
  absent: number;
  late: number;
  excused: number;
}): AttendanceStats {
  const total = counts.present + counts.absent + counts.late + counts.excused;
  const covered = counts.present + counts.late + counts.excused;
  const ratePercent = total === 0 ? 100 : Math.round((covered / total) * 100);
  return { ...counts, total, ratePercent };
}

/** Valida formato YYYY-MM-DD y existencia real en calendario gregoriano. */
export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function daysBetweenIso(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = toDate.split("-").map(Number) as [number, number, number];
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}
