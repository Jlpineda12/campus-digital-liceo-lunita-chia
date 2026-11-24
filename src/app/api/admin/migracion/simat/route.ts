import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { LEVEL_CODES, LEVEL_LABELS, type LevelCode } from "@/modules/core/academic-structure/constants";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { recordAudit } from "@/modules/core/audit/service";
import { can } from "@/modules/core/auth/permissions";
import { getRequestMeta, getSession } from "@/modules/core/auth/session";
import { getSimatExportRows } from "@/modules/migration/queries";
import { sanitizeExcelCell } from "@/modules/siga/cartera/calculator";

function escapeCsv(val: string): string {
  const safe = sanitizeExcelCell(val);
  if (/[;"\n,]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/**
 * Exportador oficial de matrícula SIMAT (MEN Colombia) en `.xlsx` o `.csv`.
 * SEGURIDAD:
 * - Exclusivo `ADMIN` (`simat.export`).
 * - Neutraliza fórmulas (`sanitizeExcelCell`) contra CSV/Excel Formula Injection.
 * - Registra evento inmutable `SIMAT_EXPORTED` en `audit_logs` con IP y filtros.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("No autenticado.", { status: 401 });
  if (!can(session.user.role, "simat.export")) {
    return new NextResponse("Acceso restringido a Secretaría y Rectoría.", { status: 403 });
  }

  const context = await getCurrentAcademicContext();
  if (!context) return new NextResponse("No hay año lectivo vigente.", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const format = sp.get("formato") === "csv" ? "csv" : "xlsx";
  const rawLevel = sp.get("level")?.trim().toUpperCase() ?? "";
  const rawGroup = sp.get("group")?.trim() ?? "";

  const levelCode: LevelCode | null = LEVEL_CODES.includes(rawLevel as LevelCode)
    ? (rawLevel as LevelCode)
    : null;
  const groupName = rawGroup || null;

  const rows = await getSimatExportRows(context.year.id, { levelCode, groupName });
  const { ip } = await getRequestMeta();

  await recordAudit({
    actorUserId: session.user.id,
    action: "SIMAT_EXPORTED",
    entityType: "academic_year",
    entityId: context.year.id,
    after: {
      year: context.year.year,
      format,
      levelCode: levelCode ?? "ALL",
      groupName: groupName ?? "ALL",
      exportedCount: rows.length,
    },
    ipAddress: ip,
  });

  const safeSuffix = groupName
    ? `_${groupName.replace(/[^A-Za-z0-9_-]/g, "")}`
    : levelCode
      ? `_${levelCode}`
      : "";

  if (format === "csv") {
    const header = [
      "ANO_LECTIVO",
      "TIPO_DOCUMENTO",
      "NUMERO_DOCUMENTO",
      "APELLIDOS",
      "NOMBRES",
      "NIVEL",
      "GRADO",
      "GRUPO",
      "ESTADO_MATRICULA",
      "CORREO_ESTUDIANTE",
      "ACUDIENTE_RESPONSABLE",
      "DOC_ACUDIENTE",
      "TELEFONO_ACUDIENTE",
    ].join(";");

    const body = rows.map((r) =>
      [
        String(context.year.year),
        r.documentType,
        r.documentNumber,
        r.lastName,
        r.firstName,
        LEVEL_LABELS[r.levelCode],
        r.gradeName,
        r.groupName,
        r.status === "ACTIVE" ? "MATRICULADO" : r.status,
        r.email,
        r.guardianName,
        r.guardianDocument,
        r.guardianPhone,
      ]
        .map(escapeCsv)
        .join(";"),
    );

    const csv = `\uFEFF${header}\n${body.join("\n")}\n`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="SIMAT_Liceo_Lunita_${context.year.year}${safeSuffix}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Campus Digital · Liceo Lunita de Chía";
  wb.created = new Date();

  const sheet = wb.addWorksheet(`SIMAT ${context.year.year}`, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Año", key: "year", width: 8 },
    { header: "Tipo Doc", key: "docType", width: 10 },
    { header: "N° Documento", key: "docNum", width: 16 },
    { header: "Apellidos", key: "lastName", width: 22 },
    { header: "Nombres", key: "firstName", width: 22 },
    { header: "Nivel", key: "level", width: 14 },
    { header: "Grado", key: "grade", width: 14 },
    { header: "Grupo", key: "group", width: 10 },
    { header: "Estado SIMAT", key: "status", width: 15 },
    { header: "Correo Institucional", key: "email", width: 28 },
    { header: "Acudiente", key: "guardian", width: 24 },
    { header: "Doc. Acudiente", key: "guardianDoc", width: 16 },
    { header: "Teléfono", key: "phone", width: 15 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1747" } };
  headerRow.height = 24;

  for (const r of rows) {
    sheet.addRow({
      year: context.year.year,
      docType: sanitizeExcelCell(r.documentType),
      docNum: sanitizeExcelCell(r.documentNumber),
      lastName: sanitizeExcelCell(r.lastName),
      firstName: sanitizeExcelCell(r.firstName),
      level: LEVEL_LABELS[r.levelCode],
      grade: sanitizeExcelCell(r.gradeName),
      group: sanitizeExcelCell(r.groupName),
      status: r.status === "ACTIVE" ? "MATRICULADO" : r.status,
      email: sanitizeExcelCell(r.email),
      guardian: sanitizeExcelCell(r.guardianName),
      guardianDoc: sanitizeExcelCell(r.guardianDocument),
      phone: sanitizeExcelCell(r.guardianPhone),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SIMAT_Liceo_Lunita_${context.year.year}${safeSuffix}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
