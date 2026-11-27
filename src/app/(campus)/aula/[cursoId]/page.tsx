import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  Link2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseBanner } from "@/components/aula/CourseBanner";
import { CourseBuilderControls } from "@/components/aula/CourseBuilderControls";
import { CourseForumPanel } from "@/components/aula/CourseForumPanel";
import { CourseProgressPath } from "@/components/aula/CourseProgressPath";
import { CourseThemeCustomizer } from "@/components/aula/CourseThemeCustomizer";
import { ResourceItemRow } from "@/components/aula/ResourceItemRow";
import { PeriodTabs } from "@/components/siga/PeriodTabs";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { resolveCourseAccess } from "@/modules/aula/access";
import { getCourseWorkspace } from "@/modules/aula/queries";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Curso · Órbita Virtual" };

type Params = Promise<{ cursoId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dueFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "America/Bogota",
});

export default async function CursoWorkspacePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const actor = await requireSession();
  const { cursoId } = await params;
  if (!UUID_RE.test(cursoId)) notFound();

  const [access, context] = await Promise.all([
    resolveCourseAccess(actor, cursoId),
    getCurrentAcademicContext(),
  ]);
  if (!access || !context) notFound();

  const sp = await searchParams;
  const requestedPeriod = single(sp.periodo);
  const period =
    context.periods.find((p) => p.id === requestedPeriod) ??
    context.currentPeriod ??
    context.periods[0];
  if (!period) notFound();

  const activeTab = single(sp.tab) === "avisos" ? "avisos" : "contenido";

  const [workspace, scale] = await Promise.all([
    getCourseWorkspace(access, period.id),
    getScaleForYear(access.course.academicYearId),
  ]);

  const isFamily = actor.role === "STUDENT" || actor.role === "GUARDIAN";
  const stage = isFamily ? stageForLevel(workspace.levelCode) : undefined;
  const baseHref = `/aula/${cursoId}?periodo=${period.id}`;
  const isCompactLayout = workspace.theme.layoutStyle === "compact";

  // Para el estudiante: lo siguiente por hacer en ESTE curso, y qué unidades ya terminó.
  const nextUp = isFamily
    ? workspace.units
        .flatMap((u) => u.activities.map((a) => ({ ...a, unitId: u.id, unitTitle: u.title })))
        .filter((a) => a.studentStatus === "PENDING")
        .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0] ?? null
    : null;
  const unitIsDone = (u: (typeof workspace.units)[number]) =>
    u.resources.length + u.activities.length > 0 &&
    u.resources.every((r) => r.viewed) &&
    u.activities.every((a) => a.studentStatus === "SUBMITTED" || a.studentStatus === "GRADED");

  return (
    <div data-stage={stage} className="grid gap-6">
      <header className="grid gap-4">
        <Link
          href="/aula"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-sky-solid no-underline hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a Mis cursos
        </Link>

        <CourseBanner
          courseAssignmentId={cursoId}
          subjectName={access.course.subjectName}
          groupName={access.course.groupName}
          gradeName={access.course.gradeName}
          teacherName={access.course.teacherName}
          periodName={period.name}
          pillar={access.course.pillar}
          theme={workspace.theme}
          subtitleRight={!isFamily ? `${workspace.totalStudents} estudiantes` : undefined}
          actions={
            access.canManage ? (
              <>
                <CourseThemeCustomizer
                  courseAssignmentId={cursoId}
                  subjectName={access.course.subjectName}
                  groupName={access.course.groupName}
                  gradeName={access.course.gradeName}
                  teacherName={access.course.teacherName}
                  periodName={period.name}
                  pillar={access.course.pillar}
                  initialTheme={workspace.theme}
                />
                <Link
                  href={`/siga/calificaciones?curso=${cursoId}&periodo=${period.id}`}
                  className="inline-flex items-center gap-1.5 rounded-control border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white no-underline backdrop-blur-xs transition-colors hover:bg-white/25"
                >
                  <Link2 className="size-3.5 text-yellow" aria-hidden />
                  Ver planilla SIGA
                </Link>
              </>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <PeriodTabs
            periods={context.periods}
            selectedId={period.id}
            hrefFor={(id) => `/aula/${cursoId}?periodo=${id}${activeTab === "avisos" ? "&tab=avisos" : ""}`}
          />

          <nav aria-label="Secciones del curso" className="inline-flex rounded-control border border-line bg-bg-2 p-1">
            <Link
              href={baseHref}
              aria-current={activeTab === "contenido" ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold no-underline transition-colors",
                activeTab === "contenido" ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy",
              )}
            >
              <Layers className="size-4" aria-hidden />
              Contenido y tareas
            </Link>
            <Link
              href={`${baseHref}&tab=avisos`}
              aria-current={activeTab === "avisos" ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold no-underline transition-colors",
                activeTab === "avisos" ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy",
              )}
            >
              <MessageSquare className="size-4" aria-hidden />
              Avisos ({workspace.forumPosts.length})
            </Link>
          </nav>
        </div>

        {access.canManage && activeTab === "contenido" && (
          <CourseBuilderControls
            courseAssignmentId={cursoId}
            periodId={period.id}
            units={workspace.units.map((u) => ({ id: u.id, title: u.title }))}
            availableDimensions={workspace.availableDimensions}
          />
        )}
      </header>

      {activeTab === "avisos" ? (
        <CourseForumPanel
          courseAssignmentId={cursoId}
          posts={workspace.forumPosts}
          canPost={access.canPostForum}
          canPin={access.canManage}
        />
      ) : workspace.units.length === 0 ? (
        <TactileCard className="grid gap-1.5 py-10 text-center">
          <Layers className="mx-auto size-8 text-muted/50" aria-hidden />
          <p className="font-bold text-navy">Aún no hay unidades publicadas en {period.name}</p>
          <p className="text-sm text-muted">
            {access.canManage
              ? "Usa el botón «Nueva unidad» arriba para organizar tus guías PDF, tareas y cuestionarios de este periodo."
              : "Cuando tu docente publique guías, tareas o cuestionarios en este periodo aparecerán aquí."}
          </p>
        </TactileCard>
      ) : (
        <div className="grid gap-5">
          {nextUp && (
            <Link
              href={nextUp.type === "QUIZ" ? `/aula/${cursoId}/quiz/${nextUp.id}` : `/aula/${cursoId}/tareas/${nextUp.id}`}
              className="group flex flex-wrap items-center gap-4 rounded-2xl border-2 border-cobalt/30 bg-cloud/60 px-5 py-4 no-underline transition-colors hover:border-cobalt/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cobalt text-yellow">
                {nextUp.type === "QUIZ" ? <Sparkles className="size-5" aria-hidden /> : <ClipboardList className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold tracking-wide text-cobalt uppercase">Sigue aquí</span>
                <span className="block truncate font-bold text-navy">{nextUp.title}</span>
                <span className="block truncate text-xs text-muted">
                  {nextUp.unitTitle}
                  {nextUp.dueDate ? ` · ${nextUp.type === "QUIZ" ? "Cierra" : "Entrega"} ${dueFormat.format(nextUp.dueDate)}` : ""}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-extrabold text-cobalt">
                {nextUp.type === "QUIZ" ? "Presentar" : "Abrir"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          )}
          <CourseProgressPath units={workspace.units} isFamily={isFamily} />

          <div className={isCompactLayout ? "grid gap-3" : "grid gap-5"}>
          {workspace.units.map((unit, idx) => {
            const unitTotal = unit.resources.length + unit.activities.length;
            const unitDone = isFamily
              ? unit.resources.filter((r) => r.viewed).length +
                unit.activities.filter((a) => a.studentStatus === "SUBMITTED" || a.studentStatus === "GRADED").length
              : 0;
            const unitBody = (
              <>
                {unit.resources.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-xs font-extrabold tracking-wider text-muted uppercase">
                      Material de estudio ({unit.resources.length})
                    </h3>
                    <div className="grid gap-2">
                      {unit.resources.map((res) => (
                        <ResourceItemRow
                          key={res.id}
                          courseAssignmentId={cursoId}
                          resource={res}
                          canMarkViewed={access.canSubmit}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {unit.activities.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-xs font-extrabold tracking-wider text-muted uppercase">
                      Tareas y cuestionarios ({unit.activities.length})
                    </h3>
                    <ul className="divide-y divide-line rounded-control border border-line bg-white">
                      {unit.activities.map((act) => {
                        const isQuiz = act.type === "QUIZ";
                        const href = isQuiz
                          ? `/aula/${cursoId}/quiz/${act.id}`
                          : `/aula/${cursoId}/tareas/${act.id}`;
                        return (
                          <li key={act.id}>
                            <Link
                              href={href}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 no-underline transition-colors hover:bg-cloud/60"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                {isQuiz ? (
                                  <Sparkles className="mt-0.5 size-4 shrink-0 text-purple-solid" aria-hidden />
                                ) : (
                                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden />
                                )}
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-bold text-navy">{act.title}</p>
                                    {isQuiz && (
                                      <span className="rounded-pill bg-purple-l px-2 py-0.5 text-[0.68rem] font-extrabold text-purple-solid">
                                        Cuestionario
                                        {act.questionCount > 0 ? ` · ${act.questionCount} preg.` : ""}
                                        {act.timeLimitMinutes ? ` · ${act.timeLimitMinutes} min` : ""}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                    {act.dueDate && (
                                      <span>
                                        {isQuiz ? "Cierre" : "Entrega"}: {dueFormat.format(act.dueDate)}
                                      </span>
                                    )}
                                    {act.syncToSiga && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-sky-solid">
                                        <Link2 className="size-3" aria-hidden />
                                        {isFamily ? "Cuenta para la nota" : `SIGA${act.sigaLabel ? ` (${act.sigaLabel})` : ""}`}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2.5">
                                {act.studentStatus === "GRADED" && act.studentScore !== null ? (
                                  <PerformanceBadge score={act.studentScore} scale={scale} />
                                ) : act.studentStatus === "SUBMITTED" ? (
                                  <Chip tone="sky">
                                    <CheckCircle2 aria-hidden /> Entregada
                                  </Chip>
                                ) : act.studentStatus === "PENDING" ? (
                                  <Chip tone="orange">
                                    <Clock aria-hidden /> {isQuiz ? "Por presentar" : "Pendiente"}
                                  </Chip>
                                ) : (
                                  <span className="text-xs font-semibold text-muted tabular">
                                    {isQuiz
                                      ? `${act.submittedCount}/${workspace.totalStudents} completados`
                                      : `${act.submittedCount}/${workspace.totalStudents} entregas · ${act.gradedCount} calif.`}
                                  </span>
                                )}
                                <ArrowRight className="size-4 text-muted" aria-hidden />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {unit.resources.length === 0 && unit.activities.length === 0 && (
                  <p className="text-xs text-muted">Esta unidad aún no tiene materiales ni tareas publicadas.</p>
                )}
              </>
            );

            const done = isFamily && unitIsDone(unit);
            if (isCompactLayout || done) {
              return (
                <details
                  key={unit.id}
                  id={`modulo-${unit.id}`}
                  open={isFamily ? !done && (nextUp ? nextUp.unitId === unit.id : idx === 0) : idx === 0}
                  className="card group bg-white p-0 open:pb-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-cloud/40">
                    <div>
                      <span className="text-[0.68rem] font-extrabold tracking-wider text-sky-solid uppercase">
                        Módulo {idx + 1}
                      </span>
                      <h2 className="text-base font-bold text-navy">{unit.title}</h2>
                    </div>
                    <span className={cx("text-xs font-semibold tabular", done ? "text-green-solid" : "text-muted")}>
                      {done
                        ? "✓ Completado"
                        : isFamily && unitTotal > 0
                        ? `${unitDone}/${unitTotal} completado`
                        : `${unit.resources.length} rec. · ${unit.activities.length} act.`}
                    </span>
                  </summary>
                  <div className="grid gap-4 border-t border-line px-5 pt-4">{unitBody}</div>
                </details>
              );
            }

            return (
              <section key={unit.id} id={`modulo-${unit.id}`} className="card grid gap-4 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <p className="text-[0.68rem] font-extrabold tracking-wider text-cobalt uppercase">
                      Módulo {idx + 1}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-navy">{unit.title}</h2>
                    {unit.description && <p className="mt-1 text-sm text-muted">{unit.description}</p>}
                  </div>
                  {isFamily && unitTotal > 0 && (
                    <Chip tone={unitDone === unitTotal ? "green" : "sky"}>
                      {unitDone === unitTotal ? "Módulo completado" : `${unitDone}/${unitTotal} avance`}
                    </Chip>
                  )}
                </div>
                {unitBody}
              </section>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
