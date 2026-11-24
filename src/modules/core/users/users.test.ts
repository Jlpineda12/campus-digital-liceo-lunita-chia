import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateNewPassword } from "@/modules/core/auth/password-policy";
import {
  generateInstitutionalEmail,
  generateInstitutionalPassword,
  hasXlsxMagicBytes,
  parseCsvMatrix,
  parseRoleLabel,
  validateBulkMatrix,
} from "./bulk";
import {
  createGuardianLinkSchema,
  createUserSchema,
  normalizeDocumentNumber,
  validateAdminSafety,
} from "./schemas";

describe("Gestión de usuarios y roles: seguridad y validaciones", () => {
  it("normaliza números de documento quitando puntos, espacios y guiones", () => {
    assert.equal(normalizeDocumentNumber(" 1.070.000-001 "), "1070000001");
    assert.equal(normalizeDocumentNumber("ppt-98765"), "PPT98765");
  });

  it("impide auto-desactivación, auto-degradación y dejar el campus sin ADMIN activo", () => {
    assert.equal(
      validateAdminSafety({
        actorId: "admin-1",
        targetId: "admin-1",
        currentRole: "ADMIN",
        nextRole: "ADMIN",
        currentActive: true,
        nextActive: false,
        otherActiveAdminsCount: 2,
      }).ok,
      false,
    );

    assert.equal(
      validateAdminSafety({
        actorId: "admin-1",
        targetId: "admin-1",
        currentRole: "ADMIN",
        nextRole: "COORDINATOR",
        currentActive: true,
        nextActive: true,
        otherActiveAdminsCount: 2,
      }).ok,
      false,
    );

    assert.equal(
      validateAdminSafety({
        actorId: "admin-1",
        targetId: "admin-2",
        currentRole: "ADMIN",
        nextRole: "TEACHER",
        currentActive: true,
        nextActive: true,
        otherActiveAdminsCount: 0,
      }).ok,
      false,
    );

    assert.equal(
      validateAdminSafety({
        actorId: "admin-1",
        targetId: "admin-2",
        currentRole: "ADMIN",
        nextRole: "COORDINATOR",
        currentActive: true,
        nextActive: true,
        otherActiveAdminsCount: 1,
      }).ok,
      true,
    );
  });

  it("valida creación de cuenta y vínculos acudiente-estudiante", () => {
    const okUser = createUserSchema.safeParse({
      documentType: "TI",
      documentNumber: "1.070.999.888",
      firstName: "Camila",
      lastName: "Torres",
      email: "Camila.Torres@Campus.Lunita.TEST",
      phone: "310 555 0199",
      role: "STUDENT",
      password: "Clave-Temporal-2026!",
    });
    assert.equal(okUser.success, true);
    if (okUser.success) {
      assert.equal(okUser.data.documentNumber, "1070999888");
      assert.equal(okUser.data.email, "camila.torres@campus.lunita.test");
    }

    const okLink = createGuardianLinkSchema.safeParse({
      guardianId: "11111111-1111-4111-8111-111111111111",
      studentId: "22222222-2222-4222-8222-222222222222",
      relationship: "MADRE",
      isFinancialResponsible: true,
      canPickUp: true,
    });
    assert.equal(okLink.success, true);
  });

  it("genera credenciales personalizadas seguras (nombre + documento + colegio) y parsea CSV en español", () => {
    const used = new Set<string>();
    const email1 = generateInstitutionalEmail("Sofía María", "Ramírez Gómez", "1.070.124.568", used);
    const email2 = generateInstitutionalEmail("Sofía", "Ramírez", "1070124568", used);
    assert.equal(email1, "sofia.ramirez.568@campus.lunita.edu.co");
    assert.equal(email2, "sofia.ramirez.5682@campus.lunita.edu.co");

    const pwd = generateInstitutionalPassword("Camila", "Torres", "1070124568");
    assert.match(pwd, /^LLC-CT4568-[A-Z2-9]{2}$/);
    assert.deepEqual(
      validateNewPassword(pwd, {
        firstName: "Camila",
        lastName: "Torres",
        documentNumber: "1070124568",
        email: "camila.torres.568@campus.lunita.edu.co",
      }),
      [],
    );

    assert.equal(parseRoleLabel("Estudiante"), "STUDENT");
    assert.equal(parseRoleLabel("Profesor"), "TEACHER");
    assert.equal(parseRoleLabel("Secretaría"), "ADMIN");
    assert.equal(hasXlsxMagicBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
    assert.equal(hasXlsxMagicBytes(Buffer.from("not-an-xlsx")), false);

    const matrix = parseCsvMatrix(
      "\uFEFFRol;TipoDoc;Documento;Nombres;Apellidos;Grupo;DocumentoAcudiente;Parentesco\n" +
        "Acudiente;CC;52999001;Marta;Gómez;;;\n" +
        "Estudiante;TI;1070999001;Mateo;Gómez;7A;52999001;MADRE\n",
    );
    const parsed = validateBulkMatrix(matrix);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.valid.length, 2);
    assert.equal(parsed.valid[1]?.groupName, "7A");
    assert.equal(parsed.valid[1]?.guardianDocument, "52999001");
  });
});
