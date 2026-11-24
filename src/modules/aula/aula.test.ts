import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectAllowedMagicBytes } from "./magic-bytes";
import {
  evaluateQuizAttempt,
  isQuizWithinTimeLimit,
  quizRatioToSieeScore,
} from "./quizzes/evaluator";
import {
  isLateSubmission,
  normalizeToSieeScore,
  sanitizeAulaText,
  sanitizeSafeUrl,
} from "./sanitize";
import { createActivitySchema, gradeSubmissionSchema } from "./schemas";
import {
  ACCENT_TONES,
  BANNER_PRESETS,
  buildCustomColorGradient,
  COURSE_ICONS,
  DEFAULT_COURSE_THEME,
  normalizeCourseTheme,
  normalizeCustomHex,
} from "./themes";

describe("Órbita Virtual: seguridad, sanitización y puente SIEE", () => {
  it("elimina etiquetas HTML peligrosas y preserva párrafos limpios", () => {
    const clean = sanitizeAulaText("<img src=x onerror=alert(1)>Resumen de clase\r\n\r\n\r\n<b>Punto 1</b>");
    assert.equal(clean, "Resumen de clase\n\nPunto 1");
  });

  it("permite únicamente URLs https/http y bloquea javascript: y data:", () => {
    assert.equal(sanitizeSafeUrl("https://es.khanacademy.org/math"), "https://es.khanacademy.org/math");
    assert.equal(sanitizeSafeUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeSafeUrl("data:text/html,<script>alert(1)</script>"), null);
    assert.equal(sanitizeSafeUrl("no-es-url"), null);
  });

  it("detecta entregas tardías respetando 60 segundos de gracia", () => {
    const due = new Date("2026-11-25T23:59:00Z");
    assert.equal(isLateSubmission(due, new Date("2026-11-25T23:59:45Z")), false);
    assert.equal(isLateSubmission(due, new Date("2026-11-26T00:05:00Z")), true);
    assert.equal(isLateSubmission(null, new Date("2026-11-26T00:05:00Z")), false);
  });

  it("normaliza notas a la escala institucional SIEE (1.0 – 5.0 con 1 decimal)", () => {
    assert.equal(normalizeToSieeScore(4.56, 5.0), 4.6);
    assert.equal(normalizeToSieeScore(80, 100), 4.2);
    assert.equal(normalizeToSieeScore(0, 100), 1.0);
  });

  it("valida esquemas Zod de tareas y calificación docente", () => {
    const okAct = createActivitySchema.safeParse({
      courseAssignmentId: "11111111-1111-4111-8111-111111111111",
      unitId: "22222222-2222-4222-8222-222222222222",
      title: "Taller de ecosistemas",
      instructions: "Explica tres cadenas alimenticias de la sabana de Bogotá.",
      syncToSiga: true,
      sieeDimension: "HACER",
      weightPercent: 25,
    });
    assert.equal(okAct.success, true);

    const badGrade = gradeSubmissionSchema.safeParse({
      courseAssignmentId: "11111111-1111-4111-8111-111111111111",
      activityId: "22222222-2222-4222-8222-222222222222",
      enrollmentId: "33333333-3333-4333-8333-333333333333",
      score: 5.4,
    });
    assert.equal(badGrade.success, false);
  });
});

describe("Órbita Virtual: motor de cuestionarios autocalificables", () => {
  const sampleQuestions = [
    { id: "q1", questionType: "SINGLE_CHOICE" as const, points: 2, correctOptionIds: ["a"] },
    { id: "q2", questionType: "TRUE_FALSE" as const, points: 1, correctOptionIds: ["true"] },
    { id: "q3", questionType: "MULTI_CHOICE" as const, points: 2, correctOptionIds: ["x", "y"] },
  ];

  it("califica puntaje perfecto a 5.0 SIEE y 100%", () => {
    const res = evaluateQuizAttempt(sampleQuestions, {
      q1: ["a"],
      q2: ["true"],
      q3: ["x", "y"],
    });
    assert.equal(res.earnedPoints, 5);
    assert.equal(res.totalPoints, 5);
    assert.equal(res.percent, 100);
    assert.equal(res.sieeScore, 5.0);
    assert.equal(res.perQuestion.every((p) => p.isCorrect), true);
  });

  it("otorga puntaje parcial en selección múltiple y penaliza distractores incorrectos", () => {
    const partial = evaluateQuizAttempt(sampleQuestions, {
      q1: ["a"], // 2/2
      q2: ["false"], // 0/1
      q3: ["x"], // 1/2 (1 de 2 correctas, 0 incorrectas)
    });
    assert.equal(partial.earnedPoints, 3);
    assert.equal(partial.percent, 60);
    assert.equal(partial.sieeScore, 3.4);

    const penalized = evaluateQuizAttempt(sampleQuestions, {
      q1: ["b"], // 0/2
      q2: ["false"], // 0/1
      q3: ["x", "z"], // (1-1)/2 = 0
    });
    assert.equal(penalized.earnedPoints, 0);
    assert.equal(penalized.sieeScore, 1.0);
  });

  it("mapea razones 0..1 a la escala SIEE 1.0..5.0 acotada", () => {
    assert.equal(quizRatioToSieeScore(0), 1.0);
    assert.equal(quizRatioToSieeScore(0.5), 3.0);
    assert.equal(quizRatioToSieeScore(1), 5.0);
    assert.equal(quizRatioToSieeScore(1.5), 5.0);
  });

  it("valida límite de tiempo en servidor con 30 segundos de gracia", () => {
    const start = new Date("2026-11-24T15:00:00Z");
    assert.equal(
      isQuizWithinTimeLimit({ startedAt: start, submittedAt: new Date("2026-11-24T15:20:25Z"), timeLimitMinutes: 20 }),
      true,
    );
    assert.equal(
      isQuizWithinTimeLimit({ startedAt: start, submittedAt: new Date("2026-11-24T15:20:45Z"), timeLimitMinutes: 20 }),
      false,
    );
    assert.equal(
      isQuizWithinTimeLimit({ startedAt: start, submittedAt: new Date("2026-11-24T18:00:00Z"), timeLimitMinutes: null }),
      true,
    );
  });
});

describe("Órbita Virtual: magic bytes y temas personalizables", () => {
  it("reconoce firmas reales PDF, PNG, JPEG y WebP y rechaza HTML/scripts disfrazados", () => {
    assert.equal(detectAllowedMagicBytes(Buffer.from("%PDF-1.4\n1 0 obj\n")), "application/pdf");
    assert.equal(
      detectAllowedMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])),
      "image/png",
    );
    assert.equal(
      detectAllowedMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1])),
      "image/jpeg",
    );
    assert.equal(
      detectAllowedMagicBytes(Buffer.from("RIFF1234WEBPxxxx")),
      "image/webp",
    );
    assert.equal(detectAllowedMagicBytes(Buffer.from("<html><script>alert(1)</script></html>")), null);
    assert.equal(detectAllowedMagicBytes(Buffer.from("short")), null);
  });

  it("normaliza temas personalizados y aplica valores seguros ante entradas desconocidas", () => {
    assert.equal(BANNER_PRESETS.length, 12);
    assert.equal(ACCENT_TONES.length, 14);
    assert.equal(COURSE_ICONS.length, 20);

    assert.deepEqual(normalizeCourseTheme(null), DEFAULT_COURSE_THEME);
    assert.deepEqual(
      normalizeCourseTheme({
        bannerPreset: "circuits",
        accentTone: "teal",
        customColorHex: "#1d4ed8",
        bannerImageKey: "aula/banners/11111111-1111-4111-8111-111111111111.webp",
        iconKey: "microscope",
        layoutStyle: "compact",
        welcomeMessage: "¡Bienvenidos al laboratorio!",
      }),
      {
        bannerPreset: "circuits",
        accentTone: "teal",
        customColorHex: "#1D4ED8",
        hasBannerImage: true,
        iconKey: "microscope",
        layoutStyle: "compact",
        welcomeMessage: "¡Bienvenidos al laboratorio!",
      },
    );
    assert.deepEqual(
      normalizeCourseTheme({
        bannerPreset: "xss-attack",
        accentTone: "invalid",
        customColorHex: "javascript:alert(1)",
        iconKey: "bad",
        layoutStyle: "unknown",
      }),
      DEFAULT_COURSE_THEME,
    );
    assert.equal(normalizeCustomHex("#ff00aa"), "#FF00AA");
    assert.equal(normalizeCustomHex("red"), null);
    assert.match(buildCustomColorGradient("#FFFFFF"), /^linear-gradient\(125deg,/);
  });
});
