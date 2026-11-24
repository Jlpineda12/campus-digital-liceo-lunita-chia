import { GraduationCap, UsersRound } from "lucide-react";
import { IconBubble } from "@/components/ui/IconBubble";
import { TactileCard } from "@/components/ui/TactileCard";
import { ASSESSMENT_MODE_LABELS } from "@/modules/core/academic-structure/constants";
import type { StudentView } from "@/modules/core/dashboard/service";
import { CourseGrid, PillarMap, SectionHeader } from "./parts";
import { StudentVisualInsights } from "./StudentVisualInsights";

/**
 * Bloque académico de un estudiante (panel del estudiante y del acudiente).
 * Evita repetir métricas del periodo ya visibles en la portada y hace clicable
 * cada asignatura para entrar directamente a su curso en Órbita Virtual.
 */
export function StudentPanel({
  view,
  audience,
}: {
  view: StudentView;
  audience: "self" | "guardian";
}) {
  const { placement, courses, stage } = view;
  const weeklyHours = courses.reduce((sum, c) => sum + c.weeklyHours, 0);
  const pillarCounts = courses.reduce<Record<string, number>>((acc, c) => {
    acc[c.pillar] = (acc[c.pillar] ?? 0) + 1;
    return acc;
  }, {});
  const isPrimaria = stage === "primaria";

  const coursesTitle =
    audience === "guardian"
      ? `Asignaturas de ${view.firstName}`
      : isPrimaria
        ? "Mis materias"
        : "Mis asignaturas";
  const coursesDescription = placement
    ? isPrimaria
      ? `${courses.length} materias y ${weeklyHours} horas a la semana. Toca cualquiera para entrar.`
      : `${courses.length} asignaturas · ${weeklyHours} h semanales · Haz clic en cualquiera para abrir Órbita Virtual.`
    : "Sin matrícula activa en el año lectivo actual.";

  return (
    <div data-stage={stage} className="grid gap-6">
      {placement && (
        <StudentVisualInsights
          firstName={view.firstName}
          isPrimaria={isPrimaria}
          periodTrend={view.periodTrend}
          orbitProgress={view.orbitProgress}
          courses={courses}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby={`asignaturas-${view.studentId}`}>
          <SectionHeader
            id={`asignaturas-${view.studentId}`}
            title={coursesTitle}
            description={coursesDescription}
          />
          <CourseGrid courses={courses} />
        </section>

        <aside className="grid content-start gap-4">
          <TactileCard tone="sky">
            <div className="flex items-center gap-3">
              <IconBubble tone="sky" size="sm">
                <UsersRound />
              </IconBubble>
              <h2 className="text-lg">{audience === "self" ? "Mi grupo" : "Grupo"}</h2>
            </div>
            {placement ? (
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-bold tracking-wide text-muted uppercase">Grado y grupo</dt>
                  <dd className="text-base font-extrabold text-navy">
                    {placement.gradeName} · {placement.groupName}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold tracking-wide text-muted uppercase">Director(a) de grupo</dt>
                  <dd className="text-base font-bold text-navy">{placement.directorName ?? "Por asignar"}</dd>
                </div>
                <div>
                  <dt className="font-bold tracking-wide text-muted uppercase">Valoración</dt>
                  <dd className="flex items-center gap-1.5 font-bold text-navy">
                    <GraduationCap className="size-4 text-sky-solid" aria-hidden />
                    {ASSESSMENT_MODE_LABELS[placement.assessmentMode]}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">Comunícate con Secretaría para verificar la matrícula.</p>
            )}
          </TactileCard>

          {courses.length > 0 && (
            <PillarMap counts={pillarCounts} caption="Asignaturas por pilar del modelo pedagógico." />
          )}
        </aside>
      </div>
    </div>
  );
}
