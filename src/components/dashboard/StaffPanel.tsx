import { BookOpen, CircleAlert, Lock, LockOpen, School, Star, UsersRound } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { formatDateRange } from "@/modules/core/academic-structure/dates";
import type { AcademicContext, InstitutionOverview } from "@/modules/core/academic-structure/queries";
import { DEFAULT_SIEE_SCALE, describeScale } from "@/modules/siga/siee-grades/scale";
import { PillarMap, SectionHeader, StatTile } from "./parts";

export function StaffPanel({
  overview,
  context,
}: {
  overview: InstitutionOverview;
  context: AcademicContext;
}) {
  const { totals } = overview;
  const maxLevel = Math.max(...overview.byLevel.map((l) => l.students), 1);
  const scale = { ...DEFAULT_SIEE_SCALE, minPassing: context.year.minPassingScore };

  return (
    <div className="grid gap-8">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores institucionales">
        <li>
          <StatTile icon={Star} tone="sky" value={totals.students} label="Estudiantes activos" index={1} />
        </li>
        <li>
          <StatTile icon={BookOpen} tone="purple" value={totals.teachers} label="Docentes" index={2} />
        </li>
        <li>
          <StatTile icon={School} tone="yellow" value={totals.groups} label="Grupos" index={3} />
        </li>
        <li>
          <StatTile icon={UsersRound} tone="green" value={totals.guardians} label="Acudientes" index={4} />
        </li>
      </ul>

      {totals.unassignedCourses > 0 && (
        <p
          role="status"
          className="flex items-start gap-3 rounded-card border border-orange bg-orange-l px-4 py-3 font-bold text-navy"
        >
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-orange-solid" aria-hidden />
          Hay {totals.unassignedCourses} cargas académicas sin docente asignado.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="periodos">
          <SectionHeader
            id="periodos"
            title="Periodos académicos"
            description={`${context.year.name} · nota mínima aprobatoria ${context.year.minPassingScore.toFixed(1)}`}
          />
          <TactileCard className="p-0">
            <ul>
              {context.periods.map((p) => {
                const isCurrent = p.id === context.currentPeriod?.id;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-cloud/60"
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-icon-sm text-lg font-black ${
                        isCurrent ? "bg-yellow text-navy" : "bg-cloud text-navy"
                      }`}
                    >
                      {p.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-navy">
                        {p.name}
                        {isCurrent && <span className="sr-only"> (vigente)</span>}
                      </p>
                      <p className="text-sm font-semibold text-muted">
                        {formatDateRange(p.startDate, p.endDate)} · {p.weightPercent}%
                      </p>
                    </div>
                    {p.gradesLocked ? (
                      <Chip tone="red">
                        <Lock aria-hidden /> Cerrado
                      </Chip>
                    ) : (
                      <Chip tone="green">
                        <LockOpen aria-hidden /> Abierto
                      </Chip>
                    )}
                  </li>
                );
              })}
            </ul>
          </TactileCard>
        </section>

        <section aria-labelledby="niveles" className="grid content-start gap-6">
          <div>
            <SectionHeader id="niveles" title="Estudiantes por nivel" />
            <TactileCard>
              <ul className="grid gap-4">
                {overview.byLevel.map((l) => (
                  <li key={l.levelName}>
                    <div className="flex items-baseline justify-between text-sm font-extrabold text-navy">
                      <span>{l.levelName}</span>
                      <span className="tabular-nums">
                        {l.students} <span className="font-bold text-muted">· {l.groups} grupos</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-cloud" aria-hidden>
                      <div
                        className="progress-fill h-full rounded-pill bg-sky-solid"
                        style={{ width: `${Math.round((l.students / maxLevel) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </TactileCard>
          </div>

          <TactileCard>
            <h2 className="text-lg">Escala de valoración SIEE</h2>
            <p className="mt-1 text-sm text-muted">Decreto 1290 · conversión automática de notas.</p>
            <ul className="mt-4 grid gap-2">
              {describeScale(scale).map((row) => (
                <li key={row.level} className="flex items-center justify-between gap-3">
                  <PerformanceBadge level={row.level} />
                  <span className="font-extrabold text-navy tabular-nums">
                    {row.from} – {row.to}
                  </span>
                </li>
              ))}
            </ul>
          </TactileCard>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="grupos">
          <SectionHeader id="grupos" title="Grupos del año lectivo" />
          <div className="card overflow-x-auto p-0">
            <table className="tactile-table">
              <caption className="sr-only">Grupos con director y ocupación</caption>
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Nivel
                  </th>
                  <th scope="col">Director(a)</th>
                  <th scope="col" className="text-right">
                    Cupo
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.groups.map((g) => (
                  <tr key={g.groupId}>
                    <td>
                      <span className="font-extrabold text-navy">{g.groupName}</span>
                      <span className="block text-xs font-bold text-muted">{g.gradeName}</span>
                    </td>
                    <td className="hidden sm:table-cell">{g.levelName}</td>
                    <td className="text-navy">{g.directorName ?? "Por asignar"}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {g.studentCount}/{g.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <PillarMap
            counts={Object.fromEntries(overview.pillars.map((p) => [p.pillar, p.subjects]))}
            caption={`${totals.subjects} asignaturas y ${totals.courseAssignments} cargas académicas.`}
          />
        </aside>
      </div>
    </div>
  );
}
