import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  daysBetweenIso,
  EXCUSE_REASON_TYPES,
  isIsoDateString,
} from "./meta";

const isoDateField = z
  .string({ error: "Elige una fecha válida." })
  .refine(isIsoDateString, { message: "La fecha debe tener formato AAAA-MM-DD." });

export const saveAttendanceRollSchema = z.object({
  courseAssignmentId: z.uuid({ error: "Curso inválido." }),
  date: isoDateField,
  entries: z
    .array(
      z.object({
        enrollmentId: z.uuid(),
        status: z.enum(ATTENDANCE_STATUSES),
        notes: z
          .string()
          .trim()
          .max(200, "La nota puede tener máximo 200 caracteres.")
          .optional()
          .transform((v) => (v && v.length > 0 ? v : null)),
      }),
    )
    .min(1, "No hay estudiantes para guardar.")
    .max(60, "Máximo 60 estudiantes por lista."),
});

export type SaveAttendanceRollInput = z.input<typeof saveAttendanceRollSchema>;

export const submitExcuseSchema = z
  .object({
    enrollmentId: z.uuid({ error: "Estudiante inválido." }),
    fromDate: isoDateField,
    toDate: isoDateField,
    reasonType: z.enum(EXCUSE_REASON_TYPES, { error: "Selecciona el motivo de la excusa." }),
    description: z
      .string({ error: "Explica brevemente el motivo de la inasistencia." })
      .trim()
      .min(10, "Describe el motivo en al menos 10 caracteres.")
      .max(800, "Usa máximo 800 caracteres."),
  })
  .refine((d) => d.toDate >= d.fromDate, {
    message: "La fecha final no puede ser anterior a la fecha inicial.",
    path: ["toDate"],
  })
  .refine((d) => daysBetweenIso(d.fromDate, d.toDate) <= 30, {
    message: "Una excusa puede cubrir máximo 30 días continuos.",
    path: ["toDate"],
  });

export const reviewExcuseSchema = z
  .object({
    excuseId: z.uuid({ error: "Excusa inválida." }),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reviewNotes: z
      .string()
      .trim()
      .max(400, "Máximo 400 caracteres.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .refine((d) => d.decision === "APPROVED" || (d.reviewNotes && d.reviewNotes.length >= 5), {
    message: "Indica el motivo del rechazo (mínimo 5 caracteres).",
    path: ["reviewNotes"],
  });
