import type { Tone } from "@/modules/core/auth/roles";

/** Une clases CSS ignorando valores vacíos. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Clase de tono semántico del sistema de diseño (`.t-sky`, `.t-green`, …). */
export function toneClass(tone: Tone): string {
  return `t-${tone}`;
}
