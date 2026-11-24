import { z } from "zod";
import { LOGIN_MODULES } from "./redirects";
import { ROLES } from "./roles";

/** Lee un campo de texto de un FormData; vacío o ausente → `undefined`. */
export function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

const optionalNext = z.string().max(300).optional();
const optionalModule = z.enum(LOGIN_MODULES).optional().catch(undefined);

export const loginSchema = z.object({
  identifier: z
    .string({ error: "Escribe tu número de documento o correo." })
    .trim()
    .min(3, "Escribe tu número de documento o correo.")
    .max(120, "El dato ingresado es demasiado largo."),
  password: z
    .string({ error: "Escribe tu contraseña." })
    .min(1, "Escribe tu contraseña.")
    .max(200, "La contraseña es demasiado larga."),
  next: optionalNext,
  modulo: optionalModule,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const demoLoginSchema = z.object({
  role: z.enum(ROLES),
  next: optionalNext,
  modulo: optionalModule,
});

export const selectChildSchema = z.object({
  studentId: z.uuid(),
});

export const requestResetSchema = z.object({
  identifier: z
    .string({ error: "Escribe tu número de documento o correo." })
    .trim()
    .min(3, "Escribe tu número de documento o correo.")
    .max(120, "El dato ingresado es demasiado largo."),
});

export const completeResetSchema = z
  .object({
    token: z.string().length(43),
    password: z.string({ error: "Escribe la nueva contraseña." }).min(1, "Escribe la nueva contraseña.").max(200),
    confirm: z.string({ error: "Confirma la nueva contraseña." }).min(1, "Confirma la nueva contraseña."),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

/**
 * Normaliza el identificador de acceso: correos en minúsculas; documentos sin
 * puntos, espacios ni guiones (p. ej. "1.070.000.001" → "1070000001").
 */
export function normalizeIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes("@")) return value.toLowerCase();
  return value.replace(/[\s.\-]/g, "").toUpperCase();
}
