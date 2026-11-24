import { randomBytes } from "node:crypto";
import type { DocumentType, GuardianRelationship } from "@/modules/core/academic-structure/constants";
import { DOCUMENT_TYPES, GUARDIAN_RELATIONSHIPS } from "@/modules/core/academic-structure/constants";
import type { Role } from "@/modules/core/auth/roles";
import { normalizeDocumentNumber } from "./schemas";

/**
 * Motor puro de carga masiva (Excel/CSV) y generación de credenciales
 * institucionales personalizadas para Liceo Lunita de Chía.
 */

export const MAX_BULK_IMPORT_ROWS = 1500;
export const MAX_BULK_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const SCHOOL_EMAIL_DOMAIN = "campus.lunita.edu.co";
export const SCHOOL_CREDENTIAL_PREFIX = "LLC"; // Liceo Lunita de Chía

const SAFE_SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function slugPart(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

/** Genera correo institucional único basado en nombre, apellido y últimos 3 dígitos del documento. */
export function generateInstitutionalEmail(
  firstName: string,
  lastName: string,
  documentNumber: string,
  usedEmails: Set<string>,
): string {
  const first = slugPart(firstName.split(/\s+/)[0] ?? firstName) || "usuario";
  const last = slugPart(lastName.split(/\s+/)[0] ?? lastName) || "lunita";
  const docTail = normalizeDocumentNumber(documentNumber).toLowerCase().slice(-3) || "001";

  let candidate = `${first}.${last}.${docTail}@${SCHOOL_EMAIL_DOMAIN}`;
  let suffix = 2;
  while (usedEmails.has(candidate)) {
    candidate = `${first}.${last}.${docTail}${suffix}@${SCHOOL_EMAIL_DOMAIN}`;
    suffix += 1;
  }
  usedEmails.add(candidate);
  return candidate;
}

/**
 * Genera una contraseña inicial personalizada y segura:
 * `LLC-<InicialesNombreApellido><Últimos4Doc>-<2Aleatorios>` (ej. `LLC-CT4568-K9`).
 * Combina identidad institucional (LLC = Liceo Lunita de Chía), iniciales del
 * usuario, últimos 4 caracteres del documento y 2 caracteres criptográficos
 * aleatorios para impedir adivinación entre compañeros.
 */
export function generateInstitutionalPassword(
  firstName: string,
  lastName: string,
  documentNumber: string,
): string {
  const initial1 =
    stripAccents(firstName.trim())
      .replace(/[^A-Za-z]/g, "")
      .charAt(0)
      .toUpperCase() || "L";
  const initial2 =
    stripAccents(lastName.trim())
      .replace(/[^A-Za-z]/g, "")
      .charAt(0)
      .toUpperCase() || "C";

  const cleanDoc = normalizeDocumentNumber(documentNumber);
  const docFragment = (cleanDoc.length >= 4 ? cleanDoc.slice(-4) : cleanDoc.padStart(4, "0")).toUpperCase();

  const bytes = randomBytes(2);
  const rand1 = SAFE_SUFFIX_ALPHABET[bytes[0]! % SAFE_SUFFIX_ALPHABET.length]!;
  const rand2 = SAFE_SUFFIX_ALPHABET[bytes[1]! % SAFE_SUFFIX_ALPHABET.length]!;

  return `${SCHOOL_CREDENTIAL_PREFIX}-${initial1}${initial2}${docFragment}-${rand1}${rand2}`;
}

/** Reconoce nombres de rol en español o inglés desde Excel/CSV. */
export function parseRoleLabel(raw: string): Role | null {
  const key = stripAccents(raw).trim().toUpperCase().replace(/\s+/g, "_");
  switch (key) {
    case "STUDENT":
    case "ESTUDIANTE":
    case "ESTUDIANTES":
    case "ALUMNO":
    case "ALUMNA":
      return "STUDENT";
    case "GUARDIAN":
    case "ACUDIENTE":
    case "ACUDIENTES":
    case "PADRE":
    case "MADRE":
    case "FAMILIA":
      return "GUARDIAN";
    case "TEACHER":
    case "DOCENTE":
    case "DOCENTES":
    case "PROFESOR":
    case "PROFESORA":
      return "TEACHER";
    case "COORDINATOR":
    case "COORDINACION":
    case "COORDINADOR":
    case "COORDINADORA":
      return "COORDINATOR";
    case "ADMIN":
    case "ADMINISTRADOR":
    case "SECRETARIA":
    case "RECTORIA":
    case "SECRETARIA_RECTORIA":
    case "SECRETARIA_/_RECTORIA":
      return "ADMIN";
    default:
      return null;
  }
}

export function parseDocumentType(raw: string, role: Role): DocumentType {
  const key = stripAccents(raw).trim().toUpperCase();
  if ((DOCUMENT_TYPES as readonly string[]).includes(key)) return key as DocumentType;
  return role === "STUDENT" ? "TI" : "CC";
}

export function parseRelationship(raw: string): GuardianRelationship {
  const key = stripAccents(raw).trim().toUpperCase();
  if ((GUARDIAN_RELATIONSHIPS as readonly string[]).includes(key)) return key as GuardianRelationship;
  return "ACUDIENTE";
}

export interface ParsedBulkRow {
  rowNumber: number;
  role: Role;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  guardianDocument: string | null;
  relationship: GuardianRelationship;
}

export interface BulkRowError {
  rowNumber: number;
  message: string;
}

/** Normaliza encabezados de Excel/CSV para aceptar variantes comunes en español. */
function canonicalHeader(raw: string): string {
  const key = stripAccents(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (["rol", "role", "perfil", "tipousuario"].includes(key)) return "role";
  if (["tipodoc", "tipodocumento", "documenttype", "tdoc"].includes(key)) return "documentType";
  if (["documento", "numerodocumento", "documentnumber", "doc", "cedula", "identificacion"].includes(key)) {
    return "documentNumber";
  }
  if (["nombres", "nombre", "firstname"].includes(key)) return "firstName";
  if (["apellidos", "apellido", "lastname"].includes(key)) return "lastName";
  if (["correo", "email", "correoelectronico", "mail"].includes(key)) return "email";
  if (["telefono", "celular", "phone", "tel"].includes(key)) return "phone";
  if (["grupo", "curso", "group", "groupname"].includes(key)) return "groupName";
  if (["documentoacudiente", "docacudiente", "acudiente", "guardiandocument"].includes(key)) {
    return "guardianDocument";
  }
  if (["parentesco", "relationship", "relacion"].includes(key)) return "relationship";
  return key;
}

/**
 * Parsea texto CSV (acepta delimitador `,` o `;` como exporta Excel en español,
 * comillas dobles y BOM UTF-8).
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const sep = semicolons > commas ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

/** Convierte una matriz tabular (de Excel o CSV) en filas validadas y errores por número de fila. */
export function validateBulkMatrix(matrix: string[][]): {
  valid: ParsedBulkRow[];
  errors: BulkRowError[];
} {
  if (matrix.length < 2) {
    return {
      valid: [],
      errors: [{ rowNumber: 1, message: "El archivo no contiene filas de datos debajo del encabezado." }],
    };
  }

  const headers = matrix[0]!.map(canonicalHeader);
  const idx = (name: string) => headers.indexOf(name);
  const roleIdx = idx("role");
  const docTypeIdx = idx("documentType");
  const docNumIdx = idx("documentNumber");
  const firstIdx = idx("firstName");
  const lastIdx = idx("lastName");
  const emailIdx = idx("email");
  const phoneIdx = idx("phone");
  const groupIdx = idx("groupName");
  const guardianDocIdx = idx("guardianDocument");
  const relIdx = idx("relationship");

  if (docNumIdx === -1 || firstIdx === -1 || lastIdx === -1 || roleIdx === -1) {
    return {
      valid: [],
      errors: [
        {
          rowNumber: 1,
          message:
            "Faltan columnas obligatorias. Descarga la plantilla oficial: Rol, TipoDoc, Documento, Nombres, Apellidos.",
        },
      ],
    };
  }

  const valid: ParsedBulkRow[] = [];
  const errors: BulkRowError[] = [];
  const seenDocs = new Set<string>();

  const dataRows = matrix.slice(1, MAX_BULK_IMPORT_ROWS + 1);
  if (matrix.length - 1 > MAX_BULK_IMPORT_ROWS) {
    errors.push({
      rowNumber: MAX_BULK_IMPORT_ROWS + 2,
      message: `Se permiten máximo ${MAX_BULK_IMPORT_ROWS} filas por archivo.`,
    });
  }

  dataRows.forEach((cols, i) => {
    const rowNumber = i + 2;
    const cell = (colIndex: number) => (colIndex >= 0 ? (cols[colIndex] ?? "").trim() : "");

    const rawRole = cell(roleIdx);
    const rawDoc = cell(docNumIdx);
    const firstName = cell(firstIdx);
    const lastName = cell(lastIdx);

    if (!rawRole && !rawDoc && !firstName && !lastName) return;

    const role = parseRoleLabel(rawRole);
    if (!role) {
      errors.push({
        rowNumber,
        message: `Rol "${rawRole || "(vacío)"}" no reconocido. Usa Estudiante, Acudiente, Docente, Coordinación o Admin.`,
      });
      return;
    }

    const documentNumber = normalizeDocumentNumber(rawDoc);
    if (!/^[A-Z0-9]{4,20}$/.test(documentNumber)) {
      errors.push({ rowNumber, message: `Documento "${rawDoc}" inválido (usa 4 a 20 caracteres alfanuméricos).` });
      return;
    }

    if (seenDocs.has(documentNumber)) {
      errors.push({ rowNumber, message: `Documento ${documentNumber} repetido dentro del mismo archivo.` });
      return;
    }
    seenDocs.add(documentNumber);

    if (firstName.length < 2 || lastName.length < 2) {
      errors.push({ rowNumber, message: "Nombres y apellidos deben tener al menos 2 caracteres." });
      return;
    }

    const rawEmail = cell(emailIdx).toLowerCase();
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      errors.push({ rowNumber, message: `Correo "${rawEmail}" con formato inválido.` });
      return;
    }

    const rawGuardianDoc = cell(guardianDocIdx);
    const guardianDocument = rawGuardianDoc ? normalizeDocumentNumber(rawGuardianDoc) : null;

    valid.push({
      rowNumber,
      role,
      documentType: parseDocumentType(cell(docTypeIdx), role),
      documentNumber,
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      email: rawEmail || null,
      phone: cell(phoneIdx).slice(0, 25) || null,
      groupName: cell(groupIdx).toUpperCase() || null,
      guardianDocument,
      relationship: parseRelationship(cell(relIdx)),
    });
  });

  return { valid, errors };
}

/** Verifica magic bytes de archivo `.xlsx` (cabecera ZIP PK\x03\x04). */
export function hasXlsxMagicBytes(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}
