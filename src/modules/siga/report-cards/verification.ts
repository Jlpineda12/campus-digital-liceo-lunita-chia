/**
 * Utilidades puras de verificación pública de documentos y privacidad Ley 1581
 * (REGLAS.md §3.1, docs/secciones/01 §4 y 06 §3).
 */
export const VERIFICATION_CODE_PATTERN = /^[A-Za-z0-9-]{6,64}$/;

export function isValidVerificationCode(code: string): boolean {
  return VERIFICATION_CODE_PATTERN.test(code);
}

/**
 * Enmascara el nombre completo de un menor para el verificador público QR:
 * "Sofía Ramírez Castro" → "S. R. C."
 */
export function maskStudentName(firstName: string, lastName: string): string {
  const parts = `${firstName} ${lastName}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "Estudiante";
  return parts.map((p) => `${p[0]!.toUpperCase()}.`).join(" ");
}

/**
 * Enmascara el documento de identidad mostrando solo los últimos 4 dígitos:
 * "1070000001" → "***0001"
 */
export function maskDocumentNumber(documentNumber: string): string {
  const clean = documentNumber.trim();
  if (clean.length <= 4) return "***";
  return `***${clean.slice(-4)}`;
}

/** Construye un código legible de alta entropía dado un sufijo hexadecimal aleatorio. */
export function formatVerificationCode(year: number, periodNumber: number, randomHex: string): string {
  return `LUN-${year}-P${periodNumber}-${randomHex.toUpperCase()}`;
}

/**
 * Regla institucional obligatoria: estudiantes y padres SOLO pueden consultar un
 * boletín cuando Rectoría / Secretaría lo ha habilitado oficialmente (`issuedAt !== null`).
 */
export function canFamilyViewReportCard(record: { issuedAt: Date | null } | null | undefined): boolean {
  return Boolean(record && record.issuedAt !== null);
}
