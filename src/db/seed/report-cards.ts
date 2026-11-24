import { and, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import { academicPeriods, academicYears, enrollments, groups, reportCards } from "../schema";
import { weightedAverage } from "../../modules/siga/siee-grades/calculator";
import { getPerformanceLevel, roundScore } from "../../modules/siga/siee-grades/scale";
import { formatVerificationCode } from "../../modules/siga/report-cards/verification";

/**
 * Emite boletines oficiales de demostración para el Tercer Periodo (cerrado)
 * en los grupos 7A y 3A (donde están Sofía y Tomás de la familia demo). Idempotente.
 */
export async function seedDemoReportCards(db: Database): Promise<number> {
  const [existing] = await db.select({ total: count() }).from(reportCards);
  if ((existing?.total ?? 0) > 0) return 0;

  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return 0;

  const [period3] = await db
    .select()
    .from(academicPeriods)
    .where(and(eq(academicPeriods.academicYearId, year.id), eq(academicPeriods.number, 3)))
    .limit(1);
  if (!period3) return 0;

  const targetGroups = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.academicYearId, year.id));

  const demoGroups = targetGroups.filter((g) => g.name === "7A" || g.name === "3A");
  if (demoGroups.length === 0) return 0;

  const rows: Array<typeof reportCards.$inferInsert> = [];
  let seq = 1;
  for (const g of demoGroups) {
    const roster = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.groupId, g.id),
          eq(enrollments.academicYearId, year.id),
          eq(enrollments.status, "ACTIVE"),
        ),
      );
    for (const enr of roster) {
      const avg = roundScore(weightedAverage([{ value: 4.1 + ((seq % 4) * 0.2), weight: 1 }]) ?? 4.2);
      const suffix = `DEMO${String(seq).padStart(4, "0")}A1B2`;
      seq += 1;
      rows.push({
        enrollmentId: enr.id,
        periodId: period3.id,
        verificationCode: formatVerificationCode(year.year, period3.number, suffix),
        averageScore: avg,
        performanceLevel: getPerformanceLevel(avg),
        directorObservations:
          g.name === "3A"
            ? "Excelente entusiasmo en clase, respeto por sus compañeros y gran participación en las actividades STHEAMI."
            : "Muestra buen nivel analítico y responsabilidad académica. Continuar fortaleciendo la organización de entregas en todas las áreas.",
        isStale: false,
        issuedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      });
    }
  }

  if (rows.length === 0) return 0;
  await db.insert(reportCards).values(rows);
  return rows.length;
}
