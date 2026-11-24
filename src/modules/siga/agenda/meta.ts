import type { Role } from "@/modules/core/auth/roles";

export type CircularScope = "ALL" | "LEVEL" | "GRADE" | "GROUP";

export const CIRCULAR_SCOPE_LABELS: Record<CircularScope, string> = {
  ALL: "Toda la institución",
  LEVEL: "Nivel educativo",
  GRADE: "Grado escolar",
  GROUP: "Grupo específico",
};

/** Roles autorizados a publicar comunicados o circulares. */
export function canPublishCircular(role: Role): boolean {
  return role === "ADMIN" || role === "COORDINATOR" || role === "TEACHER";
}

/** Solo Coordinación y Rectoría/Secretaría pueden publicar a toda la institución, niveles o grados. */
export function canPublishInstitutional(role: Role): boolean {
  return role === "ADMIN" || role === "COORDINATOR";
}

/**
 * Sanitiza texto plano para circulares: elimina etiquetas HTML y caracteres de
 * control preservando saltos de línea legibles (cero HTML crudo).
 */
export function sanitizeCircularText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface CircularTarget {
  targetScope: CircularScope;
  targetLevelId: string | null;
  targetGradeId: string | null;
  targetGroupId: string | null;
  authorId: string | null;
}

export interface ViewerAudience {
  userId: string;
  role: Role;
  levelIds: ReadonlySet<string>;
  gradeIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
}

/**
 * Determina si una persona en sesión está autorizada a ver y confirmar lectura
 * de una circular concreta (prevención de IDOR).
 */
export function matchesCircularAudience(circular: CircularTarget, viewer: ViewerAudience): boolean {
  if (viewer.role === "ADMIN" || viewer.role === "COORDINATOR") return true;
  if (circular.authorId && circular.authorId === viewer.userId) return true;

  switch (circular.targetScope) {
    case "ALL":
      return true;
    case "LEVEL":
      return Boolean(circular.targetLevelId && viewer.levelIds.has(circular.targetLevelId));
    case "GRADE":
      return Boolean(circular.targetGradeId && viewer.gradeIds.has(circular.targetGradeId));
    case "GROUP":
      return Boolean(circular.targetGroupId && viewer.groupIds.has(circular.targetGroupId));
  }
}
