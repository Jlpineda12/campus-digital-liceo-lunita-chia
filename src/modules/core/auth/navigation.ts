import { PLATFORM_SPACES } from "@/modules/core/brand/config";
import type { Role } from "./roles";

/**
 * Mapa de navegación del Campus por rol. Archivo puro (se envía al cliente solo
 * la lista ya filtrada para el rol en sesión).
 */

export type NavIcon =
  | "home"
  | "courses"
  | "tasks"
  | "grades"
  | "reportCards"
  | "observer"
  | "attendance"
  | "agenda"
  | "billing"
  | "structure"
  | "users"
  | "enrollment"
  | "migration";

export type NavSection = "inicio" | "aula" | "siga" | "admin";

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  inicio: "Inicio",
  aula: PLATFORM_SPACES.aula.name,
  siga: PLATFORM_SPACES.siga.name,
  admin: PLATFORM_SPACES.admin.name,
};

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  section: NavSection;
  /** Fase del plan en la que se habilita (PLAN_MIGRACION_Y_FASES.md). */
  phase: 1 | 2 | 3 | 4 | 5;
  roles: readonly Role[];
  /** Palabras clave adicionales para el buscador Ctrl+K. */
  keywords?: string;
}

/**
 * Módulos publicados. Se habilitan uno a uno al terminar cada pantalla (no por
 * fase completa), para no mostrar nunca rutas a medio construir.
 */
export const RELEASED_MODULES: ReadonlySet<string> = new Set([
  "dashboard",
  "courses",
  "tasks",
  "grades",
  "reportCards",
  "observer",
  "attendance",
  "agenda",
  "billing",
  "structure",
  "users",
  "enrollment",
  "migration",
]);

const ALL: readonly Role[] = ["STUDENT", "GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"];

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", label: "Inicio", href: "/dashboard", icon: "home", section: "inicio", phase: 1, roles: ALL, keywords: "panel resumen" },

  { key: "courses", label: "Mis cursos", href: "/aula", icon: "courses", section: "aula", phase: 3, roles: ["STUDENT", "GUARDIAN", "TEACHER"], keywords: "asignaturas materias aula virtual" },
  { key: "tasks", label: "¿Qué tareas tengo?", href: "/aula/tareas", icon: "tasks", section: "aula", phase: 3, roles: ["STUDENT", "GUARDIAN"], keywords: "entregas pendientes" },

  { key: "grades", label: "Calificaciones", href: "/siga/calificaciones", icon: "grades", section: "siga", phase: 2, roles: ALL, keywords: "notas planilla siee" },
  { key: "reportCards", label: "Boletines", href: "/siga/boletines", icon: "reportCards", section: "siga", phase: 2, roles: ALL, keywords: "certificados pdf qr" },
  { key: "observer", label: "Observador", href: "/siga/observador", icon: "observer", section: "siga", phase: 2, roles: ALL, keywords: "convivencia anotaciones descargos" },
  { key: "attendance", label: "Asistencia", href: "/siga/asistencia", icon: "attendance", section: "siga", phase: 2, roles: ALL, keywords: "llamado a lista excusas fallas" },
  { key: "agenda", label: "Agenda y circulares", href: "/siga/agenda", icon: "agenda", section: "siga", phase: 2, roles: ALL, keywords: "comunicados calendario eventos" },
  { key: "billing", label: "Cartera y pagos", href: "/siga/cartera", icon: "billing", section: "siga", phase: 4, roles: ["GUARDIAN", "ADMIN"], keywords: "pensiones recibos paz y salvo" },

  { key: "structure", label: "Estructura académica", href: "/admin/estructura", icon: "structure", section: "admin", phase: 2, roles: ["COORDINATOR", "ADMIN"], keywords: "años periodos grados grupos asignaturas" },
  { key: "users", label: "Usuarios y roles", href: "/admin/usuarios", icon: "users", section: "admin", phase: 2, roles: ["ADMIN"], keywords: "estudiantes docentes acudientes" },
  { key: "enrollment", label: "Matrículas 2027", href: "/admin/matriculas", icon: "enrollment", section: "admin", phase: 4, roles: ["COORDINATOR", "ADMIN"], keywords: "admisiones documentos" },
  { key: "migration", label: "Migración y SIMAT", href: "/admin/migracion", icon: "migration", section: "admin", phase: 5, roles: ["ADMIN"], keywords: "importar moodle siga exportar" },
];

/** Accesos de la barra inferior móvil (máx. 3 además de Inicio y Menú). */
const TAB_KEYS: Record<Role, readonly string[]> = {
  STUDENT: ["courses", "tasks", "grades"],
  GUARDIAN: ["grades", "attendance", "billing"],
  TEACHER: ["courses", "grades", "attendance"],
  COORDINATOR: ["grades", "observer", "structure"],
  ADMIN: ["users", "enrollment", "structure"],
};

export interface ResolvedNavItem extends NavItem {
  available: boolean;
}

export function getNavigation(role: Role): ResolvedNavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    available: RELEASED_MODULES.has(item.key),
  }));
}

export function getTabKeys(role: Role): readonly string[] {
  return TAB_KEYS[role];
}
