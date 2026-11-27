import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysUntil,
  earlyBirdAtSubmission,
  earlyBirdOnPayment,
  effectiveDiscounts,
} from "./discount-policy";

const DEADLINE = "2026-12-15";

describe("Descuentos de matrícula verificables", () => {
  it("pronto pago: elegible solo si se radica hasta la fecha límite", () => {
    assert.equal(earlyBirdAtSubmission("2026-11-27", DEADLINE), "ELIGIBLE");
    assert.equal(earlyBirdAtSubmission("2026-12-15", DEADLINE), "ELIGIBLE");
    assert.equal(earlyBirdAtSubmission("2026-12-16", DEADLINE), "NOT_ELIGIBLE");
  });

  it("pronto pago: se confirma o vence según la fecha en que se reporta el pago", () => {
    assert.equal(earlyBirdOnPayment("ELIGIBLE", "2026-12-10", DEADLINE), "CONFIRMED");
    assert.equal(earlyBirdOnPayment("ELIGIBLE", "2026-12-20", DEADLINE), "EXPIRED");
    // Quien radicó tarde nunca gana el descuento pagando.
    assert.equal(earlyBirdOnPayment("NOT_ELIGIBLE", "2026-12-01", DEADLINE), "NOT_ELIGIBLE");
  });

  it("solo se aplica el descuento de hermanos verificado", () => {
    assert.deepEqual(effectiveDiscounts({ earlyBird: "ELIGIBLE", sibling: "PENDING_REVIEW" }), {
      hasEarlyBirdDiscount: true,
      hasSiblingDiscount: false,
    });
    assert.equal(effectiveDiscounts({ earlyBird: "EXPIRED", sibling: "VERIFIED" }).hasSiblingDiscount, true);
    assert.equal(effectiveDiscounts({ earlyBird: "EXPIRED", sibling: "VERIFIED" }).hasEarlyBirdDiscount, false);
    assert.equal(effectiveDiscounts({ earlyBird: "CONFIRMED", sibling: "REJECTED" }).hasSiblingDiscount, false);
  });

  it("cuenta los días que faltan para la fecha límite", () => {
    assert.equal(daysUntil("2026-11-27", DEADLINE), 18);
    assert.equal(daysUntil("2026-12-15", DEADLINE), 0);
    assert.equal(daysUntil("2026-12-16", DEADLINE), -1);
  });
});
