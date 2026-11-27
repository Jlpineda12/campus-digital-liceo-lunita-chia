/**
 * Insignias del estudiante (archivo puro: servidor y pruebas).
 *
 * Se CALCULAN con lo que el estudiante ya hizo en el año (entregas, quices,
 * recursos, foros y asistencia): no hay tabla nueva ni nada que un docente
 * deba asignar a mano, y no se pueden "comprar". Reconocen hábitos, no notas
 * por encima de los compañeros: no hay ranking entre estudiantes.
 */

export interface BadgeStats {
  submissions: number;
  onTimeSubmissions: number;
  /** Trabajos calificados con nota de desempeño Superior. */
  superiorSubmissions: number;
  quizzesSubmitted: number;
  superiorQuizzes: number;
  resourcesViewed: number;
  forumPosts: number;
  attendanceRecorded: number;
  attendancePresent: number;
}

export type BadgeIcon = "rocket" | "clock" | "brain" | "compass" | "message" | "calendar" | "flame" | "star";

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  target: number;
  /** Avance actual en la misma unidad de `target`. */
  progress: (stats: BadgeStats) => number;
  unit: string;
  /** Texto de avance cuando la fórmula no es un simple conteo. */
  detail?: (stats: BadgeStats) => string;
}

const ATTENDANCE_MIN_DAYS = 20;

export const BADGES: readonly BadgeDefinition[] = [
  {
    key: "first-launch",
    name: "Primer despegue",
    description: "Entrega tu primera tarea en Órbita Virtual.",
    icon: "rocket",
    target: 1,
    unit: "entrega",
    progress: (s) => s.submissions,
  },
  {
    key: "on-time",
    name: "Puntual como la luna",
    description: "Entrega 10 tareas antes de la fecha límite.",
    icon: "clock",
    target: 10,
    unit: "a tiempo",
    progress: (s) => s.onTimeSubmissions,
  },
  {
    key: "quiz-mind",
    name: "Mente brillante",
    description: "Obtén desempeño Superior en 3 cuestionarios.",
    icon: "brain",
    target: 3,
    unit: "cuestionarios",
    progress: (s) => s.superiorQuizzes,
  },
  {
    key: "explorer",
    name: "Explorador(a)",
    description: "Abre 15 recursos de tus cursos (lecturas, videos, enlaces).",
    icon: "compass",
    target: 15,
    unit: "recursos",
    progress: (s) => s.resourcesViewed,
  },
  {
    key: "voice",
    name: "Voz de la órbita",
    description: "Participa 5 veces en los foros de tus cursos.",
    icon: "message",
    target: 5,
    unit: "aportes",
    progress: (s) => s.forumPosts,
  },
  {
    key: "attendance",
    name: "Asistencia de oro",
    description: `Asiste al 95% de las clases (con al menos ${ATTENDANCE_MIN_DAYS} registros).`,
    icon: "calendar",
    target: 95,
    unit: "%",
    detail: (s) =>
      s.attendanceRecorded < ATTENDANCE_MIN_DAYS
        ? `${s.attendanceRecorded} de ${ATTENDANCE_MIN_DAYS} registros para empezar a contar`
        : `${Math.round((s.attendancePresent / s.attendanceRecorded) * 100)}% de asistencia · meta 95%`,
    progress: (s) =>
      s.attendanceRecorded < ATTENDANCE_MIN_DAYS
        ? Math.min(94, Math.round((s.attendanceRecorded / ATTENDANCE_MIN_DAYS) * 94))
        : Math.round((s.attendancePresent / s.attendanceRecorded) * 100),
  },
  {
    key: "steady",
    name: "Constancia",
    description: "Completa 25 entregas en el año.",
    icon: "flame",
    target: 25,
    unit: "entregas",
    progress: (s) => s.submissions,
  },
  {
    key: "excellence",
    name: "Excelencia",
    description: "Logra desempeño Superior en 5 trabajos calificados.",
    icon: "star",
    target: 5,
    unit: "trabajos",
    progress: (s) => s.superiorSubmissions,
  },
];

export interface EvaluatedBadge {
  key: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  earned: boolean;
  /** Avance acotado a la meta, para la barra. */
  current: number;
  target: number;
  unit: string;
  percent: number;
  /** Avance legible, p. ej. «3 / 10 a tiempo». */
  detail: string;
}

export function evaluateBadges(stats: BadgeStats): EvaluatedBadge[] {
  return BADGES.map((b) => {
    const raw = Math.max(0, b.progress(stats));
    const earned = raw >= b.target;
    const current = Math.min(raw, b.target);
    return {
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earned,
      current,
      target: b.target,
      unit: b.unit,
      percent: Math.round((current / b.target) * 100),
      detail: b.detail ? b.detail(stats) : `${current} / ${b.target} ${b.unit}`,
    };
  });
}

/** La siguiente insignia más cercana (para motivar sin abrumar). */
export function nextBadge(badges: readonly EvaluatedBadge[]): EvaluatedBadge | null {
  return [...badges].filter((b) => !b.earned).sort((a, b) => b.percent - a.percent)[0] ?? null;
}
