/**
 * Roles del Campus Digital (RBAC de 5 roles — REGLAS.md §3.3).
 * Archivo puro: se puede importar desde servidor y cliente.
 */
export const ROLES = ["STUDENT", "GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Tono semántico del sistema de diseño asociado a cada rol (SISTEMA_DISENO.md §2.A). */
export type Tone = "sky" | "green" | "purple" | "yellow" | "orange" | "red" | "pink" | "blue";

export interface RoleMeta {
  label: string;
  plural: string;
  tone: Tone;
  description: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  STUDENT: {
    label: "Estudiante",
    plural: "Estudiantes",
    tone: "sky",
    description: "Cursos, tareas, notas y asistencia propias.",
  },
  GUARDIAN: {
    label: "Acudiente",
    plural: "Padres y acudientes",
    tone: "green",
    description: "Seguimiento de tus hijos, boletines, observador y pagos.",
  },
  TEACHER: {
    label: "Docente",
    plural: "Docentes",
    tone: "purple",
    description: "Planillas SIEE, cursos del Aula Virtual y llamado a lista.",
  },
  COORDINATOR: {
    label: "Coordinación",
    plural: "Coordinación",
    tone: "yellow",
    description: "Seguimiento académico, convivencia y cierres de periodo.",
  },
  ADMIN: {
    label: "Secretaría / Rectoría",
    plural: "Secretaría y Rectoría",
    tone: "yellow",
    description: "Gestión institucional, matrículas, usuarios y SIMAT.",
  },
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Roles con gestión institucional (acceso administrativo con trazabilidad). */
export const STAFF_ROLES = ["COORDINATOR", "ADMIN"] as const satisfies readonly Role[];

export function isStaff(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

/**
 * Parámetro `?rol=` que envía el sitio web en Astro hacia `/login`
 * (contrato de rutas públicas — REGLAS.md §1.3).
 */
export const LOGIN_ROLE_PARAMS = {
  estudiantes: "STUDENT",
  padres: "GUARDIAN",
  docentes: "TEACHER",
  directivos: "COORDINATOR",
} as const satisfies Record<string, Role>;

export type LoginRoleParam = keyof typeof LOGIN_ROLE_PARAMS;

export function isLoginRoleParam(value: unknown): value is LoginRoleParam {
  return typeof value === "string" && Object.hasOwn(LOGIN_ROLE_PARAMS, value);
}
