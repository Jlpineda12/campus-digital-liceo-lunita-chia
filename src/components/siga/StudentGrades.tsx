import { ChevronDown, Link2, UserRound } from "lucide-react";
import { revealStyle } from "@/components/dashboard/parts";
import { Chip } from "@/components/ui/Chip";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { PILLAR_META } from "@/modules/core/academic-structure/stheami";
import {
  DIMENSION_LABELS,
  formatScore,
  isQualitativeLevel,
  QUALITATIVE_LABELS,
  weightedAverage,
  type QualitativeLevel,
} from "@/modules/siga/siee-grades/calculator";
import { parseLogroLines } from "@/modules/siga/siee-grades/logros";
import type { StudentSubjectGrades } from "@/modules/siga/siee-grades/queries";
import { getPerformanceLevel, roundScore, type SieeScale } from "@/modules/siga/siee-grades/scale";

const QUALITATIVE_TONE: Record<QualitativeLevel, "green" | "sky" | "orange"> = {
  ALCANZADO: "green",
  EN_PROCESO: "sky",
  REQUIERE_ACOMPANAMIENTO: "orange",
};

/**
 * Notas y logros de un estudiante en un periodo. Diseño aireado y calmo:
 * resumen compacto en una sola franja y detalles (dimensiones + logros + actividades)
 * desplegables por asignatura para evitar saturación visual.
 */
export function StudentGrades({ subjects, scale }: { subjects: StudentSubjectGrades[]; scale: SieeScale }) {
  const isQualitativeOnly =
    subjects.length > 0 &&
    subjects.every((s) => s.dimensions.length > 0 && s.dimensions.every((d) => d.dimension === "QUALITATIVE"));

  const finals = subjects.map((s) => s.result.final).filter((f): f is number => f !== null);
  const average = weightedAverage(finals.map((value) => ({ value, weight: 1 })));
  const lowCount = subjects.filter((s) => s.result.level === "BAJO").length;
  const graded = subjects.filter((s) => s.result.gradedColumns > 0).length;

  const qualValues = subjects.flatMap((s) =>
    s.dimensions.flatMap((d) => d.columns.map((c) => c.qualitative).filter(isQualitativeLevel)),
  );
  const qualCounts = {
    ALCANZADO: qualValues.filter((v) => v === "ALCANZADO").length,
    EN_PROCESO: qualValues.filter((v) => v === "EN_PROCESO").length,
    REQUIERE_ACOMPANAMIENTO: qualValues.filter((v) => v === "REQUIERE_ACOMPANAMIENTO").length,
  };

  return (
    <div className="grid gap-6">
      {/* Franja única de resumen (sin múltiples tarjetas pesadas) */}
      <section
        aria-label={isQualitativeOnly ? "Resumen cualitativo del periodo" : "Resumen del periodo"}
        className="card reveal grid divide-y divide-line p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        style={revealStyle(1)}
      >
        {isQualitativeOnly ? (
          <>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Logros alcanzados</p>
              <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
                {qualCounts.ALCANZADO}
                <span className="text-base font-semibold text-muted"> / {qualValues.length}</span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">En proceso</p>
              <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
                {qualCounts.EN_PROCESO}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Con acompañamiento</p>
              <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
                {qualCounts.REQUIERE_ACOMPANAMIENTO}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Promedio del periodo</p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="text-step-3 leading-none font-black text-navy tabular-nums">
                  {average === null ? "—" : formatScore(average)}
                </span>
                {average !== null && <PerformanceBadge level={getPerformanceLevel(roundScore(average), scale)} />}
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Asignaturas evaluadas</p>
              <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
                {graded}
                <span className="text-base font-semibold text-muted"> / {subjects.length}</span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Por reforzar</p>
              <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
                {lowCount}
                <span className="ml-2 align-middle text-xs font-semibold text-muted">
                  {lowCount === 0 ? "Todo al día" : "en desempeño bajo"}
                </span>
              </p>
            </div>
          </>
        )}
      </section>

      {subjects.length === 0 ? (
        <TactileCard className="text-center text-muted">Aún no hay asignaturas para mostrar.</TactileCard>
      ) : (
        <section aria-label="Detalle por asignatura" className="grid gap-2.5">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 className="text-base font-bold text-navy">Asignaturas ({subjects.length})</h2>
            <p className="text-xs text-muted">Haz clic en una asignatura para ver sus logros y actividades</p>
          </div>

          <ul className="grid gap-2.5">
            {subjects.map((subject) => {
              const tone = PILLAR_META[subject.pillar].tone;
              const latestQual = subject.dimensions
                .flatMap((d) => d.columns.map((c) => c.qualitative).filter(isQualitativeLevel))
                .at(-1);

              return (
                <li key={subject.courseAssignmentId}>
                  <details className={`card course-card-detail t-${tone} group p-0`}>
                    <summary className="flex cursor-pointer list-none items-center gap-3.5 px-5 py-3.5">
                      <StheamiBadge pillar={subject.pillar} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-navy">{subject.subjectName}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <UserRound className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{subject.teacherName ?? "Docente por asignar"}</span>
                          <span aria-hidden>·</span>
                          <span>{PILLAR_META[subject.pillar].name}</span>
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        {subject.result.final !== null ? (
                          <PerformanceBadge score={subject.result.final} scale={scale} />
                        ) : latestQual ? (
                          <Chip tone={QUALITATIVE_TONE[latestQual]}>{QUALITATIVE_LABELS[latestQual]}</Chip>
                        ) : (
                          <span className="text-xs font-semibold text-muted">Sin notas</span>
                        )}
                        <ChevronDown
                          className="size-4 text-muted transition-transform duration-200 group-open:rotate-180"
                          aria-hidden
                        />
                      </div>
                    </summary>

                    <div className="grid gap-5 border-t border-line bg-bg-2/40 px-5 py-4 md:grid-cols-3">
                      {subject.dimensions.map((d) => {
                        const logroLines = parseLogroLines(d.description);
                        const dimScore = subject.result.byDimension[d.competencyId];
                        return (
                          <section
                            key={d.competencyId}
                            aria-label={DIMENSION_LABELS[d.dimension]}
                            className="grid content-start gap-2.5 rounded-control bg-white p-3.5 ring-1 ring-line"
                          >
                            <div className="flex items-baseline justify-between gap-2 border-b border-line/70 pb-2">
                              <h3 className="text-sm font-bold text-navy">
                                {DIMENSION_LABELS[d.dimension]}
                                {d.dimension !== "QUALITATIVE" && (
                                  <span className="ml-1.5 text-xs font-medium text-muted tabular">
                                    ({d.weightPercent}%)
                                  </span>
                                )}
                              </h3>
                              {d.dimension !== "QUALITATIVE" && (
                                <span className="text-sm font-extrabold text-navy tabular">
                                  {formatScore(dimScore)}
                                </span>
                              )}
                            </div>

                            {logroLines.length > 0 && (
                              <div className="rounded-md bg-cloud/70 px-2.5 py-2">
                                <p className="text-[0.68rem] font-extrabold tracking-wider text-sky-solid uppercase">
                                  Logro del periodo
                                </p>
                                <ul className="mt-1 grid gap-1 text-xs leading-relaxed text-ink-2">
                                  {logroLines.map((line, idx) => (
                                    <li key={idx}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {d.columns.length === 0 ? (
                              <p className="text-xs text-muted">Sin actividades registradas.</p>
                            ) : (
                              <ul className="grid gap-1.5 text-sm">
                                {d.columns.map((c) => (
                                  <li key={c.id} className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-ink-2">
                                      {c.linked && (
                                        <Link2
                                          className="mr-1 inline size-3.5 text-sky-solid"
                                          aria-label="Aula Virtual"
                                        />
                                      )}
                                      {c.title}
                                    </span>
                                    <span className="shrink-0 font-bold text-navy tabular">
                                      {isQualitativeLevel(c.qualitative)
                                        ? QUALITATIVE_LABELS[c.qualitative]
                                        : formatScore(c.score)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
