import { z } from "zod";
import { RESOURCE_TYPES } from "@/db/schema/aula";
import { SIEE_DIMENSIONS } from "@/db/schema/siga";
import { MAX_SCORE, MIN_SCORE } from "@/modules/siga/siee-grades/scale";

export const createUnitSchema = z.object({
  courseAssignmentId: z.uuid({ error: "Curso inválido." }),
  periodId: z.uuid({ error: "Periodo inválido." }),
  title: z
    .string({ error: "Escribe el nombre de la unidad." })
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(100, "Máximo 100 caracteres."),
  description: z.string().trim().max(400, "Máximo 400 caracteres.").optional().default(""),
});

export const createResourceSchema = z.object({
  courseAssignmentId: z.uuid(),
  unitId: z.uuid({ error: "Selecciona una unidad." }),
  type: z.enum(RESOURCE_TYPES, { error: "Tipo de recurso inválido." }),
  title: z
    .string({ error: "Escribe un título para el recurso." })
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  contentTextOrUrl: z.string().trim().max(4000, "Máximo 4.000 caracteres.").optional().default(""),
});

export const markResourceViewedSchema = z.object({
  courseAssignmentId: z.uuid(),
  resourceId: z.uuid(),
});

export const createActivitySchema = z.object({
  courseAssignmentId: z.uuid(),
  unitId: z.uuid({ error: "Selecciona una unidad." }),
  title: z
    .string({ error: "Escribe el título de la tarea." })
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  instructions: z
    .string({ error: "Escribe las instrucciones para los estudiantes." })
    .trim()
    .min(8, "Describe brevemente qué debe entregar el estudiante (mín. 8 caracteres).")
    .max(4000, "Máximo 4.000 caracteres."),
  dueDate: z.string().trim().optional().default(""),
  allowLate: z.boolean().default(true),
  syncToSiga: z.boolean().default(false),
  sieeDimension: z.enum(SIEE_DIMENSIONS).optional(),
  weightPercent: z.coerce.number().min(1).max(100).optional(),
});

export const submitAssignmentSchema = z.object({
  courseAssignmentId: z.uuid(),
  activityId: z.uuid(),
  textResponse: z.string().trim().max(6000, "Máximo 6.000 caracteres.").optional().default(""),
  referenceUrl: z.string().trim().max(500).optional().default(""),
});

export const gradeSubmissionSchema = z.object({
  courseAssignmentId: z.uuid(),
  activityId: z.uuid(),
  enrollmentId: z.uuid(),
  score: z.coerce
    .number({ error: "Ingresa una nota entre 1.0 y 5.0." })
    .min(MIN_SCORE, `La nota mínima es ${MIN_SCORE.toFixed(1)}.`)
    .max(MAX_SCORE, `La nota máxima es ${MAX_SCORE.toFixed(1)}.`)
    .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, {
      message: "Usa máximo un decimal (ej. 4.5).",
    }),
  teacherFeedback: z.string().trim().max(1500, "Máximo 1.500 caracteres.").optional().default(""),
});

export const createForumPostSchema = z.object({
  courseAssignmentId: z.uuid(),
  body: z
    .string({ error: "Escribe un mensaje para el curso." })
    .trim()
    .min(4, "Escribe al menos 4 caracteres.")
    .max(2000, "Máximo 2.000 caracteres."),
  isPinned: z.boolean().optional().default(false),
});
