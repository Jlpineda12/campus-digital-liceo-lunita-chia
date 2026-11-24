import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import type { SieeDimension } from "./calculator";

/**
 * Utilidades puras y banco de plantillas STHEAMI para los logros por asignatura
 * y periodo que redactan los docentes y se imprimen en el Boletín Oficial.
 */

export const MAX_LOGRO_LENGTH = 600;

/**
 * Divide un bloque de logros en líneas limpias (admite uno o varios logros
 * separados por salto de línea, retirando viñetas redundantes al inicio).
 */
export function parseLogroLines(description: string | null | undefined): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-–—•*]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0);
}

/** Cuenta cuántas dimensiones del curso ya tienen al menos un logro redactado. */
export function countFilledLogros(dimensions: ReadonlyArray<{ description?: string | null }>): {
  filled: number;
  total: number;
} {
  const total = dimensions.length;
  const filled = dimensions.filter((d) => parseLogroLines(d.description).length > 0).length;
  return { filled, total };
}

/**
 * Sugerencias pedagógicas base por pilar STHEAMI y dimensión SIEE para acelerar
 * el diligenciamiento docente sin partir de una pantalla en blanco.
 */
const TEMPLATES_BY_PILLAR: Record<StheamiPillar, Record<SieeDimension, string>> = {
  S: {
    SABER:
      "Comprende y explica los fenómenos científicos estudiados en el periodo, relacionando conceptos con su entorno cotidiano.",
    HACER:
      "Formula hipótesis, ejecuta prácticas de observación o laboratorio y registra resultados con orden y rigor.",
    SER: "Demuestra curiosidad científica, cuidado del entorno y respeto por el trabajo colaborativo en el aula.",
    QUALITATIVE:
      "Explora con curiosidad su entorno natural, formula preguntas y comparte sus descubrimientos con sus compañeros.",
  },
  T: {
    SABER:
      "Identifica el funcionamiento de herramientas digitales, algoritmos básicos y normas de ciudadanía digital segura.",
    HACER:
      "Diseña, programa o construye soluciones tecnológicas aplicando pensamiento lógico y creatividad en proyectos de clase.",
    SER: "Usa la tecnología con responsabilidad, cuida los equipos asignados y apoya a sus compañeros durante las prácticas.",
    QUALITATIVE:
      "Participa con entusiasmo en actividades de exploración tecnológica y sigue instrucciones paso a paso con autonomía.",
  },
  H: {
    SABER:
      "Interpreta textos e ideas centrales del periodo, reconociendo contextos culturales, históricos y comunicativos.",
    HACER:
      "Produce textos orales y escritos con claridad, coherencia y argumentación pertinente a su nivel escolar.",
    SER: "Escucha con respeto las opiniones ajenas, valora la identidad cultural y participa activamente en clase.",
    QUALITATIVE:
      "Expresa sus ideas y emociones con claridad, disfruta la lectura compartida y escucha con atención a los demás.",
  },
  E: {
    SABER:
      "Reconoce principios de diseño, estructura y resolución de problemas aplicados a retos escolares del periodo.",
    HACER:
      "Planifica, prototipa y mejora soluciones prácticas a partir de pruebas, mediciones y trabajo por proyectos.",
    SER: "Persevera ante los desafíos, cumple sus roles en equipo y cuida los materiales de construcción y diseño.",
    QUALITATIVE:
      "Construye modelos sencillos con creatividad, prueba nuevas ideas y coopera con alegría en los retos grupales.",
  },
  A: {
    SABER:
      "Reconoce elementos expresivos, estéticos y culturales propios de las manifestaciones artísticas trabajadas.",
    HACER:
      "Crea e interpreta producciones artísticas con técnica, ritmo, sensibilidad y originalidad en cada actividad.",
    SER: "Valora el esfuerzo creativo propio y el de sus compañeros, demostrando disciplina y disfrute estético.",
    QUALITATIVE:
      "Expresa su imaginación a través del arte, la música y el movimiento, disfrutando el trabajo creativo en grupo.",
  },
  M: {
    SABER:
      "Comprende los conceptos, propiedades y procedimientos matemáticos abordados durante el periodo académico.",
    HACER:
      "Resuelve situaciones problema mediante estrategias lógicas, cálculos precisos y representaciones claras.",
    SER: "Mantiene hábitos de estudio constantes, verifica sus procesos y participa con actitud positiva en clase.",
    QUALITATIVE:
      "Clasifica, cuenta y relaciona objetos y patrones de su entorno con seguridad y entusiasmo en el juego.",
  },
  I: {
    SABER:
      "Reconoce valores ciudadanos, derechos, deberes y principios de sana convivencia dentro de la comunidad escolar.",
    HACER:
      "Aplica estrategias de diálogo, mediación y autocuidado en actividades cotidianas, deportivas o de grupo.",
    SER: "Promueve el respeto, la empatía y la inclusión, fortaleciendo vínculos positivos con compañeros y docentes.",
    QUALITATIVE:
      "Comparte con empatía, respeta turnos y acuerdos del aula, fortaleciendo su autonomía y confianza personal.",
  },
};

export function getSuggestedLogro(pillar: StheamiPillar, dimension: SieeDimension): string {
  return TEMPLATES_BY_PILLAR[pillar][dimension];
}
