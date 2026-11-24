import type { Tone } from "@/modules/core/auth/roles";

/**
 * Identidad configurable de las plataformas del ecosistema Lunita.
 * Cambiar un nombre, lema o descripción aquí actualiza automáticamente el
 * Login, la barra lateral, el buscador Ctrl+K y los accesos del Dashboard.
 */
export const CAMPUS_BRAND = {
  name: "Campus Lunita",
  institution: "Liceo Lunita de Chía",
  tagline: "Ecosistema digital unificado para estudiantes, familias, docentes y directivos.",
  capacityTarget: 1000,
} as const;

export type PlatformSpaceKey = "siga" | "aula" | "admin";

export interface PlatformSpaceMeta {
  key: PlatformSpaceKey;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  tone: Tone;
  href: string;
}

export const PLATFORM_SPACES: Record<PlatformSpaceKey, PlatformSpaceMeta> = {
  siga: {
    key: "siga",
    name: "SIGA Lunita",
    shortName: "SIGA",
    tagline: "Gestión académica, notas SIEE, observador y asistencia",
    description:
      "Consulta y registra calificaciones SIEE, asistencia, excusas, observador con debido proceso y boletines oficiales.",
    tone: "sky",
    href: "/siga/calificaciones",
  },
  aula: {
    key: "aula",
    name: "Órbita Virtual",
    shortName: "Órbita",
    tagline: "Cursos, contenido, tareas y evaluaciones interactivas",
    description:
      "Tu aula virtual renovada: guías, entregas de tareas y cuestionarios por materia sincronizados con el SIGA.",
    tone: "purple",
    href: "/aula",
  },
  admin: {
    key: "admin",
    name: "Gestión Institucional",
    shortName: "Dirección",
    tagline: "Periodos, estructura académica, convivencia y comunidad",
    description:
      "Control de cierres de periodo, cargas docentes, revisión de excusas, convivencia y administración escolar.",
    tone: "yellow",
    href: "/admin/estructura",
  },
};
