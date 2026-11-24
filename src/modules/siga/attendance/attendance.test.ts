import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAttendanceStats, daysBetweenIso, isIsoDateString } from "./meta";
import { reviewExcuseSchema, saveAttendanceRollSchema, submitExcuseSchema } from "./schemas";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("Asistencia: estadísticas y fechas", () => {
  it("calcula el porcentaje de asistencia cubierta correctamente", () => {
    assert.deepEqual(computeAttendanceStats({ present: 0, absent: 0, late: 0, excused: 0 }), {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      ratePercent: 100,
    });
    const stats = computeAttendanceStats({ present: 16, absent: 2, late: 1, excused: 1 });
    assert.equal(stats.total, 20);
    assert.equal(stats.ratePercent, 90);
  });

  it("valida fechas ISO reales y rechaza fechas inexistentes", () => {
    assert.equal(isIsoDateString("2026-11-23"), true);
    assert.equal(isIsoDateString("2026-02-29"), false);
    assert.equal(isIsoDateString("23-11-2026"), false);
    assert.equal(daysBetweenIso("2026-11-20", "2026-11-23"), 3);
  });
});

describe("Asistencia y Excusas: validaciones Zod", () => {
  it("acepta un llamado a lista válido", () => {
    const ok = saveAttendanceRollSchema.safeParse({
      courseAssignmentId: UUID_1,
      date: "2026-11-23",
      entries: [
        { enrollmentId: UUID_2, status: "PRESENT", notes: "" },
      ],
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.entries[0]?.notes, null);
  });

  it("rechaza excusas con fecha final anterior o rango mayor a 30 días", () => {
    assert.equal(
      submitExcuseSchema.safeParse({
        enrollmentId: UUID_1,
        fromDate: "2026-11-25",
        toDate: "2026-11-23",
        reasonType: "MEDICA",
        description: "Incapacidad por consulta odontológica.",
      }).success,
      false,
    );
    assert.equal(
      submitExcuseSchema.safeParse({
        enrollmentId: UUID_1,
        fromDate: "2026-10-01",
        toDate: "2026-11-15",
        reasonType: "MEDICA",
        description: "Incapacidad prolongada de más de 30 días.",
      }).success,
      false,
    );
  });

  it("exige motivo al rechazar una excusa pero permite aprobar sin nota", () => {
    assert.equal(
      reviewExcuseSchema.safeParse({ excuseId: UUID_1, decision: "APPROVED" }).success,
      true,
    );
    assert.equal(
      reviewExcuseSchema.safeParse({ excuseId: UUID_1, decision: "REJECTED" }).success,
      false,
    );
    assert.equal(
      reviewExcuseSchema.safeParse({
        excuseId: UUID_1,
        decision: "REJECTED",
        reviewNotes: "Falta adjuntar soporte médico oficial.",
      }).success,
      true,
    );
  });
});
