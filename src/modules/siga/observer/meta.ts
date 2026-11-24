import type { Tone } from "@/modules/core/auth/roles";

/**
 * Catálogo y reglas puras de debido proceso del Observador del Estudiante
 * (REGLAS.md §2.4, docs/secciones/02–06). Archivo puro (servidor y cliente).
 */
export const OBSERVER_CATEGORIES = ["PRAISE", "ACADEMIC", "TYPE_I", "TYPE_II", "TYPE_III"] as const;
export type ObserverCategory = (typeof OBSERVER_CATEGORIES)[number];

export function isObserverCategory(value: unknown): value is ObserverCategory {
  return typeof value === "string" && (OBSERVER_CATEGORIES as readonly string[]).includes(value);
}

export interface ObserverCategoryMeta {
  label: string;
  shortLabel: string;
  tone: Tone;
  /** Categorías de seguimiento o convivencia habilitan el derecho a descargos del estudiante. */
  allowsStudentStatement: boolean;
  /** Situaciones Tipo II y III generan alerta prioritaria para Coordinación y Rectoría. */
  escalatesToCoordination: boolean;
  description: string;
}

export const OBSERVER_CATEGORY_META: Record<ObserverCategory, ObserverCategoryMeta> = {
  PRAISE: {
    label: "Felicitación / Reconocimiento",
    shortLabel: "Felicitación",
    tone: "green",
    allowsStudentStatement: false,
    escalatesToCoordination: false,
    description: "Logros académicos, convivencia ejemplar, STHEAMI, Banda Marcial o valores.",
  },
  ACADEMIC: {
    label: "Seguimiento académico",
    shortLabel: "Académico",
    tone: "sky",
    allowsStudentStatement: true,
    escalatesToCoordination: false,
    description: "Acompañamiento pedagógico, compromisos de estudio o planes de mejora.",
  },
  TYPE_I: {
    label: "Situación Tipo I",
    shortLabel: "Tipo I",
    tone: "orange",
    allowsStudentStatement: true,
    escalatesToCoordination: false,
    description: "Conflicto manejado pedagógicamente en el aula (Manual de Convivencia).",
  },
  TYPE_II: {
    label: "Situación Tipo II",
    shortLabel: "Tipo II",
    tone: "red",
    allowsStudentStatement: true,
    escalatesToCoordination: true,
    description: "Agresión o reiteración que requiere atención de Coordinación de Convivencia.",
  },
  TYPE_III: {
    label: "Situación Tipo III",
    shortLabel: "Tipo III",
    tone: "red",
    allowsStudentStatement: true,
    escalatesToCoordination: true,
    description: "Situación de atención prioritaria por Rectoría y Comité de Convivencia.",
  },
};

export interface ObserverWorkflowSnapshot {
  category: ObserverCategory;
  studentStatement: string | null;
  guardianAcknowledgedAt: Date | null;
}

/** El estudiante puede registrar descargos una sola vez en anotaciones de seguimiento/convivencia. */
export function canStudentAddStatement(record: ObserverWorkflowSnapshot): boolean {
  return OBSERVER_CATEGORY_META[record.category].allowsStudentStatement && !record.studentStatement;
}

/** El acudiente puede confirmar lectura ("Enterado") si aún no ha firmado la anotación. */
export function canGuardianAcknowledge(record: ObserverWorkflowSnapshot): boolean {
  return record.guardianAcknowledgedAt === null;
}

export type ObserverWorkflowStatus =
  | "ACKNOWLEDGED"
  | "PENDING_STATEMENT"
  | "PENDING_GUARDIAN";

export function getObserverWorkflowStatus(record: ObserverWorkflowSnapshot): ObserverWorkflowStatus {
  if (record.guardianAcknowledgedAt !== null) return "ACKNOWLEDGED";
  if (canStudentAddStatement(record)) return "PENDING_STATEMENT";
  return "PENDING_GUARDIAN";
}

export const WORKFLOW_STATUS_LABELS: Record<ObserverWorkflowStatus, { label: string; tone: Tone }> = {
  ACKNOWLEDGED: { label: "Firmado (Enterado)", tone: "green" },
  PENDING_STATEMENT: { label: "Pendiente descargos y firma", tone: "orange" },
  PENDING_GUARDIAN: { label: "Pendiente Enterado acudiente", tone: "sky" },
};
