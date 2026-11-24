import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNavigation } from "./navigation";
import { hashPassword, verifyPassword } from "./password";
import { resolvePostLoginPath, safeRedirectPath } from "./redirects";
import { isLoginRoleParam, LOGIN_ROLE_PARAMS } from "./roles";
import { normalizeIdentifier } from "./schemas";

describe("Contraseñas (scrypt)", () => {
  it("verifica la contraseña correcta y rechaza otra", async () => {
    const hash = await hashPassword("Clave-Segura-2026");
    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.equal(await verifyPassword("Clave-Segura-2026", hash), true);
    assert.equal(await verifyPassword("clave-segura-2026", hash), false);
  });

  it("genera sales distintas para la misma contraseña", async () => {
    assert.notEqual(await hashPassword("igual"), await hashPassword("igual"));
  });

  it("rechaza hashes con formato inválido", async () => {
    assert.equal(await verifyPassword("x", "texto-plano"), false);
    assert.equal(await verifyPassword("x", "scrypt$a$b$c$d$e"), false);
  });
});

describe("Redirecciones seguras tras el login", () => {
  it("acepta rutas internas", () => {
    assert.equal(safeRedirectPath("/dashboard"), "/dashboard");
    assert.equal(safeRedirectPath("/siga/boletines?periodo=2"), "/siga/boletines?periodo=2");
  });

  it("bloquea redirecciones abiertas y bucles", () => {
    for (const evil of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", "/login", "/api/x", ""]) {
      assert.equal(safeRedirectPath(evil), null, evil);
    }
    assert.equal(safeRedirectPath(undefined), null);
  });

  it("usa el módulo como destino cuando no hay `next`", () => {
    assert.equal(resolvePostLoginPath({ modulo: "aula" }), "/dashboard");
    assert.equal(resolvePostLoginPath({ next: "//evil.com", modulo: "siga" }), "/siga/calificaciones");
    assert.equal(resolvePostLoginPath({ next: "/aula/tareas" }), "/aula/tareas");
  });
});

describe("Contrato de /login con el sitio Astro", () => {
  it("reconoce ?rol=estudiantes|padres|docentes", () => {
    assert.equal(LOGIN_ROLE_PARAMS.estudiantes, "STUDENT");
    assert.equal(LOGIN_ROLE_PARAMS.padres, "GUARDIAN");
    assert.equal(LOGIN_ROLE_PARAMS.docentes, "TEACHER");
    assert.equal(isLoginRoleParam("toString"), false);
    assert.equal(isLoginRoleParam("admin"), false);
  });

  it("normaliza documentos y correos", () => {
    assert.equal(normalizeIdentifier(" 1.070.000.001 "), "1070000001");
    assert.equal(normalizeIdentifier("52 000-001"), "52000001");
    assert.equal(normalizeIdentifier(" Sofia.Ramirez@Campus.Lunita.TEST "), "sofia.ramirez@campus.lunita.test");
  });
});

describe("Navegación por rol (RBAC)", () => {
  it("solo administración ve migración y usuarios", () => {
    const keys = (role: Parameters<typeof getNavigation>[0]) => getNavigation(role).map((i) => i.key);
    assert.ok(keys("ADMIN").includes("migration"));
    assert.ok(!keys("TEACHER").includes("migration"));
    assert.ok(!keys("STUDENT").includes("users"));
    assert.ok(!keys("GUARDIAN").includes("structure"));
  });

  it("solo se muestran los módulos publicados", () => {
    const available = getNavigation("ADMIN").filter((i) => i.available).map((i) => i.key);
    assert.deepEqual(available, [
      "dashboard",
      "grades",
      "reportCards",
      "observer",
      "attendance",
      "agenda",
      "billing",
      "structure",
      "users",
      "enrollment",
      "migration",
    ]);
    assert.ok(!getNavigation("COORDINATOR").some((i) => i.key === "migration"));
    assert.ok(!getNavigation("TEACHER").some((i) => i.key === "migration"));
    assert.ok(!getNavigation("STUDENT").some((i) => i.available && i.key === "structure"));
    assert.ok(getNavigation("STUDENT").some((i) => i.available && i.key === "courses"));
    assert.ok(getNavigation("STUDENT").some((i) => i.available && i.key === "tasks"));
  });
});
