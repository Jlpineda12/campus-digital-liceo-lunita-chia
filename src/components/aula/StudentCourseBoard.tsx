import { ArrowRight, CheckCircle2, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CourseEmblemIcon } from "@/components/aula/CourseBanner";
import { StheamiIcon } from "@/components/brand/StheamiIcon";
import type { AulaCourseCard } from "@/modules/aula/queries";
import { resolveBannerGradient } from "@/modules/aula/themes";
import { PILLAR_META, STHEAMI_PILLARS, type StheamiPillar } from "@/modules/core/academic-structure/stheami";

/**
 * «Mis cursos» del estudiante: materias en el orden S-T-H-E-A-M-I. Si llega
 * `?pilar=X` (desde los bloques STHEAMI del Inicio) se muestran solo las de
 * ese pilar, con lo pendiente primero. Cada tarjeta respeta la portada del docente.
 */
export function StudentCourseBoard({
  courses,
  pillar,
}: {
  courses: AulaCourseCard[];
  pillar: StheamiPillar | null;
}) {
  const order = (p: StheamiPillar) => STHEAMI_PILLARS.indexOf(p);
  const visible = courses
    .filter((c) => !pillar || c.pillar === pillar)
    .sort(
      (a, b) =>
        (pillar ? b.pendingCount - a.pendingCount : order(a.pillar) - order(b.pillar)) ||
        a.subjectName.localeCompare(b.subjectName, "es"),
    );
  const meta = pillar ? PILLAR_META[pillar] : null;

  return (
    <section
      aria-label={meta ? `Materias de ${meta.name}` : "Todas mis materias"}
      className={meta ? `pillar-shelf t-${meta.tone}` : "pillar-shelf"}
    >
      {meta && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="pillar-shelf__title">
            <StheamiIcon pillar={meta.letter} size={30} />
            {meta.name}
            <span className="pillar-shelf__count">
              {visible.length} {visible.length === 1 ? "materia" : "materias"}
            </span>
          </h2>
          <Link
            href="/aula"
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-navy no-underline hover:bg-cloud"
          >
            <X className="size-3.5" aria-hidden /> Ver todas las materias
          </Link>
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((course, i) => (
          <li key={course.courseAssignmentId} className="course-pop" style={{ "--i": i } as CSSProperties}>
            <CourseCard course={course} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CourseCard({ course }: { course: AulaCourseCard }) {
  const meta = PILLAR_META[course.pillar];
  const progress =
    course.resourceCount > 0 ? Math.round((course.viewedResourceCount / course.resourceCount) * 100) : null;

  return (
    <Link
      href={`/aula/${course.courseAssignmentId}`}
      className={`card card-interactive t-${meta.tone} flex h-full flex-col overflow-hidden p-0`}
    >
      <div
        className="relative flex h-24 items-end justify-between overflow-hidden px-4 pb-3 text-white"
        style={{ background: resolveBannerGradient(course.theme) }}
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
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-navy/55" />
          </>
        )}
        <span className="relative z-10 flex items-center gap-2">
          <span className="course-emblem" aria-hidden>
            <CourseEmblemIcon iconKey={course.theme.iconKey} className="size-6" />
          </span>
          <span className="course-pillar" title={meta.name}>
            <StheamiIcon pillar={course.pillar} size={22} />
            <span className="sr-only">{meta.name}</span>
          </span>
        </span>
        {course.pendingCount > 0 && (
          <span className="relative z-10 inline-flex items-center gap-1 rounded-pill bg-yellow px-2.5 py-1 text-xs font-black text-navy">
            <ClipboardList className="size-3.5" aria-hidden />
            {course.pendingCount} {course.pendingCount === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-5">
        <div className="min-w-0">
          <p className="line-clamp-2 leading-snug font-extrabold text-navy">{course.subjectName}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{course.teacherName ?? "Docente por asignar"}</p>
        </div>

        {progress !== null && (
          <div>
            <div className="flex justify-between text-[0.7rem] font-semibold text-muted tabular">
              <span>Material revisado</span>
              <span className="text-navy">{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="course-progress h-full rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
          {course.pendingCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-solid">
              <CheckCircle2 className="size-3.5" aria-hidden /> Al día
            </span>
          ) : (
            <span className="text-xs font-bold text-orange-solid">Tienes trabajo por entregar</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-solid">
            Entrar <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
