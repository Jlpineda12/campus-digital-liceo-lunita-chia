import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseEmblemIcon } from "@/components/aula/CourseBanner";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { listAulaCoursesForActor } from "@/modules/aula/queries";
import { resolveBannerGradient } from "@/modules/aula/themes";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { PILLAR_META } from "@/modules/core/academic-structure/stheami";
import { requireSession } from "@/modules/core/auth/guards";
import { PLATFORM_SPACES } from "@/modules/core/brand/config";
import { stageForLevel } from "@/modules/core/dashboard/stage";

export const metadata: Metadata = { title: "Órbita Virtual · Mis cursos" };

export default async function AulaHomePage() {
  const actor = await requireSession();
  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const data = await listAulaCoursesForActor(actor, context.year.id);
  const isFamily = actor.role === "STUDENT" || actor.role === "GUARDIAN";
  const stage = isFamily && data.viewerLevelCode ? stageForLevel(data.viewerLevelCode) : undefined;
  const isPrimaria = stage === "primaria";

  const totalUnits = data.courses.reduce((s, c) => s + c.unitCount, 0);
  const totalActivities = data.courses.reduce((s, c) => s + c.activityCount, 0);

  return (
    <div data-stage={stage} className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <PlatformLogo space="aula" size={50} className="shrink-0" />
          <div>
            <p className="kicker">
              {PLATFORM_SPACES.aula.name}
              {data.viewerGroupLabel ? ` · ${data.viewerGroupLabel}` : ` · ${context.year.name}`}
            </p>
            <h1 className="mt-0.5 text-step-3">
              {actor.role === "GUARDIAN" && data.viewerStudentName
                ? `Cursos de ${data.viewerStudentName}`
                : isPrimaria
                  ? "¡Tus cursos y aventuras!"
                  : actor.role === "TEACHER"
                    ? "Mis cursos en Órbita Virtual"
                    : "Mis cursos"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {isFamily
                ? "Guías, videos, tareas y avisos organizados por asignatura y conectados con SIGA."
                : "Publica unidades, materiales y tareas conectadas automáticamente a tu planilla SIEE."}
            </p>
          </div>
        </div>

        {isFamily && (
          <Link href="/aula/tareas" className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <ClipboardCheck aria-hidden />
            ¿Qué tareas tengo?
            {data.totalPending > 0 && (
              <span className="rounded-pill bg-yellow px-1.5 py-0.2 text-xs font-black text-navy tabular">
                {data.totalPending}
              </span>
            )}
          </Link>
        )}
      </header>

      {/* Franja única de resumen */}
      <section
        aria-label="Resumen de Órbita Virtual"
        className="card grid divide-y divide-line p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Cursos activos</p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.courses.length}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Unidades y tareas</p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {totalUnits}
            <span className="ml-2 text-xs font-semibold text-muted">
              unidades · {totalActivities} tareas
            </span>
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">
            {isFamily ? "Tareas pendientes" : "Entregas por calificar"}
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.totalPending}
            <span className="ml-2 text-xs font-semibold text-muted">
              {data.totalPending === 0 ? "Todo al día" : isFamily ? "por entregar" : "esperando nota"}
            </span>
          </p>
        </div>
      </section>

      {data.courses.length === 0 ? (
        <TactileCard className="py-10 text-center text-muted">
          No encontramos cursos asignados para este año lectivo.
        </TactileCard>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((course) => {
            const pillarMeta = PILLAR_META[course.pillar];
            const bannerGradient = resolveBannerGradient(course.theme);
            const progressPct =
              isFamily && course.resourceCount > 0
                ? Math.round((course.viewedResourceCount / course.resourceCount) * 100)
                : null;

            return (
              <li key={course.courseAssignmentId}>
                <Link
                  href={`/aula/${course.courseAssignmentId}`}
                  className={`card card-interactive t-${pillarMeta.tone} flex h-full flex-col gap-4 overflow-hidden p-0`}
                >
                  {/* Franja de color o imagen personalizada por el docente */}
                  <div
                    className="relative flex items-center justify-between overflow-hidden px-4 py-3 text-white"
                    style={{ background: bannerGradient }}
                  >
                    {course.theme.hasBannerImage && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/aula/archivos?tipo=banner&id=${course.courseAssignmentId}`}
                          alt=""
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-navy/60"
                        />
                      </>
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5 text-xs font-extrabold">
                      <CourseEmblemIcon iconKey={course.theme.iconKey} className="size-4 text-yellow" />
                      {course.groupName}
                    </span>
                    <div className="relative z-10">
                      <StheamiBadge pillar={course.pillar} size="sm" />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
                    <div className="min-w-0">
                      <p className="line-clamp-2 leading-snug font-extrabold text-navy">{course.subjectName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {isFamily
                          ? course.teacherName ?? "Docente por asignar"
                          : `${course.groupName} · ${course.gradeName}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3.5" aria-hidden />
                        {course.unitCount} {course.unitCount === 1 ? "unidad" : "unidades"}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="size-3.5" aria-hidden />
                        {course.activityCount} {course.activityCount === 1 ? "actividad" : "actividades"}
                      </span>
                    </div>

                    {progressPct !== null && (
                      <div>
                        <div className="flex justify-between text-[0.7rem] font-semibold text-muted tabular">
                          <span>Material revisado</span>
                          <span className="text-navy">{progressPct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-green-solid" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                      {course.pendingCount > 0 ? (
                        <Chip tone="orange">
                          {course.pendingCount}{" "}
                          {isFamily
                            ? course.pendingCount === 1
                              ? "pendiente"
                              : "pendientes"
                            : "por calificar"}
                        </Chip>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-solid">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Al día
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-solid">
                        Entrar <ArrowRight className="size-3.5" aria-hidden />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
