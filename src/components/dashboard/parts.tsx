import { ArrowRight, CalendarRange, Clock, Lock, LockOpen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { IconBubble } from "@/components/ui/IconBubble";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { formatDateRange, getPeriodProgress } from "@/modules/core/academic-structure/dates";
import type { AcademicContext, GroupCourse } from "@/modules/core/academic-structure/queries";
import { PILLAR_META, STHEAMI_PILLARS } from "@/modules/core/academic-structure/stheami";
import type { Tone } from "@/modules/core/auth/roles";

/** Índice para la entrada escalonada (`.reveal`). */
export function revealStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

/* Encabezado del panel --------------------------------------------------- */

export function WelcomeHero({
  kicker,
  title,
  subtitle,
  context,
}: {
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  context: AcademicContext | null;
}) {
  return (
    <section className="hero block-navy reveal" style={revealStyle(0)}>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(16rem,22rem)] lg:items-center">
        <div className="flex items-center gap-5">
          {/* Mascota Lunita: visible solo en primaria (ver .mascot en globals.css) */}
          <LunitaEmblem size={76} className="mascot shrink-0" />
          <div className="min-w-0">
            <p className="kicker">
              <span className="moon" aria-hidden /> {kicker}
            </p>
            <h1 className="mt-2 text-step-3">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 max-w-xl text-step-1 leading-normal text-white/80">{subtitle}</p>
            )}
          </div>
        </div>
        {context && <PeriodPanel context={context} />}
      </div>
    </section>
  );
}

function PeriodPanel({ context }: { context: AcademicContext }) {
  const period = context.currentPeriod;
  if (!period) {
    return <p className="font-bold text-white/80">{context.year.name}</p>;
  }
  const progress = getPeriodProgress(period, context.today);
  return (
    <div className="rounded-card border border-white/15 bg-white/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-wider text-yellow uppercase">{context.year.name}</p>
          <p className="text-lg font-black text-white">{period.name}</p>
        </div>
        {period.gradesLocked ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-white/15 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap text-white uppercase">
            <Lock className="size-3.5" aria-hidden /> Cerrado
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-green-solid px-2.5 py-1 text-xs font-extrabold whitespace-nowrap text-white uppercase">
            <LockOpen className="size-3.5" aria-hidden /> Abierto
          </span>
        )}
      </div>
      <div
        className="progress mt-3"
        role="progressbar"
        aria-label={`Avance del ${period.name}`}
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-bold text-white/80">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="size-4" aria-hidden />
          {formatDateRange(period.startDate, period.endDate)}
        </span>
        <span className="tabular">{periodStatusText(progress)}</span>
      </p>
    </div>
  );
}

export function periodStatusText(progress: ReturnType<typeof getPeriodProgress>): string {
  if (progress.status === "upcoming") return "Aún no inicia";
  if (progress.status === "finished") return "Finalizado";
  return progress.daysLeft === 0 ? "Último día" : `Faltan ${progress.daysLeft} días`;
}

/* Encabezado de sección --------------------------------------------------- */

export function SectionHeader({
  title,
  description,
  id,
}: {
  title: string;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-step-2">
        {title}
      </h2>
      {description && <p className="mt-1 text-muted">{description}</p>}
    </div>
  );
}

/* Indicador numérico ------------------------------------------------------ */

export function StatTile({
  icon: Icon,
  tone,
  value,
  label,
  index = 0,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: number | string;
  label: string;
  index?: number;
}) {
  return (
    <TactileCard tone={tone} className="reveal flex h-full items-center gap-4" style={revealStyle(index)}>
      <IconBubble tone={tone}>
        <Icon />
      </IconBubble>
      <div className="min-w-0">
        <p className="text-step-2 leading-none font-black text-navy tabular-nums">{value}</p>
        <p className="mt-1 text-sm font-bold text-muted">{label}</p>
      </div>
    </TactileCard>
  );
}

/* Asignaturas con insignia STHEAMI ---------------------------------------- */

/** Tarjetas grandes clicables en primaria; lista editorial interactiva en bachillerato. */
export function CourseGrid({ courses }: { courses: GroupCourse[] }) {
  if (courses.length === 0) {
    return (
      <TactileCard className="text-center text-muted">
        Aún no hay asignaturas asignadas a este grupo.
      </TactileCard>
    );
  }
  return (
    <ul className="course-grid">
      {courses.map((course, index) => {
        const pillar = PILLAR_META[course.pillar];
        return (
          <li key={course.courseId} className="reveal" style={revealStyle(index + 1)}>
            <Link
              href={`/aula/${course.courseId}`}
              className={cx("card card-interactive course-card group h-full", `t-${pillar.tone}`)}
            >
              <div className="course-card__head">
                <StheamiBadge pillar={course.pillar} />
                <Chip tone={pillar.tone} className="course-card__pillar">
                  {pillar.name}
                </Chip>
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="course-card__title line-clamp-2">{course.subjectName}</h3>
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-navy"
                  aria-hidden
                />
              </div>
              <p className="course-card__meta">
                <span>
                  <Avatar
                    initials={course.teacherInitials ?? "?"}
                    src={course.teacherAvatarUrl}
                    alt={course.teacherName ?? "Docente"}
                    size="sm"
                    tone={pillar.tone}
                    className="size-6 text-[0.65rem]"
                  />
                  <span className="truncate" title={course.teacherName ?? undefined}>
                    {course.teacherName ?? "Docente por asignar"}
                  </span>
                </span>
                <span className="tabular">
                  <Clock aria-hidden />
                  {course.weeklyHours === 1 ? "1 hora semanal" : `${course.weeklyHours} horas semanales`}
                </span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* Distribución por pilar STHEAMI ------------------------------------------ */

export function PillarMap({ counts, caption }: { counts: Partial<Record<string, number>>; caption: string }) {
  const max = Math.max(...STHEAMI_PILLARS.map((p) => counts[p] ?? 0), 1);
  return (
    <TactileCard>
      <h2 className="text-lg">Mapa STHEAMI</h2>
      <p className="mt-1 text-sm text-muted">{caption}</p>
      <ul className="mt-4 grid grid-cols-7 gap-1.5">
        {STHEAMI_PILLARS.map((p) => {
          const n = counts[p] ?? 0;
          return (
            <li
              key={p}
              className={cx("grid justify-items-center gap-1.5", n === 0 && "opacity-40")}
              title={`${PILLAR_META[p].name}: ${n}`}
            >
              <StheamiBadge pillar={p} />
              <span
                className={cx("h-1 w-full overflow-hidden rounded-pill bg-line", `t-${PILLAR_META[p].tone}`)}
                aria-hidden
              >
                <span
                  className="progress-fill block h-full rounded-pill bg-(--c)"
                  style={{ width: `${Math.round((n / max) * 100)}%` }}
                />
              </span>
              <span className="text-xs font-extrabold text-navy tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
    </TactileCard>
  );
}
