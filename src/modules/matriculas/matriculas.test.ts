import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMISSION_DOCUMENTS,
  calculateAdmissionFees,
  generateTrackingCode,
} from "./catalog";
import {
  BILLING_MONTH_COLUMNS,
  computeNetAmount,
  computePendingAmount,
  deriveChargeStatus,
  sanitizeExcelCell,
  summarizeAccount,
} from "@/modules/siga/cartera/calculator";

describe("Fase 4 · Matrículas 2027: calculadora de costos y bitácora de 8 documentos", () => {
  it("define exactamente los 8 documentos oficiales de admisión sin claves duplicadas", () => {
    assert.equal(ADMISSION_DOCUMENTS.length, 8);
    assert.equal(new Set(ADMISSION_DOCUMENTS.map((d) => d.key)).size, 8);
  });

  it("calcula costos y descuentos transparentes por nivel (Pronto Pago 10% + Hermanos 8%)", () => {
    const pre = calculateAdmissionFees({ levelCode: "PREESCOLAR" });
    assert.equal(pre.enrollmentFinal, 780_000);
    assert.equal(pre.monthlyFinal, 560_000);

    const bach = calculateAdmissionFees({
      levelCode: "BACHILLERATO",
      hasEarlyBirdDiscount: true,
      hasSiblingDiscount: true,
    });
    assert.equal(bach.enrollmentDiscount, 94_000);
    assert.equal(bach.enrollmentFinal, 846_000);
    assert.equal(bach.monthlyDiscount, 55_200);
    assert.equal(bach.monthlyFinal, 634_800);
  });

  it("genera códigos de radicado con formato institucional ADM-YYYY-XXXXXX", () => {
    const code = generateTrackingCode(2027);
    assert.match(code, /^ADM-2027-[A-Z2-9]{6}$/);
  });
});

describe("Fase 4 · Cartera escolar: saldos, mora y Paz y Salvo", () => {
  it("calcula valores netos, pendientes y deriva estados correctamente", () => {
    assert.equal(computeNetAmount(620_000, 50_000), 570_000);
    assert.equal(computePendingAmount({ amountCop: 620_000, discountCop: 20_000, paidCop: 200_000 }), 400_000);
    assert.equal(
      deriveChargeStatus({ amountCop: 500_000, discountCop: 0, paidCop: 500_000, dueDate: "2026-03-10" }, "2026-11-24"),
      "PAID",
    );
    assert.equal(
      deriveChargeStatus({ amountCop: 500_000, discountCop: 0, paidCop: 0, dueDate: "2026-10-10" }, "2026-11-24"),
      "OVERDUE",
    );
    assert.equal(
      deriveChargeStatus({ amountCop: 500_000, discountCop: 0, paidCop: 100_000, dueDate: "2026-12-10" }, "2026-11-24"),
      "PARTIAL",
    );
  });

  it("habilita Paz y Salvo únicamente cuando el saldo total es 0 y existen cobros", () => {
    const clear = summarizeAccount(
      [
        { amountCop: 860_000, discountCop: 0, paidCop: 860_000, dueDate: "2026-01-25" },
        { amountCop: 620_000, discountCop: 0, paidCop: 620_000, dueDate: "2026-02-10" },
      ],
      "2026-11-24",
    );
    assert.equal(clear.isClear, true);
    assert.equal(clear.totalPendingCop, 0);

    const debt = summarizeAccount(
      [
        { amountCop: 860_000, discountCop: 0, paidCop: 860_000, dueDate: "2026-01-25" },
        { amountCop: 620_000, discountCop: 0, paidCop: 0, dueDate: "2026-10-10" },
      ],
      "2026-11-24",
    );
    assert.equal(debt.isClear, false);
    assert.equal(debt.overdueCount, 1);
    assert.equal(debt.totalPendingCop, 620_000);
  });

  it("cubre Matrícula + 10 meses exactos (Febrero a Noviembre) y neutraliza fórmulas Excel peligrosas", () => {
    assert.equal(BILLING_MONTH_COLUMNS.length, 11);
    assert.equal(BILLING_MONTH_COLUMNS[0]?.month, 0);
    assert.equal(BILLING_MONTH_COLUMNS[1]?.month, 2);
    assert.equal(BILLING_MONTH_COLUMNS.at(-1)?.month, 11);

    assert.equal(sanitizeExcelCell("=CMD|' /C calc'!A0"), "'=CMD|' /C calc'!A0");
    assert.equal(sanitizeExcelCell("+SUM(A1:A5)"), "'+SUM(A1:A5)");
    assert.equal(sanitizeExcelCell("-2+3"), "'-2+3");
    assert.equal(sanitizeExcelCell("@IMPORTXML()"), "'@IMPORTXML()");
    assert.equal(sanitizeExcelCell("Sofía Ramírez"), "Sofía Ramírez");
  });
});
