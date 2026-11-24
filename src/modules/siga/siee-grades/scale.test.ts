import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeScale, getPerformanceLevel, roundScore } from "./scale";

describe("Escala SIEE (Decreto 1290)", () => {
  it("clasifica los límites institucionales", () => {
    assert.equal(getPerformanceLevel(5.0), "SUPERIOR");
    assert.equal(getPerformanceLevel(4.6), "SUPERIOR");
    assert.equal(getPerformanceLevel(4.5), "ALTO");
    assert.equal(getPerformanceLevel(4.0), "ALTO");
    assert.equal(getPerformanceLevel(3.9), "BASICO");
    assert.equal(getPerformanceLevel(3.5), "BASICO");
    assert.equal(getPerformanceLevel(3.4), "BAJO");
    assert.equal(getPerformanceLevel(1.0), "BAJO");
  });

  it("redondea a un decimal antes de clasificar (sin huecos entre rangos)", () => {
    assert.equal(roundScore(4.55), 4.6);
    assert.equal(getPerformanceLevel(4.55), "SUPERIOR");
    assert.equal(getPerformanceLevel(3.45), "BASICO");
    assert.equal(getPerformanceLevel(3.44), "BAJO");
  });

  it("respeta la nota mínima aprobatoria configurada por año", () => {
    const scale = { superiorFrom: 4.6, altoFrom: 4.0, minPassing: 3.0 };
    assert.equal(getPerformanceLevel(3.2, scale), "BASICO");
    assert.equal(getPerformanceLevel(2.9, scale), "BAJO");
  });

  it("rechaza notas fuera de 1.0 – 5.0", () => {
    assert.throws(() => getPerformanceLevel(0.9), RangeError);
    assert.throws(() => getPerformanceLevel(5.1), RangeError);
    assert.throws(() => getPerformanceLevel(Number.NaN), RangeError);
  });

  it("describe los rangos de la escala", () => {
    assert.deepEqual(
      describeScale().map((r) => `${r.level}:${r.from}-${r.to}`),
      ["SUPERIOR:4.6-5.0", "ALTO:4.0-4.5", "BASICO:3.5-3.9", "BAJO:1.0-3.4"],
    );
  });
});
