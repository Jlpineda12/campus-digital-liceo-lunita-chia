import { AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { PILLAR_META } from "@/modules/core/academic-structure/stheami";
import type { AnnualSummary } from "@/modules/siga/report-cards/annual-summary";
import { formatScore } from "@/modules/siga/siee-grades/calculator";

/**
 * Boletín final del año: una fila por asignatura con la nota de cada periodo
 * y la definitiva ponderada. Pensado para leerse de un vistazo (y para
 * imprimirse desde el navegador si la familia lo necesita).
 */
export function AnnualReportCard({
  summary,
  studentName,
  groupLabel,
  yearName,
}: {
  summary: AnnualSummary;
  studentName: string;
  groupLabel: string;
  yearName: string;
}) {
  const { periods, subjects } = summary;

  return (
    <article className="card grid gap-5 bg-white p-0" aria-labelledby="annual-title">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-5">
        <div>
          <p className="kicker">Boletín final · {yearName}</p>
          <h2 id="annual-title" className="mt-1 text-step-2">
            {studentName}
          </h2>
          <p className="text-sm text-muted">{groupLabel}</p>
        </div>
        <div className="grid justify-items-end gap-1.5 text-right">
          <p className="text-xs font-bold text-muted uppercase">
            {summary.isPartial ? "Promedio parcial" : "Promedio del año"}
          </p>
          <p className="text-3xl font-black text-navy tabular">{formatScore(summary.overallAverage)}</p>
          {summary.overallLevel && <PerformanceBadge level={summary.overallLevel} />}
        </div>
      </header>

      {summary.isPartial && summary.includedCount > 0 && (
        <p className="mx-6 flex items-start gap-2 rounded-control bg-cloud px-3.5 py-2.5 text-sm text-ink-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden />
          <span>
            Definitiva <strong>parcial</strong>: incluye {summary.includedCount} de {periods.length} periodos. Se
            completa cuando Rectoría habilite los boletines que faltan.
          </span>
        </p>
      )}

      <div className="overflow-x-auto px-2 sm:px-6">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Notas por periodo y definitiva de cada asignatura</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th scope="col" className="py-2 pr-3 font-bold">Asignatura</th>
              {periods.map((p) => (
                <th key={p.id} scope="col" className="px-2 py-2 text-center font-bold" title={`${p.name} · ${p.weightPercent}%`}>
                  P{p.number}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-center font-extrabold text-navy">Definitiva</th>
              <th scope="col" className="py-2 pl-2 font-bold">Desempeño</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {subjects.map((s) => (
              <tr key={s.courseAssignmentId}>
                <th scope="row" className="py-3 pr-3 text-left font-bold text-navy">
                  <span className="mr-2 inline-grid size-6 place-items-center rounded-md bg-bg-2 text-[0.7rem] font-black text-cobalt" title={PILLAR_META[s.pillar].name}>
                    {s.pillar}
                  </span>
                  {s.subjectName}
                </th>
                {s.finals.map((f, i) => (
                  <td key={periods[i]?.id ?? i} className="px-2 py-3 text-center text-ink-2 tabular">
                    {periods[i]?.included ? formatScore(f) : <Lock className="mx-auto size-3.5 text-muted/60" aria-label="sin habilitar" />}
                  </td>
                ))}
                <td className="px-2 py-3 text-center text-base font-black text-navy tabular">{formatScore(s.annual)}</td>
                <td className="py-3 pl-2">{s.level ? <PerformanceBadge level={s.level} /> : <span className="text-xs text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {summary.includedCount === 0
              ? "Tu boletín final se irá llenando a medida que Rectoría habilite los boletines de cada periodo."
              : "Aún no hay notas registradas este año."}
          </p>
        )}
      </div>

      <footer className="grid gap-3 border-t border-line px-6 py-5">
        {summary.lowSubjects.length > 0 ? (
          <div className="flex items-start gap-2.5 rounded-control border border-orange-solid/30 bg-orange-l/50 px-3.5 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-solid" aria-hidden />
            <div>
              <p className="font-bold text-navy">
                {summary.lowSubjects.length === 1 ? "1 asignatura" : `${summary.lowSubjects.length} asignaturas`} en
                desempeño Bajo
              </p>
              <p className="mt-0.5 flex flex-wrap gap-1.5">
                {summary.lowSubjects.map((name) => (
                  <Chip key={name} tone="orange">{name}</Chip>
                ))}
              </p>
            </div>
          </div>
        ) : (
          subjects.some((s) => s.annual !== null) && (
            <p className="flex items-center gap-2 text-sm font-bold text-green-solid">
              <CheckCircle2 className="size-4" aria-hidden /> Todas las asignaturas en desempeño Básico o superior.
            </p>
          )
        )}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          La definitiva pondera cada periodo según su peso. La promoción al siguiente grado y las actividades de
          recuperación las define la Comisión de Evaluación y Promoción (Decreto 1290 de 2009 y SIEE institucional).
        </p>
      </footer>
    </article>
  );
}
