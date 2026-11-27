import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CourseDirectory, type CourseCompliance } from "@/components/aula/CourseDirectory";
import { TactileCard } from "@/components/ui/TactileCard";
import { listAulaCoursesForActor } from "@/modules/aula/queries";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { isStheamiPillar } from "@/modules/core/academic-structure/stheami";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { getPeriodComplianceOverview } from "@/modules/siga/siee-grades/compliance";

export const metadata: Metadata = { title: "Seguimiento de cursos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Coordinación y Rectoría: ¿cada docente cargó contenido, personalizó su curso
 * y subió notas y logros del periodo? Todo en una lista filtrable.
 */
export default async function SeguimientoCursosPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  if (!can(actor.role, "reportCards.preview")) redirect("/aula");

  const rawPillar = (await searchParams).pilar;
  const pillar = isStheamiPillar(rawPillar) ? rawPillar : null;
  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }
  const period = context.currentPeriod ?? context.periods.at(-1) ?? null;

  const [data, overview] = await Promise.all([
    listAulaCoursesForActor(actor, context.year.id),
    period ? getPeriodComplianceOverview(context.year.id, period.id) : Promise.resolve(null),
  ]);

  const compliance: Record<string, CourseCompliance> = {};
  for (const teacher of overview?.teachers ?? []) {
    for (const c of teacher.courses) {
      compliance[c.courseAssignmentId] = { gradesPercent: c.gradesPercent, logrosPercent: c.logrosPercent };
    }
  }

  const total = data.courses.length;
  const withContent = data.courses.filter((c) => c.unitCount > 0).length;
  const customized = data.courses.filter((c) => c.isCustomized).length;
  const gradesDone = Object.values(compliance).filter((k) => k.gradesPercent >= 100 && k.logrosPercent >= 100).length;

  const tiles = [
    { label: "Con contenido publicado", value: withContent },
    { label: "Personalizados por el docente", value: customized },
    { label: period ? `Notas y logros completos · ${period.name}` : "Notas y logros completos", value: gradesDone },
  ];

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-step-3">Seguimiento de cursos</h1>
        <p className="mt-1 text-muted">
          Revisa qué cursos ya tienen contenido, portada propia y notas al día. Usa los filtros para ver solo lo pendiente.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const pct = total > 0 ? Math.round((t.value / total) * 100) : 0;
          return (
            <li key={t.label} className="card grid gap-2 bg-white">
              <p className="text-xs font-bold text-muted uppercase">{t.label}</p>
              <p className="text-2xl font-black text-navy tabular">
                {t.value}
                <span className="text-base text-muted">/{total}</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div
                  className={`h-full rounded-full ${pct >= 100 ? "bg-green-solid" : "bg-cobalt"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <CourseDirectory
        courses={data.courses}
        mode="staff"
        compliance={compliance}
        periodName={period?.name}
        pillar={pillar}
      />
    </div>
  );
}
