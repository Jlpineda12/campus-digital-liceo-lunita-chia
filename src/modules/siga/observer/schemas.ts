import { z } from "zod";
import { OBSERVER_CATEGORIES } from "./meta";

/** Validaciones Zod para el módulo Observador (servidor y pruebas unitarias). */

export const createObserverSchema = z.object({
  enrollmentIds: z
    .array(z.uuid({ error: "Identificador de matrícula inválido." }))
    .min(1, "Selecciona al menos un estudiante.")
    .max(40, "Puedes registrar máximo 40 estudiantes por anotación grupal."),
  periodId: z.uuid().optional(),
  category: z.enum(OBSERVER_CATEGORIES, { error: "Elige una categoría válida." }),
  title: z
    .string({ error: "Escribe un título breve." })
    .trim()
    .min(3, "Escribe un título de al menos 3 caracteres.")
    .max(120, "El título puede tener máximo 120 caracteres."),
  description: z
    .string({ error: "Describe los hechos de forma objetiva." })
    .trim()
    .min(10, "Describe la situación o reconocimiento (mínimo 10 caracteres).")
    .max(1500, "La descripción puede tener máximo 1500 caracteres."),
  commitment: z
    .string()
    .trim()
    .max(600, "El compromiso puede tener máximo 600 caracteres.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const studentStatementSchema = z.object({
  recordId: z.uuid({ error: "Anotación inválida." }),
  statement: z
    .string({ error: "Escribe tu versión o descargos." })
    .trim()
    .min(5, "Escribe al menos 5 caracteres en tus descargos.")
    .max(1000, "Usa máximo 1000 caracteres."),
  commitment: z
    .string()
    .trim()
    .max(600, "El compromiso puede tener máximo 600 caracteres.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const guardianAcknowledgeSchema = z.object({
  recordId: z.uuid({ error: "Anotación inválida." }),
  comment: z
    .string()
    .trim()
    .max(600, "El comentario puede tener máximo 600 caracteres.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
