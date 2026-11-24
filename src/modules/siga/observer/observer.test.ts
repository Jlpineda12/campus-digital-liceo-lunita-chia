import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canGuardianAcknowledge,
  canStudentAddStatement,
  getObserverWorkflowStatus,
  isObserverCategory,
  OBSERVER_CATEGORY_META,
} from "./meta";
import {
  createObserverSchema,
  guardianAcknowledgeSchema,
  studentStatementSchema,
} from "./schemas";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("Observador del estudiante: debido proceso", () => {
  it("reconoce solo las categorías oficiales del Manual de Convivencia", () => {
    assert.equal(isObserverCategory("PRAISE"), true);
    assert.equal(isObserverCategory("TYPE_III"), true);
    assert.equal(isObserverCategory("OTRA"), false);
  });

  it("habilita descargos solo en anotaciones de seguimiento/convivencia y una sola vez", () => {
    assert.equal(
      canStudentAddStatement({ category: "PRAISE", studentStatement: null, guardianAcknowledgedAt: null }),
      false,
    );
    assert.equal(
      canStudentAddStatement({ category: "TYPE_I", studentStatement: null, guardianAcknowledgedAt: null }),
      true,
    );
    assert.equal(
      canStudentAddStatement({
        category: "TYPE_I",
        studentStatement: "Me comprometo a entregar a tiempo.",
        guardianAcknowledgedAt: null,
      }),
      false,
    );
  });

  it("escala automáticamente situaciones Tipo II y Tipo III a Coordinación", () => {
    assert.equal(OBSERVER_CATEGORY_META.PRAISE.escalatesToCoordination, false);
    assert.equal(OBSERVER_CATEGORY_META.TYPE_I.escalatesToCoordination, false);
    assert.equal(OBSERVER_CATEGORY_META.TYPE_II.escalatesToCoordination, true);
    assert.equal(OBSERVER_CATEGORY_META.TYPE_III.escalatesToCoordination, true);
  });

  it("calcula el estado del flujo hasta el Enterado del acudiente", () => {
    assert.equal(
      getObserverWorkflowStatus({ category: "ACADEMIC", studentStatement: null, guardianAcknowledgedAt: null }),
      "PENDING_STATEMENT",
    );
    assert.equal(
      getObserverWorkflowStatus({
        category: "ACADEMIC",
        studentStatement: "Repasaré los talleres.",
        guardianAcknowledgedAt: null,
      }),
      "PENDING_GUARDIAN",
    );
    assert.equal(
      getObserverWorkflowStatus({ category: "PRAISE", studentStatement: null, guardianAcknowledgedAt: null }),
      "PENDING_GUARDIAN",
    );
    const ack = { category: "TYPE_I" as const, studentStatement: null, guardianAcknowledgedAt: new Date() };
    assert.equal(getObserverWorkflowStatus(ack), "ACKNOWLEDGED");
    assert.equal(canGuardianAcknowledge(ack), false);
  });
});

describe("Observador del estudiante: validaciones Zod", () => {
  it("acepta anotaciones individuales y grupales válidas", () => {
    const ok = createObserverSchema.safeParse({
      enrollmentIds: [UUID_1, UUID_2],
      category: "PRAISE",
      title: "Participación destacada en NASA Space Apps",
      description: "Presentaron un prototipo funcional con excelente trabajo en equipo.",
      commitment: "",
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.enrollmentIds.length, 2);
      assert.equal(ok.data.commitment, undefined);
    }
  });

  it("rechaza anotaciones sin estudiantes o con descripción demasiado corta", () => {
    assert.equal(
      createObserverSchema.safeParse({
        enrollmentIds: [],
        category: "ACADEMIC",
        title: "Seguimiento",
        description: "Corto",
      }).success,
      false,
    );
  });

  it("valida descargos del estudiante y comentario opcional del acudiente", () => {
    assert.equal(
      studentStatementSchema.safeParse({ recordId: UUID_1, statement: "Ok" }).success,
      false,
    );
    assert.equal(
      studentStatementSchema.safeParse({
        recordId: UUID_1,
        statement: "Reconozco el retraso y entregaré la actividad mañana.",
      }).success,
      true,
    );
    assert.equal(
      guardianAcknowledgeSchema.safeParse({ recordId: UUID_1, comment: "" }).success,
      true,
    );
  });
});
