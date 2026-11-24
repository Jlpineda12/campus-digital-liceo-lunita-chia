/**
 * Política de contraseñas nuevas. Archivo puro: la usan el servidor (validación
 * obligatoria) y el formulario (medidor de fortaleza en vivo).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = [
  "1234567890",
  "0123456789",
  "contraseña",
  "contrasena",
  "password",
  "qwertyuiop",
  "lunita",
  "liceolunita",
  "colombia",
  "chia",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export interface PasswordContext {
  documentNumber?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Devuelve los problemas de la contraseña (vacío si cumple la política). */
export function validateNewPassword(password: string, context: PasswordContext = {}): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(`Usa como máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    problems.push("Combina letras y números.");
  }

  const plain = normalize(password);
  const personal = [
    context.documentNumber,
    context.email?.split("@")[0],
    context.firstName,
    context.lastName?.split(" ")[0],
  ]
    .filter((v): v is string => Boolean(v && v.length >= 3))
    .map(normalize);
  if (personal.some((value) => plain.includes(value))) {
    problems.push("No uses tu documento, nombre ni correo.");
  }
  if (COMMON_PASSWORDS.some((common) => plain.includes(common)) || /^(.)\1+$/.test(plain)) {
    problems.push("Evita contraseñas comunes o repetitivas.");
  }
  return problems;
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  0: "Muy débil",
  1: "Débil",
  2: "Aceptable",
  3: "Fuerte",
  4: "Muy fuerte",
};

/** Estimación simple para el medidor (no reemplaza la validación). */
export function estimateStrength(password: string): PasswordStrength {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 14) score += 1;
  const classes = [/[a-zñ]/, /[A-ZÑ]/, /\d/, /[^\p{L}\d]/u].filter((re) => re.test(password)).length;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (validateNewPassword(password).length > 0) score = Math.min(score, 1);
  return Math.min(score, 4) as PasswordStrength;
}
