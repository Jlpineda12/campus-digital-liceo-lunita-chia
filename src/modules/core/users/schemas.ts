import { z } from "zod";
import { DOCUMENT_TYPES, GUARDIAN_RELATIONSHIPS } from "@/modules/core/academic-structure/constants";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/modules/core/auth/password-policy";
import { ROLES, type Role } from "@/modules/core/auth/roles";

export const USERS_PAGE_SIZE = 25;

/** Normaliza documentos quitando espacios, puntos y guiones. */
export function normalizeDocumentNumber(raw: string): string {
  return raw.trim().replace(/[\s.-]+/g, "").toUpperCase();
}

const documentNumberField = z
  .string({ error: "Escribe el número de documento." })
  .transform(normalizeDocumentNumber)
  .refine((v) => /^[A-Z0-9]{4,20}$/.test(v), {
    message: "El documento debe tener entre 4 y 20 caracteres alfanuméricos.",
  });

const optionalEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Escribe un correo electrónico válido.",
  })
  .transform((v) => (v === "" ? null : v));

const optionalPhoneField = z
  .string()
  .trim()
  .max(25, "Teléfono demasiado largo.")
  .transform((v) => (v === "" ? null : v));

export const createUserSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, { error: "Tipo de documento inválido." }),
  documentNumber: documentNumberField,
  firstName: z.string({ error: "Escribe los nombres." }).trim().min(2, "Mínimo 2 caracteres.").max(80),
  lastName: z.string({ error: "Escribe los apellidos." }).trim().min(2, "Mínimo 2 caracteres.").max(80),
  email: optionalEmailField,
  phone: optionalPhoneField,
  role: z.enum(ROLES, { error: "Rol inválido." }),
  password: z
    .string({ error: "Asigna una contraseña temporal." })
    .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH),
});

export const updateUserSchema = z.object({
  userId: z.uuid({ error: "Usuario inválido." }),
  documentType: z.enum(DOCUMENT_TYPES, { error: "Tipo de documento inválido." }),
  documentNumber: documentNumberField,
  firstName: z.string({ error: "Escribe los nombres." }).trim().min(2, "Mínimo 2 caracteres.").max(80),
  lastName: z.string({ error: "Escribe los apellidos." }).trim().min(2, "Mínimo 2 caracteres.").max(80),
  email: optionalEmailField,
  phone: optionalPhoneField,
  role: z.enum(ROLES, { error: "Rol inválido." }),
});

export const toggleUserActiveSchema = z.object({
  userId: z.uuid({ error: "Usuario inválido." }),
  nextActive: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const revokeSessionsSchema = z.object({
  userId: z.uuid({ error: "Usuario inválido." }),
});

export const adminResetPasswordSchema = z.object({
  userId: z.uuid({ error: "Usuario inválido." }),
  newPassword: z
    .string({ error: "Escribe la nueva contraseña." })
    .min(PASSWORD_MIN_LENGTH, `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH),
});

export const createGuardianLinkSchema = z.object({
  guardianId: z.uuid({ error: "Acudiente inválido." }),
  studentId: z.uuid({ error: "Estudiante inválido." }),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS, { error: "Parentesco inválido." }),
  isFinancialResponsible: z.boolean().default(false),
  canPickUp: z.boolean().default(true),
});

export const removeGuardianLinkSchema = z.object({
  linkId: z.uuid({ error: "Vínculo inválido." }),
});

/**
 * Regla de seguridad institucional: impide auto-bloqueo del administrador en
 * sesión y evita dejar el campus sin al menos un administrador activo.
 */
export function validateAdminSafety(input: {
  actorId: string;
  targetId: string;
  currentRole: Role;
  nextRole: Role;
  currentActive: boolean;
  nextActive: boolean;
  otherActiveAdminsCount: number;
}): { ok: true } | { ok: false; message: string } {
  if (input.actorId === input.targetId) {
    if (!input.nextActive) {
      return { ok: false, message: "No puedes desactivar tu propia cuenta mientras tienes la sesión abierta." };
    }
    if (input.currentRole === "ADMIN" && input.nextRole !== "ADMIN") {
      return { ok: false, message: "No puedes quitarte el rol de Secretaría / Rectoría a ti mismo." };
    }
  }

  const losesAdminAccess =
    input.currentRole === "ADMIN" &&
    input.currentActive &&
    (input.nextRole !== "ADMIN" || !input.nextActive);

  if (losesAdminAccess && input.otherActiveAdminsCount === 0) {
    return {
      ok: false,
      message: "Debe existir al menos una cuenta activa de Secretaría / Rectoría en el sistema.",
    };
  }

  return { ok: true };
}
