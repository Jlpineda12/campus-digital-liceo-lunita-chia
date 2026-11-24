import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysBetween, getPeriodProgress, pickCurrentPeriod } from "./dates";

const periods = [
  { number: 1, startDate: "2026-01-26", endDate: "2026-04-03" },
  { number: 2, startDate: "2026-04-13", endDate: "2026-06-19" },
  { number: 3, startDate: "2026-07-06", endDate: "2026-09-11" },
  { number: 4, startDate: "2026-09-14", endDate: "2026-11-27" },
];

describe("Calendario escolar", () => {
  it("cuenta días entre fechas", () => {
    assert.equal(daysBetween("2026-11-23", "2026-11-27"), 4);
    assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  });

  it("elige el periodo que contiene la fecha", () => {
    assert.equal(pickCurrentPeriod(periods, "2026-11-23")?.number, 4);
    assert.equal(pickCurrentPeriod(periods, "2026-01-26")?.number, 1);
  });

  it("entre periodos (vacaciones) usa el último iniciado", () => {
    assert.equal(pickCurrentPeriod(periods, "2026-06-25")?.number, 2);
    assert.equal(pickCurrentPeriod(periods, "2026-12-15")?.number, 4);
  });

  it("antes del inicio del año usa el primero", () => {
    assert.equal(pickCurrentPeriod(periods, "2026-01-05")?.number, 1);
    assert.equal(pickCurrentPeriod([], "2026-01-05"), null);
  });

  it("calcula el avance del periodo", () => {
    const p4 = periods[3]!;
    assert.deepEqual(getPeriodProgress(p4, "2026-09-10"), { status: "upcoming", percent: 0, daysLeft: 78 });
    assert.equal(getPeriodProgress(p4, "2026-11-23").status, "active");
    assert.equal(getPeriodProgress(p4, "2026-11-23").daysLeft, 4);
    assert.deepEqual(getPeriodProgress(p4, "2026-12-01"), { status: "finished", percent: 100, daysLeft: 0 });
  });
});
