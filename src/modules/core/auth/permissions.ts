import type { Role } from "./roles";

/**
 * Matriz de permisos por rol (docs/secciones/05 §1 y REGLAS.md §3.3). Archivo puro.
 *
 * Los permisos dicen QUÉ puede hacer un rol. El ALCANCE sobre un recurso concreto
 * (qué estudiante, qué curso) se valida aparte con las políticas de `policies.ts`
 * (`canAccessStudent`, `teacher_id === actor.id`, `is_financial_responsible`…).
 */
const STAFF = ["COORDINATOR", "ADMIN"] as const;
const ADMIN = ["ADMIN"] as const;

export const PERMISSIONS = {
  // Tablero y seguimiento institucional
  "dashboard.executive": STAFF,
  "attendance.excuses.review": STAFF,
  "observer.review": STAFF,
  "periods.unlock": STAFF,
  "audit.read.academic": STAFF,
  "audit.read.all": ADMIN,

  // Estructura académica: Coordinación edita lo académico; Secretaría/Rectoría todo.
  "structure.read": STAFF,
  "structure.edit.academic": STAFF,
  "structure.manage": ADMIN,

  // Boletines y certificados
  "reportCards.preview": STAFF,
  "reportCards.issue": ADMIN,
  "reportCards.billingLock": ADMIN,

  // Matrículas 2027
  "enrollment.review": STAFF,
  "enrollment.approve.academic": STAFF,
  "enrollment.formalize": ADMIN,

  // Usuarios y sesiones
  "users.read": STAFF,
  "users.manage": ADMIN,
  "sessions.revoke": ADMIN,

  // Cartera, migración y SIMAT
  "billing.manage": ADMIN,
  "migration.run": ADMIN,
  "simat.export": ADMIN,

  // Docentes (alcance: sus course_assignments / su dirección de grupo)
  "grades.edit.ownCourses": ["TEACHER"],
  "attendance.take": ["TEACHER"],
  "observer.create": ["TEACHER", "COORDINATOR", "ADMIN"],
  "aula.manage.ownCourses": ["TEACHER"],

  // Familias y estudiantes (alcance: hijos vinculados / sí mismo)
  "attendance.excuses.submit": ["GUARDIAN"],
  "observer.acknowledge": ["GUARDIAN"],
  "billing.view.family": ["GUARDIAN"],
  "observer.statement": ["STUDENT"],
  "aula.submit": ["STUDENT"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}
