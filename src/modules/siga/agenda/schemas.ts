import { z } from "zod";
import { CIRCULAR_SCOPES } from "@/db/schema/siga";

export const createCircularSchema = z
  .object({
    title: z
      .string({ error: "Escribe el asunto de la circular." })
      .trim()
      .min(4, "El asunto debe tener al menos 4 caracteres.")
      .max(140, "El asunto puede tener máximo 140 caracteres."),
    body: z
      .string({ error: "Escribe el mensaje de la circular." })
      .trim()
      .min(12, "Escribe un mensaje de al menos 12 caracteres.")
      .max(4000, "El mensaje puede tener máximo 4.000 caracteres."),
    targetScope: z.enum(CIRCULAR_SCOPES, { error: "Elige el alcance del comunicado." }),
    targetLevelId: z.uuid().optional().or(z.literal("")),
    targetGradeId: z.uuid().optional().or(z.literal("")),
    targetGroupId: z.uuid().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.targetScope === "LEVEL" && !data.targetLevelId) {
      ctx.addIssue({ code: "custom", path: ["targetLevelId"], message: "Selecciona el nivel destinatario." });
    }
    if (data.targetScope === "GRADE" && !data.targetGradeId) {
      ctx.addIssue({ code: "custom", path: ["targetGradeId"], message: "Selecciona el grado destinatario." });
    }
    if (data.targetScope === "GROUP" && !data.targetGroupId) {
      ctx.addIssue({ code: "custom", path: ["targetGroupId"], message: "Selecciona el grupo destinatario." });
    }
  });

export const circularIdSchema = z.object({
  circularId: z.uuid({ error: "Circular inválida." }),
});
