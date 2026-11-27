import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SIEE_SCALE } from "@/modules/siga/siee-grades/scale";
import { buildAnnualSummary, type AnnualPeriodInput, type PeriodSubjectFinal } from "./annual-summary";

const P = (n: number, included = true): AnnualPeriodInput => ({
  id: `p${n}`,
  number: n,
  name: `Periodo ${n}`,
  weightPercent: 25,
  included,
});
const math = (final: number | null): PeriodSubjectFinal => ({
  courseAssignmentId: "ca-mat",
  subjectName: "Matemáticas",
  pillar: "M",
  final,
});
const art = (final: number | null): PeriodSubjectFinal => ({
  courseAssignmentId: "ca-art",
  subjectName: "Artes",
  pillar: "A",
  final,
});

describe("Boletín final del año", () => {
  it("pondera los cuatro periodos y clasifica el desempeño", () => {
    const summary = buildAnnualSummary(
      [P(1), P(2), P(3), P(4)],
      new Map([
        ["p1", [math(4.0), art(3.0)]],
        ["p2", [math(4.2), art(3.2)]],
        ["p3", [math(4.4), art(3.0)]],
        ["p4", [math(4.6), art(3.2)]],
      ]),
      DEFAULT_SIEE_SCALE,
    );
    const mat = summary.subjects.find((s) => s.subjectName === "Matemáticas")!;
    assert.equal(mat.annual, 4.3);
    assert.equal(mat.level, "ALTO");
    assert.deepEqual(summary.lowSubjects, ["Artes"]);
    assert.equal(summary.isPartial, false);
    // Orden alfabético para lectura estable.
    assert.deepEqual(summary.subjects.map((s) => s.subjectName), ["Artes", "Matemáticas"]);
  });

  it("es parcial y no usa periodos sin habilitar por Rectoría", () => {
    const summary = buildAnnualSummary(
      [P(1), P(2), P(3, false), P(4, false)],
      new Map([
        ["p1", [math(3.0)]],
        ["p2", [math(4.0)]],
        ["p3", [math(5.0)]],
      ]),
      DEFAULT_SIEE_SCALE,
    );
    assert.equal(summary.isPartial, true);
    assert.equal(summary.includedCount, 2);
    assert.deepEqual(summary.subjects[0]!.finals, [3.0, 4.0, null, null]);
    assert.equal(summary.subjects[0]!.annual, 3.5);
  });

  it("sin notas no inventa definitivas", () => {
    const summary = buildAnnualSummary([P(1)], new Map([["p1", [math(null)]]]), DEFAULT_SIEE_SCALE);
    assert.equal(summary.subjects[0]!.annual, null);
    assert.equal(summary.overallAverage, null);
    assert.deepEqual(summary.lowSubjects, []);
  });
});
