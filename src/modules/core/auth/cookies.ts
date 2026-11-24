/**
 * Nombres de cookies del Campus. Archivo puro (lo usa también `src/proxy.ts`).
 */
export const SESSION_COOKIE = "lunita_session";

/** Hijo seleccionado por el acudiente. Siempre se revalida contra `guardian_links`. */
export const CHILD_COOKIE = "lunita_hijo";

/** Vigencia de la sesión: 7 días. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
