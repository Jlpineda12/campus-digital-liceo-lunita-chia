import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  academicPeriods,
  academicYears,
  courseAssignments,
  enrollments,
  grades,
  groups,
  sieeCompetencies,
  sieeGradeColumns,
  studentGrades,
} from "../schema";
import {
  DEFAULT_DIMENSION_WEIGHTS,
  QUALITATIVE_LEVELS,
  type NumericDimension,
} from "../../modules/siga/siee-grades/calculator";
import { getPerformanceLevel } from "../../modules/siga/siee-grades/scale";

/**
 * Notas de demostración (ficticias) para el año en curso: periodos cerrados
 * completos y el periodo abierto con la primera columna de cada dimensión.
 */
const NUMERIC_COLUMNS: Record<NumericDimension, Array<{ title: string; weight: number }>> = {
  SABER: [
    { title: "Evaluación escrita", weight: 60 },
    { title: "Quiz", weight: 40 },
  ],
  HACER: [
    { title: "Taller en clase", weight: 50 },
    { title: "Proyecto", weight: 50 },
  ],
  SER: [{ title: "Actitud y participación", weight: 100 }],
};
const QUALITATIVE_COLUMNS = ["Observación del proceso", "Producción en clase"];

/** Pseudoaleatorio determinista (mismas notas en cada `db:reset`). */
function noise(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p + 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function seedDemoGrades(db: Database): Promise<number> {
  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return 0;

  const [periods, courses, roster] = await Promise.all([
    db.select().from(academicPeriods).where(eq(academicPeriods.academicYearId, year.id)),
    db
      .select({
        id: courseAssignments.id,
        groupId: courseAssignments.groupId,
        teacherId: courseAssignments.teacherId,
        mode: grades.assessmentMode,
      })
      .from(courseAssignments)
      .innerJoin(groups, eq(groups.id, courseAssignments.groupId))
      .innerJoin(grades, eq(grades.id, groups.gradeId))
      .where(eq(courseAssignments.academicYearId, year.id)),
    db
      .select({ id: enrollments.id, groupId: enrollments.groupId })
      .from(enrollments)
      .where(and(eq(enrollments.academicYearId, year.id), eq(enrollments.status, "ACTIVE"))),
  ]);

  const competencyRows: Array<typeof sieeCompetencies.$inferInsert & { id: string }> = [];
  const columnRows: Array<typeof sieeGradeColumns.$inferInsert & { id: string }> = [];
  const gradeRows: Array<typeof studentGrades.$inferInsert> = [];

  courses.forEach((course, ci) => {
    const students = roster.filter((e) => e.groupId === course.groupId);
    for (const period of periods) {
      const open = !period.gradesLocked;
      if (course.mode === "QUALITATIVE") {
        const competencyId = crypto.randomUUID();
        competencyRows.push({
          id: competencyId,
          courseAssignmentId: course.id,
          periodId: period.id,
          dimension: "QUALITATIVE",
          weightPercent: 100,
        });
        QUALITATIVE_COLUMNS.forEach((title, k) => {
          if (open && k > 0) return;
          const columnId = crypto.randomUUID();
          columnRows.push({
            id: columnId,
            courseAssignmentId: course.id,
            periodId: period.id,
            competencyId,
            title,
            weightPercent: 50,
            displayOrder: k,
            createdBy: course.teacherId,
          });
          students.forEach((s, si) => {
            const r = noise(ci, period.number, k, si);
            gradeRows.push({
              columnId,
              enrollmentId: s.id,
              qualitativeLevel: QUALITATIVE_LEVELS[r < 0.6 ? 0 : r < 0.9 ? 1 : 2],
              updatedBy: course.teacherId,
            });
          });
        });
        continue;
      }

      (Object.keys(DEFAULT_DIMENSION_WEIGHTS) as NumericDimension[]).forEach((dimension, di) => {
        const competencyId = crypto.randomUUID();
        competencyRows.push({
          id: competencyId,
          courseAssignmentId: course.id,
          periodId: period.id,
          dimension,
          weightPercent: DEFAULT_DIMENSION_WEIGHTS[dimension],
          displayOrder: di,
        });
        NUMERIC_COLUMNS[dimension].forEach((col, k) => {
          if (open && k > 0) return;
          const columnId = crypto.randomUUID();
          columnRows.push({
            id: columnId,
            courseAssignmentId: course.id,
            periodId: period.id,
            competencyId,
            title: col.title,
            weightPercent: col.weight,
            displayOrder: k,
            createdBy: course.teacherId,
          });
          students.forEach((s, si) => {
            // Base por estudiante + variación por actividad: rango 2.6–5.0.
            const base = 3.2 + noise(si, ci) * 1.4;
            const score = Math.round(Math.min(5, Math.max(1, base + (noise(ci, period.number, di, k, si) - 0.4) * 1.6)) * 10) / 10;
            gradeRows.push({
              columnId,
              enrollmentId: s.id,
              numericScore: score,
              performanceLevel: getPerformanceLevel(score),
              updatedBy: course.teacherId,
            });
          });
        });
      });
    }
  });

  await db.transaction(async (tx) => {
    for (const part of chunk(competencyRows, 1000)) await tx.insert(sieeCompetencies).values(part);
    for (const part of chunk(columnRows, 1000)) await tx.insert(sieeGradeColumns).values(part);
    for (const part of chunk(gradeRows, 1000)) await tx.insert(studentGrades).values(part);
  });
  return gradeRows.length;
}
