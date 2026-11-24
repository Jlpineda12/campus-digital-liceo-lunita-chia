import type { Tone } from "@/modules/core/auth/roles";

/**
 * Modelo pedagógico STHEAMI (REGLAS.md §2.2, SISTEMA_DISENO.md §2.B).
 * Archivo puro: se puede importar desde servidor y cliente.
 */
export const STHEAMI_PILLARS = ["S", "T", "H", "E", "A", "M", "I"] as const;
export type StheamiPillar = (typeof STHEAMI_PILLARS)[number];

export interface PillarMeta {
  letter: StheamiPillar;
  name: string;
  english: string;
  tone: Tone;
  /** Descripción institucional tomada del sitio web en Astro. */
  description: string;
}

export const PILLAR_META: Record<StheamiPillar, PillarMeta> = {
  S: {
    letter: "S",
    name: "Ciencia",
    english: "Science",
    tone: "sky",
    description: "Preguntar, observar y experimentar: del laboratorio al NASA Space Apps Challenge.",
  },
  T: {
    letter: "T",
    name: "Tecnología",
    english: "Technology",
    tone: "purple",
    description: "Robótica, programación y digitalización para crear, no solo consumir.",
  },
  H: {
    letter: "H",
    name: "Humanidades",
    english: "Humanities",
    tone: "orange",
    description: "Lectura, palabra e identidad muisca para pensar críticamente el territorio.",
  },
  E: {
    letter: "E",
    name: "Ingeniería",
    english: "Engineering",
    tone: "green",
    description: "Proyectos que resuelven problemas reales con diseño y prototipos.",
  },
  A: {
    letter: "A",
    name: "Artes",
    english: "Arts",
    tone: "pink",
    description: "Banda marcial, música y expresión: el arte como reflejo de un pueblo.",
  },
  M: {
    letter: "M",
    name: "Matemáticas",
    english: "Mathematics",
    tone: "yellow",
    description: "Pensamiento lógico con resultados destacados en pruebas nacionales.",
  },
  I: {
    letter: "I",
    name: "Inclusión",
    english: "Inclusion",
    tone: "red",
    description: "Una escuela para todos, con enfoque humano, cultural e inclusivo.",
  },
};

export function isStheamiPillar(value: unknown): value is StheamiPillar {
  return typeof value === "string" && (STHEAMI_PILLARS as readonly string[]).includes(value);
}
