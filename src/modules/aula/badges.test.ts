import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BADGES, evaluateBadges, nextBadge, type BadgeStats } from "./badges";

const EMPTY: BadgeStats = {
  submissions: 0,
  onTimeSubmissions: 0,
  superiorSubmissions: 0,
  quizzesSubmitted: 0,
  superiorQuizzes: 0,
  resourcesViewed: 0,
  forumPosts: 0,
  attendanceRecorded: 0,
  attendancePresent: 0,
};

describe("Insignias calculadas", () => {
  it("un estudiante nuevo no tiene insignias y todas empiezan en 0%", () => {
    const badges = evaluateBadges(EMPTY);
    assert.equal(badges.length, BADGES.length);
    assert.ok(badges.every((b) => !b.earned && b.percent === 0));
  });

  it("se ganan al llegar a la meta y la barra nunca pasa del 100%", () => {
    const badges = evaluateBadges({ ...EMPTY, submissions: 30, onTimeSubmissions: 9 });
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b]));
    assert.equal(byKey["first-launch"]!.earned, true);
    assert.equal(byKey["steady"]!.earned, true);
    assert.equal(byKey["steady"]!.percent, 100);
    assert.equal(byKey["on-time"]!.earned, false);
    assert.equal(byKey["on-time"]!.current, 9);
  });

  it("asistencia de oro exige un mínimo de registros", () => {
    const pocos = evaluateBadges({ ...EMPTY, attendanceRecorded: 5, attendancePresent: 5 });
    assert.equal(pocos.find((b) => b.key === "attendance")!.earned, false);
    const suficientes = evaluateBadges({ ...EMPTY, attendanceRecorded: 40, attendancePresent: 39 });
    assert.equal(suficientes.find((b) => b.key === "attendance")!.earned, true);
    const bajas = evaluateBadges({ ...EMPTY, attendanceRecorded: 40, attendancePresent: 30 });
    assert.equal(bajas.find((b) => b.key === "attendance")!.earned, false);
  });

  it("sugiere la insignia más cercana", () => {
    const badges = evaluateBadges({ ...EMPTY, submissions: 1, onTimeSubmissions: 8, resourcesViewed: 3 });
    assert.equal(nextBadge(badges)?.key, "on-time");
  });
});
