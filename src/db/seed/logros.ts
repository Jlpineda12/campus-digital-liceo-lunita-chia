import { and, eq } from "drizzle-orm";
import { getSuggestedLogro } from "../../modules/siga/siee-grades/logros";
import { createDatabase, type Database } from "../client";
import { academicPeriods, academicYears, courseAssignments, sieeCompetencies, subjects } from "../schema";
import { loadScriptEnv } from "../scripts/env";

/**
 * Pobla logros pedagógicos STHEAMI en los periodos cerrados (1–3) para las
 * competencias que aún tienen `description === ""`. Idempotente.
 */
export async function seedDemoLogros(db: Database): Promise<number> {
  const [year] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (!year) return 0;

  const rows = await db
    .select({
      id: sieeCompetencies.id,
      dimension: sieeCompetencies.dimension,
      description: sieeCompetencies.description,
      pillar: subjects.stheamiPillar,
      gradesLocked: academicPeriods.gradesLocked,
    })
    .from(sieeCompetencies)
    .innerJoin(academicPeriods, eq(academicPeriods.id, sieeCompetencies.periodId))
    .innerJoin(courseAssignments, eq(courseAssignments.id, sieeCompetencies.courseAssignmentId))
    .innerJoin(subjects, eq(subjects.id, courseAssignments.subjectId))
    .where(and(eq(academicPeriods.academicYearId, year.id), eq(academicPeriods.gradesLocked, true)));

  const empty = rows.filter((r) => r.description.trim().length === 0);
  if (empty.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const item of empty) {
      await tx
        .update(sieeCompetencies)
        .set({ description: getSuggestedLogro(item.pillar, item.dimension) })
        .where(eq(sieeCompetencies.id, item.id));
    }
  });

  return empty.length;
}

if (require.main === module) {
  loadScriptEnv();
  const db = createDatabase();
  seedDemoLogros(db)
    .then((n) => console.log(`✔ Logros pedagógicos sembrados: ${n}`))
    .catch((err: unknown) => {
      console.error("✖ Error sembrando logros:", err);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
