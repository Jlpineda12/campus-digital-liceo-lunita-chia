import "server-only";
import ExcelJS from "exceljs";
import { hasXlsxMagicBytes } from "./bulk";

const TEMPLATE_HEADERS = [
  "Rol",
  "TipoDoc",
  "Documento",
  "Nombres",
  "Apellidos",
  "Correo",
  "Telefono",
  "Grupo",
  "DocumentoAcudiente",
  "Parentesco",
] as const;

const TEMPLATE_EXAMPLES = [
  ["Acudiente", "CC", "52999001", "Marta Lucía", "Gómez Pérez", "", "3105550101", "", "", ""],
  ["Estudiante", "TI", "1070999001", "Mateo", "Gómez Torres", "", "", "7A", "52999001", "MADRE"],
  ["Docente", "CC", "80999001", "Carlos Arturo", "Méndez Rojas", "", "3155550202", "", "", ""],
] as const;

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return "";
}

/** Parsea la primera hoja de un archivo `.xlsx` validando sus magic bytes ZIP. */
export async function parseXlsxBuffer(buffer: Buffer): Promise<string[][]> {
  if (!hasXlsxMagicBytes(buffer)) {
    throw new Error("El archivo .xlsx no es un libro de Excel válido.");
  }
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS typings declare Node Buffer from @types/node<22
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const matrix: string[][] = [];
  const colCount = Math.min(Math.max(sheet.columnCount, TEMPLATE_HEADERS.length), 20);

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c += 1) {
      cells.push(cellToString(row.getCell(c).value));
    }
    if (cells.some((v) => v.length > 0)) {
      matrix.push(cells);
    }
  });
  return matrix;
}

/** Genera la plantilla oficial `.xlsx` lista para diligenciar en Excel o Google Sheets. */
export async function buildUsersTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Campus Digital · Liceo Lunita de Chía";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Usuarios");
  sheet.columns = [
    { header: "Rol", key: "rol", width: 16 },
    { header: "TipoDoc", key: "tipoDoc", width: 11 },
    { header: "Documento", key: "documento", width: 18 },
    { header: "Nombres", key: "nombres", width: 22 },
    { header: "Apellidos", key: "apellidos", width: 22 },
    { header: "Correo", key: "correo", width: 30 },
    { header: "Telefono", key: "telefono", width: 16 },
    { header: "Grupo", key: "grupo", width: 12 },
    { header: "DocumentoAcudiente", key: "docAcudiente", width: 22 },
    { header: "Parentesco", key: "parentesco", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1747" } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 24;

  for (const example of TEMPLATE_EXAMPLES) {
    sheet.addRow([...example]);
  }

  const guide = workbook.addWorksheet("Instrucciones");
  guide.columns = [
    { header: "Columna", width: 24 },
    { header: "Obligatoria", width: 14 },
    { header: "Descripción y valores válidos", width: 68 },
  ];
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF303296" } };

  const notes: Array<[string, string, string]> = [
    ["Rol", "Sí", "Estudiante, Acudiente, Docente, Coordinación o Admin."],
    ["TipoDoc", "Opcional", "RC, TI, CC, CE, NUIP, PPT o PA. Si se deja vacío: TI para Estudiante, CC para adultos."],
    ["Documento", "Sí", "Número de documento único (sin puntos ni espacios). Sirve para iniciar sesión."],
    ["Nombres / Apellidos", "Sí", "Nombre completo del usuario."],
    ["Correo", "Opcional", "Si se deja vacío, la plataforma genera automáticamente nombre.apellido.xxx@campus.lunita.edu.co."],
    ["Telefono", "Opcional", "Número de contacto celular o fijo."],
    ["Grupo", "Opcional", "Solo para Estudiantes (ej. 7A, 3A). Si coincide con un grupo activo, se matricula automáticamente."],
    ["DocumentoAcudiente", "Opcional", "Solo para Estudiantes. Si coincide con un Acudiente existente o incluido en este archivo, se vinculan."],
    ["Parentesco", "Opcional", "MADRE, PADRE o ACUDIENTE (por defecto ACUDIENTE)."],
    [
      "Contraseña inicial",
      "Automática",
      "La plataforma genera credenciales personalizadas seguras: LLC-Iniciales+Ult4Doc-XX (ej. LLC-MG9001-K7).",
    ],
  ];
  for (const row of notes) guide.addRow(row);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Genera la plantilla CSV con BOM UTF-8 y punto y coma para abrir directo en Excel en español. */
export function buildUsersTemplateCsv(): string {
  const lines = [
    TEMPLATE_HEADERS.join(";"),
    ...TEMPLATE_EXAMPLES.map((r) => r.join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
