/**
 * Catálogos de la estructura escolar colombiana.
 * Archivo puro: se puede importar desde servidor y cliente.
 */

export const LEVEL_CODES = ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const LEVEL_LABELS: Record<LevelCode, string> = {
  PREESCOLAR: "Preescolar",
  PRIMARIA: "Primaria",
  BACHILLERATO: "Bachillerato",
};

/** Tipos de documento de identidad usados en SIMAT. */
export const DOCUMENT_TYPES = ["RC", "TI", "CC", "CE", "NUIP", "PPT", "PA"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RC: "Registro Civil",
  TI: "Tarjeta de Identidad",
  CC: "Cédula de Ciudadanía",
  CE: "Cédula de Extranjería",
  NUIP: "NUIP",
  PPT: "Permiso por Protección Temporal",
  PA: "Pasaporte",
};

export const GUARDIAN_RELATIONSHIPS = ["MADRE", "PADRE", "ACUDIENTE"] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  MADRE: "Madre",
  PADRE: "Padre",
  ACUDIENTE: "Acudiente",
};

/**
 * Modo de valoración por grado (REGLAS.md §2.1): Preescolar admite valoración
 * cualitativa/descriptiva por dimensiones además o en lugar de la numérica.
 */
export const ASSESSMENT_MODES = ["NUMERIC", "QUALITATIVE", "MIXED"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export const ASSESSMENT_MODE_LABELS: Record<AssessmentMode, string> = {
  NUMERIC: "Numérica (1.0 – 5.0)",
  QUALITATIVE: "Cualitativa por dimensiones",
  MIXED: "Numérica y cualitativa",
};
