import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, permissionsFor, type Permission } from "./permissions";

/** Matriz de docs/secciones/05 §1: [permiso, COORDINATOR, ADMIN]. */
const STAFF_MATRIX: Array<[Permission, boolean, boolean]> = [
  ["dashboard.executive", true, true],
  ["attendance.excuses.review", true, true],
  ["observer.review", true, true],
  ["periods.unlock", true, true],
  ["structure.edit.academic", true, true],
  ["structure.manage", false, true],
  ["reportCards.preview", true, true],
  ["reportCards.issue", false, true],
  ["reportCards.billingLock", false, true],
  ["enrollment.approve.academic", true, true],
  ["enrollment.formalize", false, true],
  ["users.read", true, true],
  ["users.manage", false, true],
  ["sessions.revoke", false, true],
  ["billing.manage", false, true],
  ["audit.read.academic", true, true],
  ["audit.read.all", false, true],
  ["migration.run", false, true],
  ["simat.export", false, true],
];

describe("Matriz de permisos (sección 05)", () => {
  for (const [permission, coordinator, admin] of STAFF_MATRIX) {
    it(`${permission}: Coordinación ${coordinator ? "sí" : "no"}, Secretaría/Rectoría ${admin ? "sí" : "no"}`, () => {
      assert.equal(can("COORDINATOR", permission), coordinator);
      assert.equal(can("ADMIN", permission), admin);
    });
  }

  it("docentes, familias y estudiantes no tienen permisos administrativos", () => {
    for (const role of ["TEACHER", "GUARDIAN", "STUDENT"] as const) {
      for (const [permission] of STAFF_MATRIX) {
        assert.equal(can(role, permission), false, `${role} · ${permission}`);
      }
    }
  });

  it("el acudiente confirma el observador pero no puede entregar tareas del hijo", () => {
    assert.equal(can("GUARDIAN", "observer.acknowledge"), true);
    assert.equal(can("GUARDIAN", "aula.submit"), false);
    assert.equal(can("STUDENT", "aula.submit"), true);
  });

  it("solo docentes califican y toman asistencia de sus cursos", () => {
    assert.deepEqual(
      (["STUDENT", "GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"] as const).filter((r) =>
        can(r, "grades.edit.ownCourses"),
      ),
      ["TEACHER"],
    );
    assert.ok(permissionsFor("TEACHER").includes("attendance.take"));
  });
});
