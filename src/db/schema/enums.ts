import { pgEnum } from "drizzle-orm/pg-core";
import {
  ASSESSMENT_MODES,
  DOCUMENT_TYPES,
  GUARDIAN_RELATIONSHIPS,
  LEVEL_CODES,
} from "@/modules/core/academic-structure/constants";
import { STHEAMI_PILLARS } from "@/modules/core/academic-structure/stheami";
import { ROLES } from "@/modules/core/auth/roles";

/**
 * Tipos ENUM nativos de PostgreSQL para catálogos estables (la base rechaza
 * valores inválidos). Las acciones de auditoría NO son enum: crecen con cada
 * módulo y se tipan solo en TypeScript para evitar ALTER TYPE frecuentes.
 */
export const userRole = pgEnum("user_role", ROLES);
export const documentType = pgEnum("document_type", DOCUMENT_TYPES);
export const guardianRelationship = pgEnum("guardian_relationship", GUARDIAN_RELATIONSHIPS);
export const levelCode = pgEnum("level_code", LEVEL_CODES);
export const assessmentMode = pgEnum("assessment_mode", ASSESSMENT_MODES);
export const stheamiPillar = pgEnum("stheami_pillar", STHEAMI_PILLARS);

export const ENROLLMENT_STATUSES = ["ACTIVE", "PRE_ENROLLED", "WITHDRAWN", "GRADUATED"] as const;
export const ENROLLMENT_TYPES = ["NEW", "RENEWAL"] as const;
export const enrollmentStatus = pgEnum("enrollment_status", ENROLLMENT_STATUSES);
export const enrollmentType = pgEnum("enrollment_type", ENROLLMENT_TYPES);
