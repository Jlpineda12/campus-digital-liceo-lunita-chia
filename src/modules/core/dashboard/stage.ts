import type { LevelCode } from "@/modules/core/academic-structure/constants";
import type { Role } from "@/modules/core/auth/roles";

/**
 * Sistema visual dual (SISTEMA_DISENO.md §1). Archivo puro.
 * - primaria: Preescolar y Primaria → lúdico, táctil 3D.
 * - bachillerato: 6° a 11° → serio, editorial.
 * - institucional: docentes, directivos y marco del acudiente → alta productividad.
 */
export const STAGES = ["primaria", "bachillerato", "institucional"] as const;
export type Stage = (typeof STAGES)[number];

/** Etapa del bloque académico de un estudiante según su nivel. */
export function stageForLevel(level: LevelCode | null | undefined): Stage {
  if (level === "PREESCOLAR" || level === "PRIMARIA") return "primaria";
  // Bachillerato o sin matrícula activa: registro sobrio por defecto.
  return "bachillerato";
}

/** Etapa del marco del Campus (sidebar, encabezado) para el usuario en sesión. */
export function frameStage(role: Role, studentLevel: LevelCode | null | undefined): Stage {
  return role === "STUDENT" ? stageForLevel(studentLevel) : "institucional";
}
