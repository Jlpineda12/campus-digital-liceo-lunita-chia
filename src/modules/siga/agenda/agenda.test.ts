import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPublishCircular,
  canPublishInstitutional,
  matchesCircularAudience,
  sanitizeCircularText,
} from "./meta";
import { createCircularSchema } from "./schemas";

describe("Agenda y circulares: permisos y sanitización", () => {
  it("autoriza publicación institucional solo a Coordinación y Rectoría/Secretaría", () => {
    assert.equal(canPublishCircular("ADMIN"), true);
    assert.equal(canPublishCircular("COORDINATOR"), true);
    assert.equal(canPublishCircular("TEACHER"), true);
    assert.equal(canPublishCircular("GUARDIAN"), false);
    assert.equal(canPublishCircular("STUDENT"), false);

    assert.equal(canPublishInstitutional("ADMIN"), true);
    assert.equal(canPublishInstitutional("COORDINATOR"), true);
    assert.equal(canPublishInstitutional("TEACHER"), false);
  });

  it("elimina etiquetas HTML y caracteres de control preservando párrafos legibles", () => {
    const dirty = "  <script>alert(1)</script>Reunión general\r\n\r\n\r\n<b>Jueves 4:00 p. m.</b>\u0000  ";
    assert.equal(sanitizeCircularText(dirty), "alert(1)Reunión general\n\nJueves 4:00 p. m.");
  });

  it("restringe el acceso según alcance institucional, nivel, grado o grupo (anti-IDOR)", () => {
    const guardian = {
      userId: "u-guardian",
      role: "GUARDIAN" as const,
      levelIds: new Set(["lvl-primaria", "lvl-bach"]),
      gradeIds: new Set(["g-3", "g-7"]),
      groupIds: new Set(["grp-3a", "grp-7a"]),
    };

    assert.equal(
      matchesCircularAudience(
        { targetScope: "ALL", targetLevelId: null, targetGradeId: null, targetGroupId: null, authorId: "u-admin" },
        guardian,
      ),
      true,
    );
    assert.equal(
      matchesCircularAudience(
        { targetScope: "GROUP", targetLevelId: null, targetGradeId: null, targetGroupId: "grp-7a", authorId: "u-teacher" },
        guardian,
      ),
      true,
    );
    assert.equal(
      matchesCircularAudience(
        { targetScope: "GROUP", targetLevelId: null, targetGradeId: null, targetGroupId: "grp-11a", authorId: "u-teacher" },
        guardian,
      ),
      false,
    );
    assert.equal(
      matchesCircularAudience(
        { targetScope: "LEVEL", targetLevelId: "lvl-preescolar", targetGradeId: null, targetGroupId: null, authorId: "u-admin" },
        guardian,
      ),
      false,
    );
  });

  it("valida esquemas Zod exigiendo destinatario según el alcance", () => {
    const ok = createCircularSchema.safeParse({
      title: "Entrega de boletines",
      body: "Invitamos a las familias este viernes a las 7:00 a. m. en el auditorio principal.",
      targetScope: "ALL",
    });
    assert.equal(ok.success, true);

    const missingGroup = createCircularSchema.safeParse({
      title: "Salida pedagógica 7A",
      body: "Traer autorización firmada por acudiente antes del miércoles.",
      targetScope: "GROUP",
    });
    assert.equal(missingGroup.success, false);
  });
});
