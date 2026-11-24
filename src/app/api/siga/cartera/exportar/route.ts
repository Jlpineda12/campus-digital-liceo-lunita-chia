import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { LEVEL_CODES, type LevelCode } from "@/modules/core/academic-structure/constants";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { recordAudit } from "@/modules/core/audit/service";
import { can } from "@/modules/core/auth/permissions";
import { getRequestMeta, getSession } from "@/modules/core/auth/session";
import { PAYMENT_CHANNEL_LABELS } from "@/modules/matriculas/catalog";
import { BILLING_MONTH_COLUMNS, sanitizeExcelCell } from "@/modules/siga/cartera/calculator";
import { getAdminBillingOverview } from "@/modules/siga/cartera/queries";

/**
 * Exportación segura de la Matriz Mensual de Cartera (Feb–Nov) + Recibos en Excel (.xlsx).
 * Admite filtros opcionales `?level=PREESCOLAR|PRIMARIA|BACHILLERATO` y `?group=<grupo>`.
 * SEGURIDAD:
 * - Exclusivo rol `ADMIN` (`billing.manage`). Bloquea a Coordinación, Docentes y Familias.
 * - Neutraliza fórmulas (`sanitizeExcelCell`) contra Excel Formula Injection.
 * - Registra evento inmutable `BILLING_EXPORTED` en `audit_logs` con usuario, IP y alcance.
 * - Encabezados `Cache-Control: private, no-store` para evitar caché en equipos compartidos.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("No autenticado.", { status: 401 });
  }
  if (!can(session.user.role, "billing.manage")) {
    return new NextResponse("Acceso restringido a Tesorería y Rectoría.", { status: 403 });
  }

  const context = await getCurrentAcademicContext();
  if (!context) {
    return new NextResponse("No hay año lectivo vigente.", { status: 404 });
  }

  const url = new URL(request.url);
  const rawLevel = url.searchParams.get("level")?.trim().toUpperCase() ?? "";
  const rawGroup = url.searchParams.get("group")?.trim() ?? "";

  const levelFilter: LevelCode | null = LEVEL_CODES.includes(rawLevel as LevelCode)
    ? (rawLevel as LevelCode)
    : null;

  const data = await getAdminBillingOverview(context.year.id);
  const groupFilter =
    rawGroup && data.groupsList.includes(rawGroup) ? rawGroup : null;

  const scopedAccounts = data.accounts.filter((acc) => {
    if (levelFilter && acc.levelCode !== levelFilter) return false;
    if (groupFilter && acc.groupName !== groupFilter) return false;
    return true;
  });

  const scopedReceipts = data.ledgerReceipts.filter((r) => {
    if (levelFilter && r.levelCode !== levelFilter) return false;
    if (groupFilter && r.groupName !== groupFilter) return false;
    return true;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Campus Digital · Liceo Lunita de Chía";
  workbook.created = new Date();

  // Hoja 1: Matriz Mensual Feb–Nov (reemplaza el mega Excel manual)
  const matrixSheet = workbook.addWorksheet(`Matriz Cartera ${context.year.year}`, {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  matrixSheet.columns = [
    { header: "Estudiante", key: "student", width: 28 },
    { header: "Grupo", key: "group", width: 10 },
    { header: "Grado", key: "grade", width: 14 },
    { header: "Documento", key: "doc", width: 15 },
    ...BILLING_MONTH_COLUMNS.map((m) => ({
      header: m.shortLabel,
      key: `m_${m.month}`,
      width: 15,
    })),
    { header: "Total Neto (COP)", key: "net", width: 17 },
    { header: "Pagado (COP)", key: "paid", width: 17 },
    { header: "Saldo (COP)", key: "pending", width: 17 },
    { header: "Estado", key: "state", width: 14 },
  ];

  const headerRow = matrixSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF303296" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 26;

  let sumNet = 0;
  let sumPaid = 0;
  let sumPending = 0;

  for (const acc of scopedAccounts) {
    const byMonth = new Map(acc.charges.map((c) => [c.billingMonth, c]));
    sumNet += acc.totalNetCop;
    sumPaid += acc.totalPaidCop;
    sumPending += acc.totalPendingCop;

    const rowData: Record<string, string | number> = {
      student: sanitizeExcelCell(acc.studentName),
      group: sanitizeExcelCell(acc.groupName),
      grade: sanitizeExcelCell(acc.gradeName),
      doc: sanitizeExcelCell(acc.documentNumber),
      net: acc.totalNetCop,
      paid: acc.totalPaidCop,
      pending: acc.totalPendingCop,
      state: acc.isClear ? "AL DÍA" : acc.overdueCount > 0 ? `MORA (${acc.overdueCount})` : "PENDIENTE",
    };

    for (const m of BILLING_MONTH_COLUMNS) {
      const ch = byMonth.get(m.month);
      if (!ch) {
        rowData[`m_${m.month}`] = "—";
      } else if (ch.status === "PAID") {
        rowData[`m_${m.month}`] = "PAGADO";
      } else if (ch.status === "WAIVED") {
        rowData[`m_${m.month}`] = "EXONERADO";
      } else if (ch.status === "OVERDUE") {
        rowData[`m_${m.month}`] = `MORA ($${ch.pendingCop.toLocaleString("es-CO")})`;
      } else if (ch.status === "PARTIAL") {
        rowData[`m_${m.month}`] = `ABONO ($${ch.pendingCop.toLocaleString("es-CO")})`;
      } else {
        rowData[`m_${m.month}`] = `PEND ($${ch.pendingCop.toLocaleString("es-CO")})`;
      }
    }

    const row = matrixSheet.addRow(rowData);
    for (const colKey of ["net", "paid", "pending"]) {
      row.getCell(colKey).numFmt = "$#,##0";
    }
  }

  // Fila de totales al final de la matriz
  const totalsRow = matrixSheet.addRow({
    student: `TOTAL (${scopedAccounts.length} estudiantes)`,
    group: groupFilter ?? (levelFilter ?? "TODOS"),
    grade: "",
    doc: "",
    net: sumNet,
    paid: sumPaid,
    pending: sumPending,
    state: sumNet > 0 ? `${Math.round((sumPaid / sumNet) * 100)}% recaudado` : "100%",
  });
  totalsRow.font = { bold: true, color: { argb: "FF0F1747" }, size: 10 };
  totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF1F8" } };
  for (const colKey of ["net", "paid", "pending"]) {
    totalsRow.getCell(colKey).numFmt = "$#,##0";
  }

  // Hoja 2: Libro de Recibos y Recaudo
  const receiptsSheet = workbook.addWorksheet("Recibos y Recaudo", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  receiptsSheet.columns = [
    { header: "N° Recibo", key: "receipt", width: 18 },
    { header: "Fecha", key: "date", width: 18 },
    { header: "Estudiante", key: "student", width: 28 },
    { header: "Grupo", key: "group", width: 10 },
    { header: "Concepto", key: "concept", width: 24 },
    { header: "Canal", key: "channel", width: 22 },
    { header: "Referencia", key: "ref", width: 18 },
    { header: "Valor COP", key: "amount", width: 16 },
  ];
  const recHeader = receiptsSheet.getRow(1);
  recHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  recHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1747" } };
  recHeader.height = 24;

  for (const r of scopedReceipts) {
    const row = receiptsSheet.addRow({
      receipt: sanitizeExcelCell(r.receiptNumber),
      date: r.paidAt.toISOString().slice(0, 10),
      student: sanitizeExcelCell(r.studentName),
      group: sanitizeExcelCell(r.groupName),
      concept: sanitizeExcelCell(r.concept),
      channel: PAYMENT_CHANNEL_LABELS[r.channel],
      ref: sanitizeExcelCell(r.referenceCode),
      amount: r.amountCop,
    });
    row.getCell("amount").numFmt = "$#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const { ip } = await getRequestMeta();

  await recordAudit({
    actorUserId: session.user.id,
    action: "BILLING_EXPORTED",
    entityType: "academic_year",
    entityId: context.year.id,
    after: {
      year: context.year.year,
      levelFilter: levelFilter ?? "ALL",
      groupFilter: groupFilter ?? "ALL",
      accountsExported: scopedAccounts.length,
      receiptsExported: scopedReceipts.length,
    },
    ipAddress: ip,
  });

  const safeSuffix = groupFilter
    ? `_Curso_${groupFilter.replace(/[^A-Za-z0-9_-]/g, "")}`
    : levelFilter
      ? `_${levelFilter}`
      : "";

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Cartera_Liceo_Lunita_${context.year.year}${safeSuffix}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
