import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, count, eq, inArray } from "drizzle-orm";
import { createDatabase, type Database } from "../client";
import {
  academicPeriods,
  academicYears,
  activities,
  courseAssignments,
  courseThemes,
  courseUnits,
  enrollments,
  forumPosts,
  groups,
  learningResources,
  quizQuestions,
  sieeCompetencies,
  sieeGradeColumns,
  subjects,
  submissions,
  users,
} from "../schema";
import { loadScriptEnv } from "../scripts/env";

/** Genera un documento PDF 1.4 válido mínimo para pruebas de descarga/lectura segura. */
function buildSamplePdfBuffer(title: string, subtitle: string): Buffer {
  const safeTitle = title.replace(/[()\\]/g, "");
  const safeSub = subtitle.replace(/[()\\]/g, "");
  const stream = `BT\n/F1 18 Tf\n56 750 Td\n(${safeTitle}) Tj\n0 -28 Td\n/F1 12 Tf\n(${safeSub}) Tj\n0 -26 Td\n(1. Repasa las definiciones clave vistas en clase.) Tj\n0 -20 Td\n(2. Resuelve los ejercicios propuestos y prepara el cuestionario interactivo.) Tj\n0 -20 Td\n(3. Sube tu evidencia en PDF o foto desde Orbita Virtual.) Tj\nET\n`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

/**
 * Contenido inicial de demostración para Órbita Virtual (`/aula`) en los grupos
 * de la familia demo (`7A` Bachillerato y `3A` Primaria) durante el Periodo 4.
 * Idempotente: no duplica si ya existen unidades en `course_units`.
 */
export async function seedDemoAula(db: Database): Promise<{ units: number; activities: number; submissions: number }> {
  const [existing] = await db.select({ total: count() }).from(courseUnits);
  if ((existing?.total ?? 0) > 0) return { units: 0, activities: 0, submissions: 0 };

  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return { units: 0, activities: 0, submissions: 0 };

  const periods = await db
    .select()
    .from(academicPeriods)
    .where(eq(academicPeriods.academicYearId, year.id));
  const p4 = periods.find((p) => p.number === 4) ?? periods.at(-1);
  if (!p4) return { units: 0, activities: 0, submissions: 0 };

  const demoGroups = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(eq(groups.academicYearId, year.id), inArray(groups.name, ["7A", "3A"])));
  if (demoGroups.length === 0) return { units: 0, activities: 0, submissions: 0 };

  const courses = await db
    .select({
      id: courseAssignments.id,
      groupId: courseAssignments.groupId,
      teacherId: courseAssignments.teacherId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      groupName: groups.name,
    })
    .from(courseAssignments)
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .where(
      and(
        eq(courseAssignments.academicYearId, year.id),
        inArray(
          courseAssignments.groupId,
          demoGroups.map((g) => g.id),
        ),
      ),
    );

  const demoStudents = await db
    .select({ enrollmentId: enrollments.id, groupId: enrollments.groupId, email: users.email })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(
      and(
        eq(enrollments.academicYearId, year.id),
        inArray(
          enrollments.groupId,
          demoGroups.map((g) => g.id),
        ),
      ),
    );

  const sofia = demoStudents.find((s) => s.email === "sofia.ramirez@campus.lunita.test");
  const tomas = demoStudents.find((s) => s.email === "tomas.ramirez@campus.lunita.test");

  const targetSubjects = new Set(["MATE", "CNAT", "TECN", "LENG", "INGL", "INGE"]);
  const selectedCourses = courses.filter((c) => targetSubjects.has(c.subjectCode));

  const unitRows: Array<typeof courseUnits.$inferInsert & { id: string }> = [];
  const resRows: Array<typeof learningResources.$inferInsert> = [];
  const actRows: Array<typeof activities.$inferInsert & { id: string; courseId: string; teacherId: string | null; groupName: string }> = [];
  const postRows: Array<typeof forumPosts.$inferInsert> = [];
  const subRows: Array<typeof submissions.$inferInsert> = [];

  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  for (const c of selectedCourses) {
    const unitId = crypto.randomUUID();
    const isPrimaria = c.groupName === "3A";

    unitRows.push({
      id: unitId,
      courseAssignmentId: c.id,
      periodId: p4.id,
      title: isPrimaria
        ? `Módulo 1 · Explorando ${c.subjectName}`
        : `Unidad 1 · Proyecto aplicado de ${c.subjectName}`,
      description: isPrimaria
        ? "Guía ilustrada, video corto y misión práctica para realizar en casa y clase."
        : "Fundamentos teóricos, recursos interactivos y taller evaluable conectado con SIGA.",
      displayOrder: 0,
      isPublished: true,
    });

    resRows.push(
      {
        unitId,
        type: "RICH_TEXT",
        title: `Guía de estudio: conceptos clave de ${c.subjectName}`,
        contentTextOrUrl: isPrimaria
          ? `¡Hola explorador!\n\nEn esta unidad de ${c.subjectName} vamos a observar, preguntar y construir juntos.\n\n1. Repasa los ejemplos vistos en clase en tu cuaderno.\n2. Anota dos preguntas curiosas para compartir en el salón.\n3. Completa la misión práctica antes de la fecha límite.`
          : `Objetivos de la unidad (${c.subjectName} · ${c.groupName}):\n\n• Comprender los conceptos fundamentales del cuarto periodo y su aplicación en proyectos STHEAMI.\n• Documentar paso a paso el procedimiento empleado en los talleres.\n• Preparar la sustentación oral y escrita para el cierre de unidad.`,
        displayOrder: 0,
        isPublished: true,
      },
      {
        unitId,
        type: "LINK",
        title: `Recurso interactivo recomendado (${c.subjectName})`,
        contentTextOrUrl: "https://es.khanacademy.org/",
        displayOrder: 1,
        isPublished: true,
      },
    );

    const actId = crypto.randomUUID();
    actRows.push({
      id: actId,
      courseId: c.id,
      teacherId: c.teacherId,
      groupName: c.groupName,
      unitId,
      type: "ASSIGNMENT",
      title: isPrimaria
        ? `Misión práctica: mi reto de ${c.subjectName}`
        : `Taller evaluable: análisis y aplicación en ${c.subjectName}`,
      instructionsSanitized: isPrimaria
        ? `Cuéntanos con tus palabras qué descubriste en la actividad de ${c.subjectName} y cómo lo resolviste. Si hiciste un dibujo o foto con tus papás, puedes pegar el enlace opcional.`
        : `Resuelve los tres ejercicios propuestos en la guía de ${c.subjectName}, redacta tus conclusiones principales en el cuadro de entrega y adjunta el enlace a tu documento o presentación si aplica.`,
      dueDate: inDays(c.subjectCode === "MATE" ? 3 : 7),
      maxScore: 5.0,
      allowLate: true,
      syncToSiga: c.subjectCode === "MATE",
      isPublished: true,
    });

    if (c.teacherId) {
      postRows.push({
        courseAssignmentId: c.id,
        authorId: c.teacherId,
        bodySanitized: `¡Bienvenidos a Órbita Virtual en ${c.subjectName} (${c.groupName})!\n\nAquí encontrarán las guías del Cuarto Periodo y podrán enviar sus tareas directamente. Cualquier duda pueden escribirla en este espacio.`,
        isPinned: true,
      });
    }
  }

  // Entregas demo: Sofía tiene 1 entrega ya calificada (CIE) y 1 en revisión (LEN); el resto pendientes.
  const sofiaCie = actRows.find((a) => a.groupName === "7A" && a.title.includes("Ciencias"));
  const sofiaLen = actRows.find((a) => a.groupName === "7A" && a.title.includes("Lengua"));
  const tomasMat = actRows.find((a) => a.groupName === "3A" && a.title.includes("Matemáticas"));

  if (sofia && sofiaCie) {
    subRows.push({
      activityId: sofiaCie.id,
      enrollmentId: sofia.enrollmentId,
      textResponse:
        "Analicé la transferencia de energía en un ecosistema de humedal de Chía (productores, consumidores primarios y descomponedores) y registré las observaciones de laboratorio.",
      submittedAt: inDays(-2),
      isLate: false,
      score: 4.8,
      teacherFeedback: "Excelente análisis y excelente conexión con los ecosistemas locales de Chía.",
      gradedBy: sofiaCie.teacherId,
      gradedAt: inDays(-1),
    });
  }
  if (sofia && sofiaLen) {
    subRows.push({
      activityId: sofiaLen.id,
      enrollmentId: sofia.enrollmentId,
      textResponse:
        "Redacté la crónica periodística sobre la Feria STHEAMI entrevistando a dos compañeros de robótica. Adjunto las conclusiones principales.",
      submittedAt: inDays(-1),
      isLate: false,
    });
  }
  if (tomas && tomasMat) {
    subRows.push({
      activityId: tomasMat.id,
      enrollmentId: tomas.enrollmentId,
      textResponse:
        "Conté y repartí en partes iguales 24 fichas de colores con ayuda de mi mamá y dibujé las fracciones en mi cuaderno.",
      submittedAt: inDays(-1),
      isLate: false,
    });
  }

  await db.transaction(async (tx) => {
    if (unitRows.length > 0) await tx.insert(courseUnits).values(unitRows);
    if (resRows.length > 0) await tx.insert(learningResources).values(resRows);
    if (actRows.length > 0) {
      await tx.insert(activities).values(
        actRows.map((a) => ({
          id: a.id,
          unitId: a.unitId,
          type: a.type,
          title: a.title,
          instructionsSanitized: a.instructionsSanitized,
          dueDate: a.dueDate,
          maxScore: a.maxScore,
          allowLate: a.allowLate,
          syncToSiga: a.syncToSiga,
          isPublished: a.isPublished,
        })),
      );

      // Vincula las tareas con `syncToSiga: true` a una columna SIEE en HACER (25%).
      for (const act of actRows.filter((a) => a.syncToSiga)) {
        const [comp] = await tx
          .select({ id: sieeCompetencies.id })
          .from(sieeCompetencies)
          .where(
            and(
              eq(sieeCompetencies.courseAssignmentId, act.courseId),
              eq(sieeCompetencies.periodId, p4.id),
              eq(sieeCompetencies.dimension, "HACER"),
            ),
          )
          .limit(1);
        if (comp) {
          await tx
            .insert(sieeGradeColumns)
            .values({
              courseAssignmentId: act.courseId,
              periodId: p4.id,
              competencyId: comp.id,
              title: act.title.slice(0, 60),
              weightPercent: 25,
              linkedActivityId: act.id,
              displayOrder: 5,
              createdBy: act.teacherId,
            })
            .onConflictDoNothing();
        }
      }
    }
    if (postRows.length > 0) await tx.insert(forumPosts).values(postRows);
    if (subRows.length > 0) await tx.insert(submissions).values(subRows);
  });

  await seedDemoAulaExtras(db);
  return { units: unitRows.length, activities: actRows.length, submissions: subRows.length };
}

/**
 * Siembra idempotente de cuestionarios interactivos, guías PDF reales en
 * almacenamiento privado y personalizaciones visuales de portada para demo.
 */
export async function seedDemoAulaExtras(db: Database): Promise<{ quizzes: number; pdfs: number; themes: number }> {
  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return { quizzes: 0, pdfs: 0, themes: 0 };

  const periods = await db.select().from(academicPeriods).where(eq(academicPeriods.academicYearId, year.id));
  const p4 = periods.find((p) => p.number === 4) ?? periods.at(-1);
  if (!p4) return { quizzes: 0, pdfs: 0, themes: 0 };

  const demoGroups = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(eq(groups.academicYearId, year.id), inArray(groups.name, ["7A", "3A"])));
  if (demoGroups.length === 0) return { quizzes: 0, pdfs: 0, themes: 0 };

  const courses = await db
    .select({
      id: courseAssignments.id,
      teacherId: courseAssignments.teacherId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      groupName: groups.name,
    })
    .from(courseAssignments)
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
    .where(
      and(
        eq(courseAssignments.academicYearId, year.id),
        inArray(
          courseAssignments.groupId,
          demoGroups.map((g) => g.id),
        ),
      ),
    );

  let themesCreated = 0;
  let quizzesCreated = 0;
  let pdfsCreated = 0;

  // 1. Temas visuales iniciales por materia
  const themePresets: Array<{
    groupName: string;
    subjectCode: string;
    bannerPreset: string;
    accentTone: string;
    iconKey: string;
    welcomeMessage: string;
  }> = [
    {
      groupName: "7A",
      subjectCode: "MATE",
      bannerPreset: "geometry",
      accentTone: "cobalt",
      iconKey: "calculator",
      welcomeMessage:
        "¡Bienvenidos a Matemáticas 7A! Cada semana encontrarás la guía PDF de clase, el taller práctico y el reto interactivo.",
    },
    {
      groupName: "7A",
      subjectCode: "CNAT",
      bannerPreset: "botanical",
      accentTone: "green",
      iconKey: "flask",
      welcomeMessage: "Exploramos los ecosistemas de la sabana de Chía con método científico y laboratorio.",
    },
    {
      groupName: "7A",
      subjectCode: "TECN",
      bannerPreset: "lab",
      accentTone: "purple",
      iconKey: "cpu",
      welcomeMessage: "Diseño, pensamiento computacional y prototipos STHEAMI para el cierre del año.",
    },
    {
      groupName: "3A",
      subjectCode: "MATE",
      bannerPreset: "constellation",
      accentTone: "sky",
      iconKey: "rocket",
      welcomeMessage: "¡Hola exploradores de 3A! Aquí vamos a jugar con fracciones, medidas y acertijos.",
    },
  ];

  for (const preset of themePresets) {
    const course = courses.find((c) => c.groupName === preset.groupName && c.subjectCode === preset.subjectCode);
    if (!course) continue;
    const inserted = await db
      .insert(courseThemes)
      .values({
        courseAssignmentId: course.id,
        bannerPreset: preset.bannerPreset,
        accentTone: preset.accentTone,
        iconKey: preset.iconKey,
        layoutStyle: "cards",
        welcomeMessage: preset.welcomeMessage,
      })
      .onConflictDoNothing()
      .returning({ id: courseThemes.courseAssignmentId });
    if (inserted.length > 0) themesCreated++;
  }

  // 2. Guía PDF real en almacenamiento privado para Matemáticas 7A y 3A
  const storageRoot = process.env.PRIVATE_STORAGE_DIR?.trim()
    ? path.resolve(process.env.PRIVATE_STORAGE_DIR.trim())
    : path.resolve(process.cwd(), ".storage", "campus");

  const mathCourses = courses.filter((c) => c.subjectCode === "MATE");
  for (const mc of mathCourses) {
    const [unit] = await db
      .select({ id: courseUnits.id })
      .from(courseUnits)
      .where(and(eq(courseUnits.courseAssignmentId, mc.id), eq(courseUnits.periodId, p4.id)))
      .limit(1);
    if (!unit) continue;

    // 2a. PDF real privado si aún no existe un recurso PDF en la unidad
    const [existingPdf] = await db
      .select({ id: learningResources.id })
      .from(learningResources)
      .where(and(eq(learningResources.unitId, unit.id), eq(learningResources.type, "PDF")))
      .limit(1);

    if (!existingPdf) {
      const storageKey =
        mc.groupName === "7A"
          ? "aula/resources/11111111-1111-4111-8111-111111111101.pdf"
          : "aula/resources/11111111-1111-4111-8111-111111111102.pdf";
      const pdfBuf = buildSamplePdfBuffer(
        `Liceo Lunita de Chia - Guia PDF de Matematicas (${mc.groupName})`,
        "Periodo 4 - Material oficial de estudio en Orbita Virtual",
      );
      const absPath = path.resolve(storageRoot, storageKey);
      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, pdfBuf, { mode: 0o600 });

      await db.insert(learningResources).values({
        unitId: unit.id,
        type: "PDF",
        title:
          mc.groupName === "7A"
            ? "Guía PDF · Ecuaciones lineales y proporcionalidad (7A)"
            : "Cartilla PDF · Fracciones y repartos en partes iguales (3A)",
        contentTextOrUrl:
          mc.groupName === "7A"
            ? "guia-ecuaciones-7a.pdf"
            : "cartilla-fracciones-3a.pdf",
        storageKey,
        fileSizeBytes: pdfBuf.length,
        displayOrder: 2,
        isPublished: true,
      });
      pdfsCreated++;
    }

    // 2b. Cuestionario interactivo con 4 preguntas si aún no existe un QUIZ en la unidad
    const [existingQuiz] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.unitId, unit.id), eq(activities.type, "QUIZ")))
      .limit(1);

    if (!existingQuiz) {
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const isPrimaria = mc.groupName === "3A";
      const quizTitle = isPrimaria
        ? "Reto interactivo: fracciones y medidas"
        : "Quiz interactivo: proporcionalidad y ecuaciones lineales";

      const quizQuestionsSeed = isPrimaria
        ? [
            {
              questionType: "SINGLE_CHOICE" as const,
              prompt: "Si repartes 1 pizza en 4 porciones iguales y comes 1 porción, ¿qué fracción comiste?",
              options: [
                { id: "a", label: "1/4 (un cuarto)" },
                { id: "b", label: "1/2 (un medio)" },
                { id: "c", label: "3/4 (tres cuartos)" },
                { id: "d", label: "4/1 (cuatro enteros)" },
              ],
              correct: ["a"],
              points: 2,
            },
            {
              questionType: "TRUE_FALSE" as const,
              prompt: "Dos mitades (1/2 + 1/2) forman exactamente una unidad completa.",
              options: [
                { id: "opt-true", label: "Verdadero" },
                { id: "opt-false", label: "Falso" },
              ],
              correct: ["opt-true"],
              points: 1,
            },
            {
              questionType: "MULTI_CHOICE" as const,
              prompt: "Selecciona TODAS las fracciones equivalentes a 1/2:",
              options: [
                { id: "a", label: "2/4" },
                { id: "b", label: "3/6" },
                { id: "c", label: "2/3" },
                { id: "d", label: "1/3" },
              ],
              correct: ["a", "b"],
              points: 2,
            },
          ]
        : [
            {
              questionType: "SINGLE_CHOICE" as const,
              prompt: "Resuelve la ecuación lineal: 3x + 5 = 20. ¿Cuál es el valor de x?",
              options: [
                { id: "a", label: "x = 3" },
                { id: "b", label: "x = 5" },
                { id: "c", label: "x = 7" },
                { id: "d", label: "x = 15" },
              ],
              correct: ["b"],
              points: 2,
            },
            {
              questionType: "TRUE_FALSE" as const,
              prompt: "En una relación de proporcionalidad directa, si duplicas una magnitud la otra también se duplica.",
              options: [
                { id: "opt-true", label: "Verdadero" },
                { id: "opt-false", label: "Falso" },
              ],
              correct: ["opt-true"],
              points: 1,
            },
            {
              questionType: "SINGLE_CHOICE" as const,
              prompt: "Si 4 cuadernos cuestan $18.000, ¿cuánto cuestan 6 cuadernos al mismo precio unitario?",
              options: [
                { id: "a", label: "$24.000" },
                { id: "b", label: "$27.000" },
                { id: "c", label: "$30.000" },
                { id: "d", label: "$36.000" },
              ],
              correct: ["b"],
              points: 2,
            },
            {
              questionType: "MULTI_CHOICE" as const,
              prompt: "Marca TODAS las expresiones que equivalen a 2(x + 3):",
              options: [
                { id: "a", label: "2x + 6" },
                { id: "b", label: "x + x + 6" },
                { id: "c", label: "2x + 3" },
                { id: "d", label: "2x + 5" },
              ],
              correct: ["a", "b"],
              points: 2,
            },
          ];

      await db.transaction(async (tx) => {
        const [createdQuiz] = await tx
          .insert(activities)
          .values({
            unitId: unit.id,
            type: "QUIZ",
            title: quizTitle,
            instructionsSanitized: isPrimaria
              ? "Lee cada pregunta con calma. Al finalizar verás tu puntaje de inmediato y podrás revisar tus respuestas."
              : "Responde las 4 preguntas dentro del tiempo límite. Tu mejor nota se registra al instante en la planilla SIEE (dimensión Saber).",
            dueDate,
            timeLimitMinutes: isPrimaria ? 15 : 20,
            maxAttempts: 2,
            maxScore: 5.0,
            allowLate: true,
            syncToSiga: true,
            isPublished: true,
          })
          .returning({ id: activities.id });

        await tx.insert(quizQuestions).values(
          quizQuestionsSeed.map((q, idx) => ({
            activityId: createdQuiz!.id,
            questionType: q.questionType,
            promptSanitized: q.prompt,
            optionsJson: q.options,
            correctAnswerJson: q.correct,
            points: q.points,
            displayOrder: idx,
          })),
        );

        const [saberComp] = await tx
          .select({ id: sieeCompetencies.id })
          .from(sieeCompetencies)
          .where(
            and(
              eq(sieeCompetencies.courseAssignmentId, mc.id),
              eq(sieeCompetencies.periodId, p4.id),
              eq(sieeCompetencies.dimension, "SABER"),
            ),
          )
          .limit(1);

        if (saberComp) {
          await tx
            .insert(sieeGradeColumns)
            .values({
              courseAssignmentId: mc.id,
              periodId: p4.id,
              competencyId: saberComp.id,
              title: quizTitle.slice(0, 60),
              weightPercent: 20,
              linkedActivityId: createdQuiz!.id,
              displayOrder: 6,
              createdBy: mc.teacherId,
            })
            .onConflictDoNothing();
        }
      });

      quizzesCreated++;
    }
  }

  return { quizzes: quizzesCreated, pdfs: pdfsCreated, themes: themesCreated };
}

if (require.main === module) {
  loadScriptEnv();
  const db = createDatabase();
  seedDemoAula(db)
    .then(async (res) => {
      const extras = await seedDemoAulaExtras(db);
      console.log(
        `✔ Órbita Virtual sembrada: ${res.units} unidades, ${res.activities} tareas, ${res.submissions} entregas | Extras: ${extras.quizzes} cuestionarios, ${extras.pdfs} guías PDF, ${extras.themes} temas.`,
      );
    })
    .catch((err: unknown) => {
      console.error("✖ Error sembrando Órbita Virtual:", err);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
