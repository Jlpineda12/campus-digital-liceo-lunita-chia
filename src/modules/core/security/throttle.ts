/**
 * Política de límite de intentos (REGLAS.md §3.2). Archivo puro: la consulta
 * de conteos vive en `audit/service.ts`.
 *
 * Diseño dual para no permitir bloqueos dirigidos (DoS) ni *password spraying*:
 * - Por IP: frena a quien prueba 1–2 claves contra muchos documentos.
 * - Por cuenta + IP: frena la fuerza bruta contra una cuenta desde un equipo,
 *   sin bloquear al dueño legítimo que entra desde otra red.
 * - Por cuenta (todas las IP, ventana larga): frena ataques distribuidos; el
 *   umbral es alto para que bloquear a alguien exija muchas IP distintas.
 */
export interface ThrottleRule {
  windowMs: number;
  max: number;
}

export interface ThrottlePolicy {
  perIp: ThrottleRule;
  perAccountAndIp: ThrottleRule;
  perAccount: ThrottleRule;
}

const MINUTE = 60 * 1000;

export const LOGIN_POLICY: ThrottlePolicy = {
  perIp: { windowMs: 15 * MINUTE, max: 20 },
  perAccountAndIp: { windowMs: 15 * MINUTE, max: 5 },
  perAccount: { windowMs: 60 * MINUTE, max: 30 },
};

/** Recuperación de clave: evita usar el Campus para inundar buzones. */
export const PASSWORD_RESET_POLICY: ThrottlePolicy = {
  perIp: { windowMs: 15 * MINUTE, max: 10 },
  perAccountAndIp: { windowMs: 15 * MINUTE, max: 3 },
  perAccount: { windowMs: 60 * MINUTE, max: 5 },
};

export interface ThrottleCounts {
  /** `null` si la IP es desconocida (sin proxy de confianza): se omiten las reglas por IP. */
  perIp: number | null;
  perAccountAndIp: number | null;
  perAccount: number;
}

export type ThrottleDecision =
  | { blocked: false }
  | { blocked: true; reason: "ip" | "account"; retryAfterMs: number };

export function evaluateThrottle(policy: ThrottlePolicy, counts: ThrottleCounts): ThrottleDecision {
  if (counts.perIp !== null && counts.perIp >= policy.perIp.max) {
    return { blocked: true, reason: "ip", retryAfterMs: policy.perIp.windowMs };
  }
  if (counts.perAccountAndIp !== null && counts.perAccountAndIp >= policy.perAccountAndIp.max) {
    return { blocked: true, reason: "account", retryAfterMs: policy.perAccountAndIp.windowMs };
  }
  if (counts.perAccount >= policy.perAccount.max) {
    return { blocked: true, reason: "account", retryAfterMs: policy.perAccount.windowMs };
  }
  return { blocked: false };
}

/** Ventana más larga de la política (para acotar la consulta). */
export function longestWindow(policy: ThrottlePolicy): number {
  return Math.max(policy.perIp.windowMs, policy.perAccountAndIp.windowMs, policy.perAccount.windowMs);
}
