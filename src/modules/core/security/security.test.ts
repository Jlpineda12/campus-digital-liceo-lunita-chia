import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDemoLoginEnabled, isLocalHost } from "../auth/demo";
import { estimateStrength, validateNewPassword } from "../auth/password-policy";
import { generateToken, hashToken, isWellFormedToken } from "../auth/tokens";
import { frameStage, stageForLevel } from "../dashboard/stage";
import { buildContentSecurityPolicy, createNonce } from "./csp";
import { evaluateThrottle, LOGIN_POLICY, PASSWORD_RESET_POLICY } from "./throttle";

describe("Límite dual de intentos (IP + cuenta)", () => {
  const ok = { perIp: 0, perAccountAndIp: 0, perAccount: 0 };

  it("permite intentos por debajo de los umbrales", () => {
    assert.deepEqual(evaluateThrottle(LOGIN_POLICY, { perIp: 19, perAccountAndIp: 4, perAccount: 29 }), {
      blocked: false,
    });
  });

  it("frena el password spraying desde una IP aunque cada cuenta tenga pocos fallos", () => {
    const decision = evaluateThrottle(LOGIN_POLICY, { ...ok, perIp: 20, perAccountAndIp: 1 });
    assert.equal(decision.blocked && decision.reason, "ip");
  });

  it("frena la fuerza bruta contra una cuenta desde la misma IP", () => {
    const decision = evaluateThrottle(LOGIN_POLICY, { ...ok, perIp: 5, perAccountAndIp: 5, perAccount: 5 });
    assert.equal(decision.blocked && decision.reason, "account");
  });

  it("no bloquea al dueño legítimo por 5 fallos de un atacante en otra IP", () => {
    // Desde la IP del dueño: 0 fallos propios; la cuenta acumula 5 de otra IP.
    assert.equal(evaluateThrottle(LOGIN_POLICY, { perIp: 0, perAccountAndIp: 0, perAccount: 5 }).blocked, false);
  });

  it("frena ataques distribuidos sobre una misma cuenta", () => {
    assert.equal(evaluateThrottle(LOGIN_POLICY, { ...ok, perAccount: 30 }).blocked, true);
  });

  it("sin IP conocida aplica solo la regla por cuenta", () => {
    assert.equal(
      evaluateThrottle(LOGIN_POLICY, { perIp: null, perAccountAndIp: null, perAccount: 29 }).blocked,
      false,
    );
  });

  it("la recuperación de clave es más estricta por cuenta (evita inundar buzones)", () => {
    assert.equal(evaluateThrottle(PASSWORD_RESET_POLICY, { ...ok, perAccountAndIp: 3 }).blocked, true);
  });
});

describe("Content-Security-Policy", () => {
  it("en producción exige nonce, bloquea objetos y marcos y no permite eval", () => {
    const csp = buildContentSecurityPolicy("abc123", false);
    assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /upgrade-insecure-requests/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  });

  it("en desarrollo permite eval (depuración de React) y websockets de recarga", () => {
    const csp = buildContentSecurityPolicy("abc", true);
    assert.match(csp, /'unsafe-eval'/);
    assert.match(csp, /connect-src 'self' ws: wss:/);
  });

  it("genera nonces distintos", () => {
    assert.notEqual(createNonce(), createNonce());
  });
});

describe("Acceso demo solo en host local", () => {
  it("reconoce hosts locales", () => {
    for (const host of ["localhost:3000", "127.0.0.1", "[::1]:3000", "campus.localhost"]) {
      assert.equal(isLocalHost(host), true, host);
    }
    for (const host of ["campus.liceolunita.edu.co", "192.168.1.20:3000", "localhost.evil.com", null]) {
      assert.equal(isLocalHost(host), false, String(host));
    }
  });

  it("se desactiva fuera de un host local aunque la variable esté activa", () => {
    const previous = process.env.DEMO_LOGIN_ENABLED;
    process.env.DEMO_LOGIN_ENABLED = "true";
    try {
      assert.equal(isDemoLoginEnabled("staging.liceolunita.edu.co"), false);
      assert.equal(isDemoLoginEnabled("localhost:3000"), process.env.NODE_ENV !== "production");
    } finally {
      process.env.DEMO_LOGIN_ENABLED = previous;
    }
  });
});

describe("Política de contraseñas nuevas", () => {
  const context = { documentNumber: "1070000001", email: "sofia.ramirez@campus.lunita.test", firstName: "Sofía" };

  it("acepta una contraseña robusta", () => {
    assert.deepEqual(validateNewPassword("Cometa-Azul-2031", context), []);
  });

  it("rechaza cortas, sin números o con datos personales", () => {
    assert.ok(validateNewPassword("abc12", context).length > 0);
    assert.ok(validateNewPassword("solamenteletras", context).some((p) => p.includes("números")));
    assert.ok(validateNewPassword("xx1070000001yy", context).some((p) => p.includes("documento")));
    assert.ok(validateNewPassword("Sofia2026clave", context).some((p) => p.includes("nombre")));
  });

  it("rechaza contraseñas comunes", () => {
    assert.ok(validateNewPassword("lunita202620", context).some((p) => p.includes("comunes")));
  });

  it("el medidor nunca califica alto una clave que no cumple la política", () => {
    assert.ok(estimateStrength("contraseña12345") <= 1);
    assert.ok(estimateStrength("Cometa-Azul-2031") >= 3);
  });
});

describe("Tokens de un solo uso", () => {
  it("son de 32 bytes en base64url y se guardan como SHA-256", () => {
    const token = generateToken();
    assert.equal(isWellFormedToken(token), true);
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
    assert.notEqual(hashToken(token), token);
    assert.equal(isWellFormedToken("../../etc/passwd"), false);
  });
});

describe("Sistema visual dual (data-stage)", () => {
  it("asigna la etapa según el nivel del estudiante", () => {
    assert.equal(stageForLevel("PREESCOLAR"), "primaria");
    assert.equal(stageForLevel("PRIMARIA"), "primaria");
    assert.equal(stageForLevel("BACHILLERATO"), "bachillerato");
  });

  it("el marco es institucional para acudientes, docentes y directivos", () => {
    assert.equal(frameStage("STUDENT", "PRIMARIA"), "primaria");
    assert.equal(frameStage("STUDENT", "BACHILLERATO"), "bachillerato");
    for (const role of ["GUARDIAN", "TEACHER", "COORDINATOR", "ADMIN"] as const) {
      assert.equal(frameStage(role, "PRIMARIA"), "institucional");
    }
  });
});
