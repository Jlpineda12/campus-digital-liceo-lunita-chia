/**
 * Política de descuentos de matrícula 2027 (archivo puro: servidor, portal y pruebas).
 *
 * Ningún descuento se autodeclara:
 * - Pronto pago: depende de FECHAS. Es "elegible" si se radica antes del límite y
 *   se CONFIRMA solo si el pago se reporta antes del límite; si no, VENCE.
 * - Hermanos: se VERIFICA en servidor contra matrículas activas y el acudiente
 *   registrado; si no coincide automáticamente, queda en revisión de Secretaría.
 */

/** ⚠ Fecha límite de pronto pago (Secretaría/Rectoría debe confirmarla cada año). */
export const EARLY_BIRD_DEADLINE_2027 = "2026-12-15";

export const EARLY_BIRD_STATUSES = ["NOT_ELIGIBLE", "ELIGIBLE", "CONFIRMED", "EXPIRED"] as const;
export type EarlyBirdStatus = (typeof EARLY_BIRD_STATUSES)[number];

export const SIBLING_CLAIM_STATUSES = ["NOT_REQUESTED", "VERIFIED", "PENDING_REVIEW", "REJECTED"] as const;
export type SiblingClaimStatus = (typeof SIBLING_CLAIM_STATUSES)[number];

export const EARLY_BIRD_LABELS: Record<EarlyBirdStatus, string> = {
  NOT_ELIGIBLE: "No aplica (fuera de la fecha de pronto pago)",
  ELIGIBLE: "Aplica si pagas antes de la fecha límite",
  CONFIRMED: "Confirmado: pagaste a tiempo",
  EXPIRED: "Vencido: el pago se reportó después de la fecha límite",
};

export const SIBLING_LABELS: Record<SiblingClaimStatus, string> = {
  NOT_REQUESTED: "No solicitado",
  VERIFIED: "Verificado",
  PENDING_REVIEW: "En revisión por Secretaría",
  REJECTED: "No aprobado",
};

/** Estado de pronto pago al radicar: depende solo de la fecha. */
export function earlyBirdAtSubmission(today: string, deadline = EARLY_BIRD_DEADLINE_2027): EarlyBirdStatus {
  return today <= deadline ? "ELIGIBLE" : "NOT_ELIGIBLE";
}

/** Al reportar el pago: confirma si llegó a tiempo; vence si llegó tarde. */
export function earlyBirdOnPayment(
  current: EarlyBirdStatus,
  paymentDate: string,
  deadline = EARLY_BIRD_DEADLINE_2027,
): EarlyBirdStatus {
  if (current === "ELIGIBLE" || current === "CONFIRMED" || current === "EXPIRED") {
    return paymentDate <= deadline ? "CONFIRMED" : "EXPIRED";
  }
  return current;
}

/** Descuentos que efectivamente se aplican al valor a pagar. */
export function effectiveDiscounts(state: { earlyBird: EarlyBirdStatus; sibling: SiblingClaimStatus }) {
  return {
    hasEarlyBirdDiscount: state.earlyBird === "ELIGIBLE" || state.earlyBird === "CONFIRMED",
    hasSiblingDiscount: state.sibling === "VERIFIED",
  };
}

/** Días que faltan (0 = hoy es el último día; negativo = ya pasó). */
export function daysUntil(today: string, deadline = EARLY_BIRD_DEADLINE_2027): number {
  const ms = Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
