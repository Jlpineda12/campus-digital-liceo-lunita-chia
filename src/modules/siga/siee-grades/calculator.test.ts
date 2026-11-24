import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeAnnualFinal,
  computeStudentPeriod,
  parseScoreInput,
  remainingWeight,
  weightedAverage,
  type CalcDimension,
} from "./calculator";
import { getPeriodEditState } from "./lock";

const dims: CalcDimension[] = [
  { competencyId: "saber", dimension: "SABER", weightPercent: 40, columns: [{ id: "q1", weightPercent: 50 }, { id: "q2", weightPercent: 50 }] },
  { competencyId: "hacer", dimension: "HACER", weightPercent: 40, columns: [{ id: "t1", weightPercent: 100 }] },
  { competencyId: "ser", dimension: "SER", weightPercent: 20, columns: [{ id: "a1", weightPercent: 100 }] },
];

describe("Motor SIEE", () => {
  it("pondera columnas dentro de la dimensión y dimensiones entre sí", () => {
    const scores: Record<string, number> = { q1: 4.0, q2: 5.0, t1: 3.0, a1: 5.0 };
    const r = computeStudentPeriod(dims, (id) => scores[id]);
    assert.equal(r.byDimension.saber, 4.5);
    // 4.5·40 + 3.0·40 + 5.0·20 = 400 → 4.0
    assert.equal(r.final, 4.0);
    assert.equal(r.level, "ALTO");
    assert.equal(r.gradedColumns, 4);
  });

  it("con notas faltantes calcula el promedio parcial sobre lo registrado", () => {
    const r = computeStudentPeriod(dims, (id) => ({ q1: 3.0, t1: 4.0 })[id]);
    assert.equal(r.byDimension.saber, 3.0);
    assert.equal(r.byDimension.ser, null);
    // (3.0·40 + 4.0·40) / 80 = 3.5
    assert.equal(r.final, 3.5);
    assert.equal(r.level, "BASICO");
    assert.equal(r.gradedColumns, 2);
    assert.equal(r.totalColumns, 4);
  });

  it("sin notas no hay definitiva", () => {
    const r = computeStudentPeriod(dims, () => null);
    assert.equal(r.final, null);
    assert.equal(r.level, null);
  });

  it("redondea la definitiva a un decimal antes de clasificar", () => {
    const r = computeStudentPeriod(
      [{ competencyId: "s", dimension: "SABER", weightPercent: 100, columns: [{ id: "x", weightPercent: 50 }, { id: "y", weightPercent: 50 }] }],
      (id) => ({ x: 4.5, y: 4.6 })[id],
    );
    assert.equal(r.final, 4.6);
    assert.equal(r.level, "SUPERIOR");
  });

  it("la definitiva anual pondera los periodos con nota", () => {
    assert.equal(
      computeAnnualFinal([
        { weightPercent: 25, final: 4.0 },
        { weightPercent: 25, final: 3.0 },
        { weightPercent: 25, final: null },
        { weightPercent: 25, final: 5.0 },
      ]),
      4.0,
    );
  });

  it("calcula el peso disponible de una dimensión", () => {
    assert.equal(remainingWeight([{ weightPercent: 30 }, { weightPercent: 45.5 }]), 24.5);
    assert.equal(remainingWeight([{ weightPercent: 100 }]), 0);
    assert.equal(weightedAverage([]), null);
  });
});

describe("Celdas de la planilla", () => {
  it("acepta coma o punto y vacío para borrar", () => {
    assert.deepEqual(parseScoreInput("4,5"), { ok: true, value: 4.5 });
    assert.deepEqual(parseScoreInput(" 3.0 "), { ok: true, value: 3 });
    assert.deepEqual(parseScoreInput(""), { ok: true, value: null });
  });

  it("rechaza fuera de rango o con más de un decimal", () => {
    for (const bad of ["0.9", "5.1", "4.55", "45", "abc", "-1"]) {
      assert.equal(parseScoreInput(bad).ok, false, bad);
    }
  });
});

describe("Candado de periodos", () => {
  const now = new Date("2026-11-20T15:00:00Z");
  const window = (over: Partial<{ courseAssignmentId: string | null; expiresAt: Date; closedAt: Date | null }>) => ({
    id: "w",
    courseAssignmentId: null,
    opensAt: new Date("2026-11-20T00:00:00Z"),
    expiresAt: new Date("2026-11-21T00:00:00Z"),
    closedAt: null,
    ...over,
  });

  it("un periodo abierto se puede editar", () => {
    assert.equal(getPeriodEditState({ gradesLocked: false }, [], "c1", now).editable, true);
  });

  it("un periodo cerrado sin ventana es de solo lectura", () => {
    assert.equal(getPeriodEditState({ gradesLocked: true }, [], "c1", now).editable, false);
  });

  it("una ventana vigente habilita la edición (general o de la carga)", () => {
    assert.equal(getPeriodEditState({ gradesLocked: true }, [window({})], "c1", now).via, "window");
    assert.equal(
      getPeriodEditState({ gradesLocked: true }, [window({ courseAssignmentId: "c1" })], "c1", now).editable,
      true,
    );
  });

  it("no aplican ventanas vencidas, cerradas o de otra carga", () => {
    for (const w of [
      window({ expiresAt: new Date("2026-11-20T10:00:00Z") }),
      window({ closedAt: new Date("2026-11-20T12:00:00Z") }),
      window({ courseAssignmentId: "otra" }),
    ]) {
      assert.equal(getPeriodEditState({ gradesLocked: true }, [w], "c1", now).editable, false);
    }
  });
});
