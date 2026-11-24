import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countFilledLogros, getSuggestedLogro, parseLogroLines } from "./logros";

describe("Logros por asignatura y periodo (Boletín SIEE)", () => {
  it("limpia viñetas y saltos vacíos al separar múltiples logros", () => {
    const lines = parseLogroLines("• Resuelve ecuaciones lineales.\n- Modela problemas cotidianos.\n\n1. Sustenta sus procesos.");
    assert.deepEqual(lines, [
      "Resuelve ecuaciones lineales.",
      "Modela problemas cotidianos.",
      "Sustenta sus procesos.",
    ]);
  });

  it("cuenta correctamente las dimensiones diligenciadas", () => {
    assert.deepEqual(
      countFilledLogros([
        { description: "Comprende fracciones." },
        { description: "   " },
        { description: "Trabaja en equipo." },
      ]),
      { filled: 2, total: 3 },
    );
  });

  it("ofrece plantillas pedagógicas STHEAMI por pilar y dimensión", () => {
    const text = getSuggestedLogro("T", "HACER");
    assert.ok(text.length > 25);
  });
});
