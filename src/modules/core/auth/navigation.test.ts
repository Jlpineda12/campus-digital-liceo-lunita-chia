import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DESTINATIONS,
  findActiveDestination,
  findActiveItem,
  getDestinations,
  getNavigation,
} from "./navigation";
import type { Role } from "./roles";

const ROLES: Role[] = ["STUDENT", "GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"];

describe("Navegación de 4 destinos", () => {
  for (const role of ROLES) {
    it(`${role}: máximo 4 destinos y cada módulo en exactamente uno`, () => {
      const defs = DESTINATIONS[role];
      assert.ok(defs.length <= 4, "más de 4 destinos");
      const placed = defs.flatMap((d) => d.items);
      assert.equal(new Set(placed).size, placed.length, "un módulo aparece en dos destinos");

      // Ninguna función actual se pierde: todo módulo del rol tiene destino.
      for (const item of getNavigation(role)) {
        assert.ok(placed.includes(item.key), `${item.key} sin destino para ${role}`);
      }
      // Y ningún destino ofrece un módulo que el rol no puede ver.
      const allowed = new Set(getNavigation(role).map((i) => i.key));
      for (const key of placed) assert.ok(allowed.has(key), `${key} no permitido para ${role}`);
    });
  }

  it("la ruta más específica gana (boletín final vs. boletines; insignias vs. cursos)", () => {
    const nav = getNavigation("STUDENT");
    assert.equal(findActiveItem(nav, "/siga/boletines/final")?.key, "finalReport");
    assert.equal(findActiveItem(nav, "/siga/boletines")?.key, "reportCards");
    assert.equal(findActiveItem(nav, "/aula/insignias")?.key, "badges");
    assert.equal(findActiveItem(nav, "/aula/tareas")?.key, "tasks");
    assert.equal(findActiveItem(nav, "/aula/abc-123/quiz/x")?.key, "courses");
    assert.equal(findActiveItem(nav, "/siga/calificacionesX"), null);
  });

  it("ubica el destino activo del estudiante", () => {
    const dests = getDestinations("STUDENT", getNavigation("STUDENT"));
    assert.equal(findActiveDestination(dests, "/aula/insignias")?.key, "progreso");
    assert.equal(findActiveDestination(dests, "/aula/abc-123")?.key, "clases");
    assert.equal(findActiveDestination(dests, "/dashboard")?.key, "inicio");
  });
});
