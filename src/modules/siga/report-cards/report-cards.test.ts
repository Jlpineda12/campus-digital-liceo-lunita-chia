import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canFamilyViewReportCard,
  formatVerificationCode,
  isValidVerificationCode,
  maskDocumentNumber,
  maskStudentName,
} from "./verification";

describe("Boletines y verificación pública QR (Ley 1581)", () => {
  it("enmascara el nombre de un menor a iniciales para no exponer identidad completa", () => {
    assert.equal(maskStudentName("Sofía", "Ramírez Castro"), "S. R. C.");
    assert.equal(maskStudentName("  Tomás ", "Ramírez"), "T. R.");
  });

  it("enmascara el documento mostrando solo los últimos 4 dígitos", () => {
    assert.equal(maskDocumentNumber("1070000001"), "***0001");
    assert.equal(maskDocumentNumber("1234"), "***");
  });

  it("genera y valida códigos de verificación con formato institucional", () => {
    const code = formatVerificationCode(2026, 3, "a1b2c3d4e5f6");
    assert.equal(code, "LUN-2026-P3-A1B2C3D4E5F6");
    assert.equal(isValidVerificationCode(code), true);
    assert.equal(isValidVerificationCode("bad/code"), false);
    assert.equal(isValidVerificationCode("short"), false);
  });

  it("bloquea la consulta a familias hasta que Rectoría habilite oficialmente el boletín", () => {
    assert.equal(canFamilyViewReportCard(null), false);
    assert.equal(canFamilyViewReportCard({ issuedAt: null }), false);
    assert.equal(canFamilyViewReportCard({ issuedAt: new Date() }), true);
  });
});
