import type { BillingChargeStatus } from "@/db/schema/matriculas";

/**
 * Motor puro de cartera escolar (cálculo de saldos, mora, matriz mensual Feb–Nov,
 * protección anti-formula-injection para Excel y elegibilidad de Paz y Salvo).
 */

export interface ChargeBalanceInput {
  amountCop: number;
  discountCop: number;
  paidCop: number;
  dueDate: string; // YYYY-MM-DD
  status?: BillingChargeStatus;
}

export const BILLING_MONTH_COLUMNS = [
  { month: 0, shortLabel: "Mat.", label: "Matrícula anual" },
  { month: 2, shortLabel: "Feb", label: "Febrero" },
  { month: 3, shortLabel: "Mar", label: "Marzo" },
  { month: 4, shortLabel: "Abr", label: "Abril" },
  { month: 5, shortLabel: "May", label: "Mayo" },
  { month: 6, shortLabel: "Jun", label: "Junio" },
  { month: 7, shortLabel: "Jul", label: "Julio" },
  { month: 8, shortLabel: "Ago", label: "Agosto" },
  { month: 9, shortLabel: "Sep", label: "Septiembre" },
  { month: 10, shortLabel: "Oct", label: "Octubre" },
  { month: 11, shortLabel: "Nov", label: "Noviembre" },
] as const;

export const SCHOOL_MONTH_LABELS: Record<number, string> = {
  0: "Matrícula anual",
  2: "Pensión Febrero",
  3: "Pensión Marzo",
  4: "Pensión Abril",
  5: "Pensión Mayo",
  6: "Pensión Junio",
  7: "Pensión Julio",
  8: "Pensión Agosto",
  9: "Pensión Septiembre",
  10: "Pensión Octubre",
  11: "Pensión Noviembre",
};

export function computeNetAmount(amountCop: number, discountCop: number): number {
  return Math.max(0, Math.round(amountCop) - Math.max(0, Math.round(discountCop)));
}

export function computePendingAmount(
  charge: Pick<ChargeBalanceInput, "amountCop" | "discountCop" | "paidCop" | "status">,
): number {
  if (charge.status === "WAIVED") return 0;
  const net = computeNetAmount(charge.amountCop, charge.discountCop);
  return Math.max(0, net - Math.max(0, Math.round(charge.paidCop)));
}

export function deriveChargeStatus(charge: ChargeBalanceInput, todayIso: string): BillingChargeStatus {
  if (charge.status === "WAIVED") return "WAIVED";
  const net = computeNetAmount(charge.amountCop, charge.discountCop);
  const paid = Math.max(0, Math.round(charge.paidCop));
  if (paid >= net) return "PAID";
  if (charge.dueDate < todayIso) return "OVERDUE";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}

export function summarizeAccount(charges: ChargeBalanceInput[], todayIso: string): {
  totalNetCop: number;
  totalPaidCop: number;
  totalPendingCop: number;
  overdueCount: number;
  isClear: boolean;
} {
  let totalNetCop = 0;
  let totalPaidCop = 0;
  let totalPendingCop = 0;
  let overdueCount = 0;

  for (const c of charges) {
    if (c.status === "WAIVED") continue;
    const net = computeNetAmount(c.amountCop, c.discountCop);
    const paid = Math.min(net, Math.max(0, Math.round(c.paidCop)));
    const pending = Math.max(0, net - paid);
    totalNetCop += net;
    totalPaidCop += paid;
    totalPendingCop += pending;
    if (pending > 0 && c.dueDate < todayIso) overdueCount++;
  }

  return {
    totalNetCop,
    totalPaidCop,
    totalPendingCop,
    overdueCount,
    isClear: charges.length > 0 && totalPendingCop === 0,
  };
}

/**
 * Neutraliza posibles fórmulas de Excel (`=`, `+`, `-`, `@`, `\t`, `\r`) al exportar
 * textos ingresados por usuarios para prevenir ataques de CSV/Excel Formula Injection.
 */
export function sanitizeExcelCell(raw: string): string {
  const clean = raw.replace(/[\r\n]+/g, " ").trim();
  if (/^[=+\-@\t]/.test(clean)) {
    return `'${clean}`;
  }
  return clean;
}
