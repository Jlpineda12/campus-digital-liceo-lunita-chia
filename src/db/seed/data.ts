import type {
  AssessmentMode,
  DocumentType,
  LevelCode,
} from "../../modules/core/academic-structure/constants";
import type { StheamiPillar } from "../../modules/core/academic-structure/stheami";

/**
 * Catálogo semilla del Liceo Lunita de Chía.
 *
 * ⚠ Estructura (niveles, grados, códigos SIMAT) según normativa colombiana.
 * El plan de estudios, la asignación de pilares STHEAMI y las fechas de periodos
 * son una PROPUESTA editable que Coordinación Académica debe validar antes de
 * producción. Todas las personas son ficticias.
 */

export const LEVELS: ReadonlyArray<{ code: LevelCode; name: string }> = [
  { code: "PREESCOLAR", name: "Preescolar" },
  { code: "PRIMARIA", name: "Primaria" },
  { code: "BACHILLERATO", name: "Bachillerato" },
];

export interface GradeSeed {
  name: string;
  level: LevelCode;
  /** Número de grado SIMAT: -2 Prejardín, -1 Jardín, 0 Transición, 1…11. */
  number: number;
  groupName: string;
  assessmentMode: AssessmentMode;
}

export const GRADES: ReadonlyArray<GradeSeed> = [
  { name: "Prejardín", level: "PREESCOLAR", number: -2, groupName: "Prejardín A", assessmentMode: "QUALITATIVE" },
  { name: "Jardín", level: "PREESCOLAR", number: -1, groupName: "Jardín A", assessmentMode: "QUALITATIVE" },
  { name: "Transición", level: "PREESCOLAR", number: 0, groupName: "Transición A", assessmentMode: "QUALITATIVE" },
  { name: "Primero", level: "PRIMARIA", number: 1, groupName: "1A", assessmentMode: "NUMERIC" },
  { name: "Segundo", level: "PRIMARIA", number: 2, groupName: "2A", assessmentMode: "NUMERIC" },
  { name: "Tercero", level: "PRIMARIA", number: 3, groupName: "3A", assessmentMode: "NUMERIC" },
  { name: "Cuarto", level: "PRIMARIA", number: 4, groupName: "4A", assessmentMode: "NUMERIC" },
  { name: "Quinto", level: "PRIMARIA", number: 5, groupName: "5A", assessmentMode: "NUMERIC" },
  { name: "Sexto", level: "BACHILLERATO", number: 6, groupName: "6A", assessmentMode: "NUMERIC" },
  { name: "Séptimo", level: "BACHILLERATO", number: 7, groupName: "7A", assessmentMode: "NUMERIC" },
  { name: "Octavo", level: "BACHILLERATO", number: 8, groupName: "8A", assessmentMode: "NUMERIC" },
  { name: "Noveno", level: "BACHILLERATO", number: 9, groupName: "9A", assessmentMode: "NUMERIC" },
  { name: "Décimo", level: "BACHILLERATO", number: 10, groupName: "10A", assessmentMode: "NUMERIC" },
  { name: "Undécimo", level: "BACHILLERATO", number: 11, groupName: "11A", assessmentMode: "NUMERIC" },
];

export const SPECIALTIES = [
  "MATEMATICAS",
  "CIENCIAS",
  "LENGUAJE",
  "INGLES",
  "SOCIALES",
  "TECNOLOGIA",
  "INGENIERIA",
  "ARTES",
  "EDFISICA",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export interface SubjectSeed {
  code: string;
  name: string;
  pillar: StheamiPillar;
  weeklyHours: number;
  /** Rango de grados (número SIMAT) donde se dicta. */
  fromGrade: number;
  toGrade: number;
  /** Docente especialista (bachillerato, o todos los grados si no la dicta el titular). */
  specialty: Specialty | null;
  /** En preescolar y primaria la dicta el docente titular del grupo. */
  titularUpToGrade?: number;
}

export const SUBJECTS: ReadonlyArray<SubjectSeed> = [
  // Preescolar: dimensiones del desarrollo (valoración cualitativa)
  { code: "PCOG", name: "Dimensión Cognitiva", pillar: "M", weeklyHours: 5, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  { code: "PCOM", name: "Dimensión Comunicativa", pillar: "H", weeklyHours: 5, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  { code: "PEXP", name: "Exploración del Medio", pillar: "S", weeklyHours: 3, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  { code: "PEST", name: "Dimensión Estética", pillar: "A", weeklyHours: 3, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  { code: "PCOR", name: "Dimensión Corporal", pillar: "I", weeklyHours: 2, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  { code: "PSOC", name: "Dimensión Socioafectiva", pillar: "I", weeklyHours: 2, fromGrade: -2, toGrade: 0, specialty: null, titularUpToGrade: 0 },
  // Áreas obligatorias (Ley 115, art. 23) y proyectos STHEAMI
  { code: "MATE", name: "Matemáticas", pillar: "M", weeklyHours: 5, fromGrade: 1, toGrade: 11, specialty: "MATEMATICAS", titularUpToGrade: 5 },
  { code: "CNAT", name: "Ciencias Naturales y Educación Ambiental", pillar: "S", weeklyHours: 4, fromGrade: 1, toGrade: 9, specialty: "CIENCIAS", titularUpToGrade: 5 },
  { code: "FISI", name: "Física", pillar: "S", weeklyHours: 3, fromGrade: 10, toGrade: 11, specialty: "CIENCIAS" },
  { code: "QUIM", name: "Química", pillar: "S", weeklyHours: 3, fromGrade: 10, toGrade: 11, specialty: "CIENCIAS" },
  { code: "LENG", name: "Lengua Castellana", pillar: "H", weeklyHours: 5, fromGrade: 1, toGrade: 11, specialty: "LENGUAJE", titularUpToGrade: 5 },
  { code: "INGL", name: "Inglés", pillar: "H", weeklyHours: 3, fromGrade: -2, toGrade: 11, specialty: "INGLES" },
  { code: "SOCI", name: "Ciencias Sociales", pillar: "H", weeklyHours: 3, fromGrade: 1, toGrade: 11, specialty: "SOCIALES", titularUpToGrade: 5 },
  { code: "FILO", name: "Filosofía", pillar: "H", weeklyHours: 2, fromGrade: 10, toGrade: 11, specialty: "SOCIALES" },
  { code: "RELI", name: "Educación Religiosa", pillar: "H", weeklyHours: 1, fromGrade: 1, toGrade: 11, specialty: "SOCIALES", titularUpToGrade: 5 },
  { code: "TECN", name: "Tecnología e Informática", pillar: "T", weeklyHours: 2, fromGrade: 1, toGrade: 11, specialty: "TECNOLOGIA" },
  { code: "INGE", name: "Ingeniería y Proyectos STHEAMI", pillar: "E", weeklyHours: 2, fromGrade: 1, toGrade: 11, specialty: "INGENIERIA" },
  { code: "ARTE", name: "Educación Artística y Música", pillar: "A", weeklyHours: 2, fromGrade: 1, toGrade: 11, specialty: "ARTES" },
  { code: "EDFI", name: "Educación Física, Recreación y Deportes", pillar: "I", weeklyHours: 2, fromGrade: 1, toGrade: 11, specialty: "EDFISICA" },
  { code: "ETIC", name: "Ética y Valores Humanos", pillar: "I", weeklyHours: 1, fromGrade: 1, toGrade: 11, specialty: "EDFISICA", titularUpToGrade: 5 },
];

export interface PersonSeed {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const COORDINATOR: PersonSeed = {
  documentType: "CC",
  documentNumber: "80000001",
  firstName: "Patricia",
  lastName: "Rojas Villamil",
  email: "patricia.rojas@campus.lunita.test",
};

export const ADMIN: PersonSeed = {
  documentType: "CC",
  documentNumber: "51000001",
  firstName: "Carmen",
  lastName: "Beltrán Silva",
  email: "carmen.beltran@campus.lunita.test",
};

export const SPECIALISTS: Record<Specialty, PersonSeed> = {
  MATEMATICAS: { documentType: "CC", documentNumber: "79000001", firstName: "Andrés Felipe", lastName: "Moreno Díaz", email: "andres.moreno@campus.lunita.test" },
  CIENCIAS: { documentType: "CC", documentNumber: "79000002", firstName: "Diana Marcela", lastName: "Suárez Peña", email: "diana.suarez@campus.lunita.test" },
  LENGUAJE: { documentType: "CC", documentNumber: "79000003", firstName: "Juan Camilo", lastName: "Herrera Ríos", email: "juan.herrera@campus.lunita.test" },
  INGLES: { documentType: "CC", documentNumber: "79000004", firstName: "Catalina", lastName: "Vargas Ortiz", email: "catalina.vargas@campus.lunita.test" },
  SOCIALES: { documentType: "CC", documentNumber: "79000005", firstName: "Hernán Darío", lastName: "Quintero León", email: "hernan.quintero@campus.lunita.test" },
  TECNOLOGIA: { documentType: "CC", documentNumber: "79000006", firstName: "Valentina", lastName: "Ospina Mejía", email: "valentina.ospina@campus.lunita.test" },
  INGENIERIA: { documentType: "CC", documentNumber: "79000007", firstName: "Sebastián", lastName: "Cárdenas Torres", email: "sebastian.cardenas@campus.lunita.test" },
  ARTES: { documentType: "CC", documentNumber: "79000008", firstName: "Mauricio", lastName: "Gómez Salazar", email: "mauricio.gomez@campus.lunita.test" },
  EDFISICA: { documentType: "CC", documentNumber: "79000009", firstName: "Natalia", lastName: "Rincón Acosta", email: "natalia.rincon@campus.lunita.test" },
};

/** Docentes titulares de preescolar y primaria (uno por grupo). */
export const TITULARS: Record<string, PersonSeed> = {
  "Prejardín A": { documentType: "CC", documentNumber: "79000101", firstName: "Luz Ángela", lastName: "Martínez Rozo", email: "luz.martinez@campus.lunita.test" },
  "Jardín A": { documentType: "CC", documentNumber: "79000102", firstName: "Paola Andrea", lastName: "Castillo Ruiz", email: "paola.castillo@campus.lunita.test" },
  "Transición A": { documentType: "CC", documentNumber: "79000103", firstName: "Marisol", lastName: "Peña Rojas", email: "marisol.pena@campus.lunita.test" },
  "1A": { documentType: "CC", documentNumber: "79000104", firstName: "Claudia Patricia", lastName: "Niño Forero", email: "claudia.nino@campus.lunita.test" },
  "2A": { documentType: "CC", documentNumber: "79000105", firstName: "Gloria Inés", lastName: "Bermúdez Cruz", email: "gloria.bermudez@campus.lunita.test" },
  "3A": { documentType: "CC", documentNumber: "79000106", firstName: "Sandra Milena", lastName: "Torres Prieto", email: "sandra.torres@campus.lunita.test" },
  "4A": { documentType: "CC", documentNumber: "79000107", firstName: "Jorge Enrique", lastName: "Lozano Pardo", email: "jorge.lozano@campus.lunita.test" },
  "5A": { documentType: "CC", documentNumber: "79000108", firstName: "Adriana Lucía", lastName: "Cárdenas Vega", email: "adriana.cardenas@campus.lunita.test" },
};

/** Directores de grupo de bachillerato (especialistas). */
export const BACHILLERATO_DIRECTORS: Record<string, Specialty> = {
  "6A": "LENGUAJE",
  "7A": "MATEMATICAS",
  "8A": "CIENCIAS",
  "9A": "SOCIALES",
  "10A": "TECNOLOGIA",
  "11A": "INGLES",
};

/** Familia de demostración: acudiente con dos hijos en grupos distintos. */
export const DEMO_FAMILY = {
  guardian: {
    documentType: "CC",
    documentNumber: "52000001",
    firstName: "Laura",
    lastName: "Castro Gómez",
    email: "laura.castro@campus.lunita.test",
  } satisfies PersonSeed,
  children: [
    {
      groupName: "7A",
      person: {
        documentType: "TI",
        documentNumber: "1070000001",
        firstName: "Sofía",
        lastName: "Ramírez Castro",
        email: "sofia.ramirez@campus.lunita.test",
      } satisfies PersonSeed,
    },
    {
      groupName: "3A",
      person: {
        documentType: "TI",
        documentNumber: "1070000002",
        firstName: "Tomás",
        lastName: "Ramírez Castro",
        email: "tomas.ramirez@campus.lunita.test",
      } satisfies PersonSeed,
    },
  ],
} as const;

export const STUDENTS_PER_GROUP = 4;

export const FIRST_NAMES = [
  "Mariana", "Santiago", "Valeria", "Samuel", "Isabella", "Matías", "Gabriela", "Emiliano",
  "Luciana", "Nicolás", "Antonella", "Martín", "Salomé", "Jerónimo", "Daniela", "Simón",
  "Juliana", "Alejandro", "Manuela", "Felipe", "Sara", "David", "Camila", "Joaquín",
];

export const LAST_NAMES = [
  "Gómez", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez", "Sánchez",
  "Ramírez", "Torres", "Flórez", "Rivera", "Moreno", "Jiménez", "Rojas", "Vargas",
  "Muñoz", "Castro", "Ortiz", "Suárez", "Mendoza", "Cifuentes", "Bohórquez", "Garzón",
];

export interface YearSeed {
  year: number;
  name: string;
  isCurrent: boolean;
  enrollmentOpen: boolean;
  startDate: string;
  endDate: string;
  periods: ReadonlyArray<{ number: number; name: string; startDate: string; endDate: string; locked: boolean }>;
}

/** Fechas de referencia (calendario A). Ajustar al cronograma institucional. */
export const ACADEMIC_YEARS: ReadonlyArray<YearSeed> = [
  {
    year: 2026,
    name: "Año Lectivo 2026",
    isCurrent: true,
    enrollmentOpen: false,
    startDate: "2026-01-26",
    endDate: "2026-11-27",
    periods: [
      { number: 1, name: "Primer Periodo", startDate: "2026-01-26", endDate: "2026-04-03", locked: true },
      { number: 2, name: "Segundo Periodo", startDate: "2026-04-13", endDate: "2026-06-19", locked: true },
      { number: 3, name: "Tercer Periodo", startDate: "2026-07-06", endDate: "2026-09-11", locked: true },
      { number: 4, name: "Cuarto Periodo", startDate: "2026-09-14", endDate: "2026-11-27", locked: false },
    ],
  },
  {
    year: 2027,
    name: "Año Lectivo 2027",
    isCurrent: false,
    enrollmentOpen: true,
    startDate: "2027-01-25",
    endDate: "2027-11-26",
    periods: [
      { number: 1, name: "Primer Periodo", startDate: "2027-01-25", endDate: "2027-04-02", locked: false },
      { number: 2, name: "Segundo Periodo", startDate: "2027-04-12", endDate: "2027-06-18", locked: false },
      { number: 3, name: "Tercer Periodo", startDate: "2027-07-06", endDate: "2027-09-10", locked: false },
      { number: 4, name: "Cuarto Periodo", startDate: "2027-09-13", endDate: "2027-11-26", locked: false },
    ],
  },
];
