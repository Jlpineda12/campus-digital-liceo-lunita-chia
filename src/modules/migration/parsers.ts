import ExcelJS from "exceljs";
import { sanitizeAulaText } from "@/modules/aula/sanitize";
import { DOCUMENT_TYPES, GUARDIAN_RELATIONSHIPS, type DocumentType, type GuardianRelationship } from "@/modules/core/academic-structure/constants";
import { PAYMENT_CHANNELS, type PaymentChannel } from "@/db/schema/matriculas";
import { SIEE_DIMENSIONS } from "@/db/schema/siga";

export type SieeDimension = (typeof SIEE_DIMENSIONS)[number];

/**
 * Motor puro de parseo, limpieza y validación ETL para Fase 5:
 * - Planillas Excel (.xlsx) y CSV (SIGA / Cartera / Notas)
 * - Bancos de preguntas Moodle XML (sin entidades externas / seguro contra XXE)
 */

export interface RowIssue {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
}

export interface ParsedStudentFamilyRow {
  rowNumber: number;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  groupName: string;
  guardianDoc: string | null;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  guardianRelationship: GuardianRelationship;
}

export interface ParsedHistoricalGradeRow {
  rowNumber: number;
  studentDocument: string;
  subjectName: string;
  periodOrder: number;
  dimension: SieeDimension;
  score: number;
  columnTitle: string;
}

export interface ParsedBillingBalanceRow {
  rowNumber: number;
  studentDocument: string;
  billingMonth: number; // 0 = Matrícula, 2..11 = Feb..Nov
  paidCop: number;
  channel: PaymentChannel;
  referenceCode: string;
  paidDate: string; // YYYY-MM-DD
}

export interface ParsedMoodleQuestion {
  index: number;
  questionType: "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE";
  prompt: string;
  points: number;
  options: Array<{ id: string; label: string }>;
  correctOptionIds: string[];
}

export function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function cleanDocumentNumber(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, "").trim().toUpperCase();
}

/** Corrige erratas conocidas del Moodle/SIGA histórico (PLAN_MIGRACION_Y_FASES.md). */
export function normalizeHistoricalLabel(raw: string): string {
  const trimmed = raw.trim();
  if (/^trasici[oó]n$/i.test(trimmed)) return "Transición";
  return trimmed.replace(/\s+/g, " ");
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => String((r as { text?: string }).text ?? "")).join("").trim();
    }
    if (obj.result !== undefined) return cellToString(obj.result);
  }
  return String(val).trim();
}

export function parseCsvText(csvText: string): Array<Record<string, string>> {
  const clean = csvText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0]!;
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitLine(firstLine).map(normalizeHeaderKey);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]!);
    if (cols.every((c) => c === "")) continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) rec[h] = cols[idx] ?? "";
    });
    rows.push(rec);
  }
  return rows;
}

/** Lee un archivo `.xlsx` o `.csv` y retorna filas normalizadas por clave de columna. */
export async function readSpreadsheetRows(
  buffer: Buffer,
  fileName: string,
): Promise<Array<Record<string, string>>> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsvText(buffer.toString("utf-8"));
  }

  const wb = new ExcelJS.Workbook();
  // ExcelJS typings esperan Buffer<ArrayBufferLike> compatible con Node 22+
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return [];

  const headerValues = ws.getRow(1).values;
  const headers: string[] = [];
  if (Array.isArray(headerValues)) {
    for (let c = 1; c < headerValues.length; c++) {
      headers[c] = normalizeHeaderKey(cellToString(headerValues[c]));
    }
  }

  const rows: Array<Record<string, string>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rec: Record<string, string> = {};
    let hasValue = false;
    for (let c = 1; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const str = cellToString(row.getCell(c).value);
      if (str !== "") hasValue = true;
      rec[key] = str;
    }
    if (hasValue) rows.push(rec);
  }
  return rows;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k]!;
  }
  return "";
}

/* ---------------------------------------------------------------------------
   1) Estudiantes + Acudientes + Grupo (SIGA / SIMAT)
   --------------------------------------------------------------------------- */
export function parseStudentsFamiliesRows(rawRows: Array<Record<string, string>>): {
  valid: ParsedStudentFamilyRow[];
  issues: RowIssue[];
} {
  const valid: ParsedStudentFamilyRow[] = [];
  const issues: RowIssue[] = [];
  const seenDocs = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rawDocType = pick(row, ["tipo_doc", "tipo_documento", "doc_type"]).toUpperCase() || "TI";
    const documentType: DocumentType = (DOCUMENT_TYPES as readonly string[]).includes(rawDocType)
      ? (rawDocType as DocumentType)
      : "TI";

    const documentNumber = cleanDocumentNumber(
      pick(row, ["documento", "numero_documento", "num_documento", "documento_estudiante", "identificacion"]),
    );
    const firstName = normalizeHistoricalLabel(pick(row, ["nombres", "nombre", "nombres_estudiante"]));
    const lastName = normalizeHistoricalLabel(pick(row, ["apellidos", "apellido", "apellidos_estudiante"]));
    const groupName = normalizeHistoricalLabel(pick(row, ["grupo", "curso", "salon"])).toUpperCase();
    const rawEmail = pick(row, ["correo", "email", "correo_estudiante"]).toLowerCase();

    if (!documentNumber || documentNumber.length < 5) {
      issues.push({ rowNumber, severity: "error", message: "Número de documento del estudiante faltante o muy corto." });
      return;
    }
    if (!firstName || !lastName) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${documentNumber}: faltan nombres o apellidos.` });
      return;
    }
    if (!groupName) {
      issues.push({ rowNumber, severity: "error", message: `${firstName} ${lastName}: falta indicar el grupo/curso (ej. 3A, 7A).` });
      return;
    }
    if (seenDocs.has(documentNumber)) {
      issues.push({ rowNumber, severity: "warning", message: `Doc ${documentNumber} duplicado en el archivo; se omite fila repetida.` });
      return;
    }
    seenDocs.add(documentNumber);

    const email = rawEmail || `est.${documentNumber.toLowerCase()}@campus.lunita.edu.co`;
    const guardianDoc = cleanDocumentNumber(pick(row, ["documento_acudiente", "doc_acudiente", "acudiente_doc"])) || null;
    const guardianFirstName = normalizeHistoricalLabel(pick(row, ["nombres_acudiente", "acudiente_nombres"])) || null;
    const guardianLastName = normalizeHistoricalLabel(pick(row, ["apellidos_acudiente", "acudiente_apellidos"])) || null;
    const guardianEmail = pick(row, ["correo_acudiente", "email_acudiente"]).toLowerCase() || null;
    const guardianPhone = pick(row, ["telefono_acudiente", "celular_acudiente", "telefono"]) || null;
    const rawRel = pick(row, ["parentesco", "relacion"]).toUpperCase() || "ACUDIENTE";
    const guardianRelationship: GuardianRelationship = (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(rawRel)
      ? (rawRel as GuardianRelationship)
      : "ACUDIENTE";

    valid.push({
      rowNumber,
      documentType,
      documentNumber,
      firstName,
      lastName,
      email,
      groupName,
      guardianDoc,
      guardianFirstName,
      guardianLastName,
      guardianEmail,
      guardianPhone,
      guardianRelationship,
    });
  });

  return { valid, issues };
}

/* ---------------------------------------------------------------------------
   2) Histórico de Calificaciones SIEE
   --------------------------------------------------------------------------- */
export function parseHistoricalGradesRows(rawRows: Array<Record<string, string>>): {
  valid: ParsedHistoricalGradeRow[];
  issues: RowIssue[];
} {
  const valid: ParsedHistoricalGradeRow[] = [];
  const issues: RowIssue[] = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const studentDocument = cleanDocumentNumber(pick(row, ["documento", "documento_estudiante", "numero_documento"]));
    const subjectName = normalizeHistoricalLabel(pick(row, ["asignatura", "materia", "curso"]));
    const rawPeriod = Number(pick(row, ["periodo", "numero_periodo", "period"]));
    const rawDim = (pick(row, ["dimension", "componente"]) || "SABER").toUpperCase();
    const rawScore = Number(pick(row, ["nota", "calificacion", "definitiva", "score"]).replace(",", "."));
    const columnTitle = normalizeHistoricalLabel(pick(row, ["actividad", "concepto", "titulo"]) || "Nota migrada SIGA");

    if (!studentDocument) {
      issues.push({ rowNumber, severity: "error", message: "Falta documento del estudiante." });
      return;
    }
    if (!subjectName) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${studentDocument}: falta nombre de la asignatura.` });
      return;
    }
    if (!Number.isInteger(rawPeriod) || rawPeriod < 1 || rawPeriod > 4) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${studentDocument}: el periodo debe ser 1, 2, 3 o 4.` });
      return;
    }
    if (Number.isNaN(rawScore) || rawScore < 1.0 || rawScore > 5.0) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${studentDocument}: la nota debe estar entre 1.0 y 5.0.` });
      return;
    }
    const dimension: SieeDimension = (SIEE_DIMENSIONS as readonly string[]).includes(rawDim)
      ? (rawDim as SieeDimension)
      : "SABER";

    valid.push({
      rowNumber,
      studentDocument,
      subjectName,
      periodOrder: rawPeriod,
      dimension,
      score: Math.round(rawScore * 10) / 10,
      columnTitle: columnTitle.slice(0, 80),
    });
  });

  return { valid, issues };
}

/* ---------------------------------------------------------------------------
   3) Cartera / Saldos y Pagos Previos (Mega-Excel Feb–Nov)
   --------------------------------------------------------------------------- */
const MONTH_ALIASES: Record<string, number> = {
  "0": 0,
  matricula: 0,
  mat: 0,
  "2": 2,
  feb: 2,
  febrero: 2,
  "3": 3,
  mar: 3,
  marzo: 3,
  "4": 4,
  abr: 4,
  abril: 4,
  "5": 5,
  may: 5,
  mayo: 5,
  "6": 6,
  jun: 6,
  junio: 6,
  "7": 7,
  jul: 7,
  julio: 7,
  "8": 8,
  ago: 8,
  agosto: 8,
  "9": 9,
  sep: 9,
  septiembre: 9,
  "10": 10,
  oct: 10,
  octubre: 10,
  "11": 11,
  nov: 11,
  noviembre: 11,
};

function parseCopAmount(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return Number.NaN;
  // Si termina en centavos explícitos (.00 o ,00), los descartamos antes de quitar separadores de miles.
  const withoutCents = /[.,]\d{2}$/.test(trimmed) ? trimmed.slice(0, -3) : trimmed;
  const digits = withoutCents.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

export function parseBillingBalancesRows(rawRows: Array<Record<string, string>>): {
  valid: ParsedBillingBalanceRow[];
  issues: RowIssue[];
} {
  const valid: ParsedBillingBalanceRow[] = [];
  const issues: RowIssue[] = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const studentDocument = cleanDocumentNumber(pick(row, ["documento", "documento_estudiante", "numero_documento"]));
    const rawMonth = normalizeHeaderKey(pick(row, ["mes", "mes_cobro", "concepto"]));
    const billingMonth = MONTH_ALIASES[rawMonth];
    const rawPaid = parseCopAmount(pick(row, ["valor_pagado", "monto", "pagado", "valor"]));
    const rawChannelRaw = (pick(row, ["canal", "medio_pago"]) || "BANK_TRANSFER").toUpperCase();
    const rawChannel =
      rawChannelRaw === "TRANSFERENCIA"
        ? "BANK_TRANSFER"
        : rawChannelRaw === "TESORERIA" || rawChannelRaw === "EFECTIVO"
          ? "CASH_OFFICE"
          : rawChannelRaw === "BRE-B"
            ? "BRE_B"
            : rawChannelRaw;
    const channel: PaymentChannel = (PAYMENT_CHANNELS as readonly string[]).includes(rawChannel)
      ? (rawChannel as PaymentChannel)
      : "BANK_TRANSFER";
    const referenceCode =
      pick(row, ["referencia", "recibo", "comprobante"]) || `MIG-${studentDocument}-M${billingMonth ?? 0}`;
    const paidDate = pick(row, ["fecha_pago", "fecha"]) || new Date().toISOString().slice(0, 10);

    if (!studentDocument) {
      issues.push({ rowNumber, severity: "error", message: "Falta documento del estudiante." });
      return;
    }
    if (billingMonth === undefined) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${studentDocument}: mes inválido (usa Matricula o Febrero..Noviembre).` });
      return;
    }
    if (Number.isNaN(rawPaid) || rawPaid < 1000) {
      issues.push({ rowNumber, severity: "error", message: `Doc ${studentDocument}: el valor pagado debe ser al menos $1.000 COP.` });
      return;
    }

    valid.push({
      rowNumber,
      studentDocument,
      billingMonth,
      paidCop: Math.round(rawPaid),
      channel,
      referenceCode: referenceCode.slice(0, 60),
      paidDate: /^\d{4}-\d{2}-\d{2}$/.test(paidDate) ? paidDate : new Date().toISOString().slice(0, 10),
    });
  });

  return { valid, issues };
}

/* ---------------------------------------------------------------------------
   4) Banco de Preguntas Moodle XML (seguro sin XXE)
   --------------------------------------------------------------------------- */
function unwrapCdataAndClean(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  const decoded = withoutCdata
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return sanitizeAulaText(decoded);
}

export function parseMoodleQuizXml(xmlText: string): {
  valid: ParsedMoodleQuestion[];
  issues: RowIssue[];
} {
  const valid: ParsedMoodleQuestion[] = [];
  const issues: RowIssue[] = [];

  // Seguridad: rechaza declaraciones DOCTYPE/ENTITY (prevención XXE).
  if (/<!DOCTYPE|<!ENTITY/i.test(xmlText)) {
    return {
      valid: [],
      issues: [{ rowNumber: 1, severity: "error", message: "El XML contiene directivas DOCTYPE/ENTITY no permitidas por seguridad." }],
    };
  }

  const questionBlocks = Array.from(
    xmlText.matchAll(/<question\b[^>]*type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/question>/gi),
  );

  if (questionBlocks.length === 0) {
    return {
      valid: [],
      issues: [{ rowNumber: 1, severity: "error", message: "No se encontraron nodos <question> válidos en el archivo Moodle XML." }],
    };
  }

  questionBlocks.forEach((match, idx) => {
    const rawType = (match[1] ?? "").toLowerCase();
    const body = match[2] ?? "";
    const num = idx + 1;

    if (rawType === "category") return;
    if (rawType !== "multichoice" && rawType !== "truefalse") {
      issues.push({
        rowNumber: num,
        severity: "warning",
        message: `Pregunta #${num} de tipo «${rawType}» omitida (solo se importan selección única/múltiple y verdadero/falso).`,
      });
      return;
    }

    const qTextMatch = body.match(/<questiontext\b[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<\/questiontext>/i);
    const prompt = unwrapCdataAndClean(qTextMatch?.[1] ?? "");
    if (prompt.length < 5) {
      issues.push({ rowNumber: num, severity: "error", message: `Pregunta #${num}: enunciado vacío o demasiado corto.` });
      return;
    }

    const gradeMatch = body.match(/<defaultgrade>\s*([\d.,]+)\s*<\/defaultgrade>/i);
    const pointsRaw = Number((gradeMatch?.[1] ?? "1").replace(",", "."));
    const points = Number.isFinite(pointsRaw) && pointsRaw >= 0.5 && pointsRaw <= 50 ? pointsRaw : 1;

    const singleMatch = body.match(/<single>\s*(true|false|1|0)\s*<\/single>/i);
    const isSingle = !singleMatch || singleMatch[1]!.toLowerCase() === "true" || singleMatch[1] === "1";

    const ansMatches = Array.from(
      body.matchAll(/<answer\b[^>]*fraction=["']([^"']+)["'][^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<\/answer>/gi),
    );

    const options: Array<{ id: string; label: string }> = [];
    const correctOptionIds: string[] = [];

    ansMatches.slice(0, 6).forEach((am, optIdx) => {
      const fraction = Number((am[1] ?? "0").replace(",", "."));
      let label = unwrapCdataAndClean(am[2] ?? "");
      if (rawType === "truefalse") {
        if (/^true$/i.test(label)) label = "Verdadero";
        if (/^false$/i.test(label)) label = "Falso";
      }
      if (!label) return;
      const optId = `m-${num}-${optIdx + 1}`;
      options.push({ id: optId, label: label.slice(0, 300) });
      if (Number.isFinite(fraction) && fraction > 0) {
        correctOptionIds.push(optId);
      }
    });

    if (options.length < 2) {
      issues.push({ rowNumber: num, severity: "error", message: `Pregunta #${num}: tiene menos de 2 opciones válidas.` });
      return;
    }
    if (correctOptionIds.length === 0) {
      issues.push({ rowNumber: num, severity: "error", message: `Pregunta #${num}: no tiene ninguna respuesta marcada como correcta (fraction > 0).` });
      return;
    }

    const questionType: ParsedMoodleQuestion["questionType"] =
      rawType === "truefalse"
        ? "TRUE_FALSE"
        : isSingle && correctOptionIds.length === 1
          ? "SINGLE_CHOICE"
          : "MULTI_CHOICE";

    valid.push({
      index: num,
      questionType,
      prompt: prompt.slice(0, 1000),
      points,
      options,
      correctOptionIds: questionType === "MULTI_CHOICE" ? correctOptionIds : [correctOptionIds[0]!],
    });
  });

  return { valid, issues };
}
