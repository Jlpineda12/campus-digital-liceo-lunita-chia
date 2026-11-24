/**
 * Utilidades de calendario escolar sobre fechas `YYYY-MM-DD` (sin zona horaria).
 * Archivo puro: se puede importar desde servidor y cliente.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
}

export interface PeriodProgress {
  status: "upcoming" | "active" | "finished";
  /** 0–100 */
  percent: number;
  daysLeft: number;
}

export function getPeriodProgress(
  period: { startDate: string; endDate: string },
  today: string,
): PeriodProgress {
  const total = Math.max(daysBetween(period.startDate, period.endDate), 1);
  if (today < period.startDate) {
    return { status: "upcoming", percent: 0, daysLeft: daysBetween(today, period.endDate) };
  }
  if (today > period.endDate) {
    return { status: "finished", percent: 100, daysLeft: 0 };
  }
  const elapsed = daysBetween(period.startDate, today);
  return {
    status: "active",
    percent: Math.round((elapsed / total) * 100),
    daysLeft: daysBetween(today, period.endDate),
  };
}

/** Periodo vigente: el que contiene la fecha; entre periodos, el último iniciado. */
export function pickCurrentPeriod<T extends { number: number; startDate: string; endDate: string }>(
  periods: readonly T[],
  today: string,
): T | null {
  const sorted = [...periods].sort((a, b) => a.number - b.number);
  return (
    sorted.find((p) => p.startDate <= today && today <= p.endDate) ??
    sorted.filter((p) => p.startDate <= today).at(-1) ??
    sorted[0] ??
    null
  );
}

const shortDate = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "14 sept – 27 nov" */
export function formatDateRange(startIso: string, endIso: string): string {
  return `${shortDate.format(toUtc(startIso))} – ${shortDate.format(toUtc(endIso))}`;
}
