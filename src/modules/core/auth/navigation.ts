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
  | "migration"
  | "badges"
  | "finalReport"
  | "courseReview";

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
  /** Nombre corto para pestañas y barra móvil. */
  short: string;
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
  "finalReport",
  "badges",
  "courseReview",
]);

const ALL: readonly Role[] = ["STUDENT", "GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"];

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", label: "Inicio", short: "Inicio", href: "/dashboard", icon: "home", section: "inicio", phase: 1, roles: ALL, keywords: "panel resumen" },

  { key: "courses", label: "Mis cursos", short: "Cursos", href: "/aula", icon: "courses", section: "aula", phase: 3, roles: ["STUDENT", "GUARDIAN", "TEACHER"], keywords: "asignaturas materias aula virtual" },
  { key: "tasks", label: "¿Qué tareas tengo?", short: "Tareas", href: "/aula/tareas", icon: "tasks", section: "aula", phase: 3, roles: ["STUDENT", "GUARDIAN"], keywords: "entregas pendientes" },
  { key: "courseReview", label: "Seguimiento de cursos", short: "Seguimiento", href: "/aula/seguimiento", icon: "courseReview", section: "aula", phase: 3, roles: ["COORDINATOR", "ADMIN"], keywords: "docentes cumplimiento contenido personalización cargue notas logros" },
  { key: "badges", label: "Insignias", short: "Insignias", href: "/aula/insignias", icon: "badges", section: "aula", phase: 3, roles: ["STUDENT", "GUARDIAN"], keywords: "logros medallas premios racha" },

  { key: "grades", label: "Calificaciones", short: "Notas", href: "/siga/calificaciones", icon: "grades", section: "siga", phase: 2, roles: ALL, keywords: "notas planilla siee" },
  { key: "reportCards", label: "Boletines", short: "Boletines", href: "/siga/boletines", icon: "reportCards", section: "siga", phase: 2, roles: ALL, keywords: "certificados qr periodo" },
  { key: "finalReport", label: "Boletín final del año", short: "Final del año", href: "/siga/boletines/final", icon: "finalReport", section: "siga", phase: 2, roles: ["STUDENT", "GUARDIAN", "COORDINATOR", "ADMIN"], keywords: "informe anual promoción aprobó reprobó definitiva" },
  { key: "observer", label: "Observador", short: "Observador", href: "/siga/observador", icon: "observer", section: "siga", phase: 2, roles: ALL, keywords: "convivencia anotaciones descargos" },
  { key: "attendance", label: "Asistencia", short: "Asistencia", href: "/siga/asistencia", icon: "attendance", section: "siga", phase: 2, roles: ALL, keywords: "llamado a lista excusas fallas" },
  { key: "agenda", label: "Agenda y circulares", short: "Circulares", href: "/siga/agenda", icon: "agenda", section: "siga", phase: 2, roles: ALL, keywords: "comunicados calendario eventos avisos" },
  { key: "billing", label: "Cartera y pagos", short: "Pagos", href: "/siga/cartera", icon: "billing", section: "siga", phase: 4, roles: ["GUARDIAN", "ADMIN"], keywords: "pensiones recibos paz y salvo" },

  { key: "structure", label: "Estructura académica", short: "Estructura", href: "/admin/estructura", icon: "structure", section: "admin", phase: 2, roles: ["COORDINATOR", "ADMIN"], keywords: "años periodos grados grupos asignaturas" },
  { key: "users", label: "Usuarios y roles", short: "Usuarios", href: "/admin/usuarios", icon: "users", section: "admin", phase: 2, roles: ["ADMIN"], keywords: "estudiantes docentes acudientes" },
  { key: "enrollment", label: "Matrículas 2027", short: "Matrículas", href: "/admin/matriculas", icon: "enrollment", section: "admin", phase: 4, roles: ["COORDINATOR", "ADMIN"], keywords: "admisiones documentos" },
  { key: "migration", label: "Migración y SIMAT", short: "Migración", href: "/admin/migracion", icon: "migration", section: "admin", phase: 5, roles: ["ADMIN"], keywords: "importar moodle siga exportar" },
];

/**
 * Navegación de 4 destinos por rol (docs/PROPUESTA_UX_NAVEGACION_Y_AULA.md).
 * Cada módulo vive en UN solo destino; dentro del destino se navega con
 * pestañas. Así nadie ve más de 4 opciones principales y nada se pierde.
 */
export interface NavDestinationDef {
  key: string;
  label: string;
  icon: NavIcon;
  items: readonly string[];
}

export const DESTINATIONS: Record<Role, readonly NavDestinationDef[]> = {
  STUDENT: [
    { key: "inicio", label: "Inicio", icon: "home", items: ["dashboard"] },
    { key: "clases", label: "Mis clases", icon: "courses", items: ["courses", "tasks"] },
    { key: "progreso", label: "Mi progreso", icon: "grades", items: ["grades", "reportCards", "finalReport", "badges"] },
    { key: "avisos", label: "Avisos", icon: "agenda", items: ["agenda", "attendance", "observer"] },
  ],
  GUARDIAN: [
    { key: "inicio", label: "Inicio", icon: "home", items: ["dashboard", "agenda"] },
    { key: "estudio", label: "Estudio", icon: "grades", items: ["grades", "reportCards", "finalReport", "tasks", "courses", "badges"] },
    { key: "convivencia", label: "Asistencia", icon: "attendance", items: ["attendance", "observer"] },
    { key: "pagos", label: "Pagos", icon: "billing", items: ["billing"] },
  ],
  TEACHER: [
    { key: "hoy", label: "Hoy", icon: "home", items: ["dashboard", "agenda"] },
    { key: "clases", label: "Mis clases", icon: "courses", items: ["courses", "grades", "reportCards"] },
    { key: "asistencia", label: "Asistencia", icon: "attendance", items: ["attendance"] },
    { key: "observador", label: "Observador", icon: "observer", items: ["observer"] },
  ],
  COORDINATOR: [
    { key: "resumen", label: "Resumen", icon: "home", items: ["dashboard", "agenda"] },
    { key: "academico", label: "Académico", icon: "grades", items: ["courseReview", "grades", "reportCards", "finalReport", "attendance", "observer"] },
    { key: "estructura", label: "Estructura", icon: "structure", items: ["structure"] },
    { key: "matriculas", label: "Matrículas", icon: "enrollment", items: ["enrollment"] },
  ],
  ADMIN: [
    { key: "resumen", label: "Resumen", icon: "home", items: ["dashboard", "agenda"] },
    { key: "academico", label: "Académico", icon: "grades", items: ["courseReview", "grades", "reportCards", "finalReport", "attendance", "observer"] },
    { key: "comunidad", label: "Comunidad", icon: "users", items: ["users", "enrollment", "billing"] },
    { key: "sistema", label: "Sistema", icon: "structure", items: ["structure", "migration"] },
  ],
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

export interface ResolvedDestination {
  key: string;
  label: string;
  icon: NavIcon;
  /** Primera subsección disponible: a donde lleva el destino. */
  href: string;
  items: ResolvedNavItem[];
}

/** Destinos del rol con solo los módulos publicados (los vacíos se omiten). */
export function getDestinations(role: Role, navigation: readonly ResolvedNavItem[]): ResolvedDestination[] {
  return DESTINATIONS[role].flatMap((dest) => {
    const items = dest.items
      .map((key) => navigation.find((item) => item.key === key && item.available))
      .filter((item): item is ResolvedNavItem => Boolean(item));
    const first = items[0];
    return first ? [{ key: dest.key, label: dest.label, icon: dest.icon, href: first.href, items }] : [];
  });
}

/** Coincidencia más específica de la ruta (p. ej. `/siga/boletines/final` gana a `/siga/boletines`). */
export function findActiveItem<T extends { href: string }>(items: readonly T[], pathname: string): T | null {
  let best: T | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

export function findActiveDestination(
  destinations: readonly ResolvedDestination[],
  pathname: string,
): ResolvedDestination | null {
  const active = findActiveItem(
    destinations.flatMap((d) => d.items),
    pathname,
  );
  return active ? (destinations.find((d) => d.items.includes(active)) ?? null) : null;
}

