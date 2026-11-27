import { ArrowRight, Award, CheckCircle2, ClipboardList, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { LunitaMark } from "@/components/brand/LunitaMark";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { evaluateBadges, nextBadge } from "@/modules/aula/badges";
import { getBadgeStats } from "@/modules/aula/badges-queries";
import { listTasksInboxForActor, type StudentTaskInboxItem } from "@/modules/aula/queries";
import { todayInBogota } from "@/modules/core/academic-structure/queries";
import type { SessionUser } from "@/modules/core/auth/session";
import type { StudentView } from "@/modules/core/dashboard/service";
import { formatScore } from "@/modules/siga/siee-grades/calculator";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

const MAX_TASKS = 3;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** «Atrasada», «Hoy», «Mañana», «En 3 días» o la fecha: lo único que el estudiante necesita para priorizar. */
function dueLabel(due: Date | null, today: string): { text: string; urgent: boolean } {
  if (!due) return { text: "Sin fecha", urgent: false };
  const days = daysBetween(today, todayInBogota(due));
  if (days < 0) return { text: "Atrasada", urgent: true };
  if (days === 0) return { text: "Hoy", urgent: true };
  if (days === 1) return { text: "Mañana", urgent: true };
  if (days <= 6) return { text: `En ${days} días`, urgent: false };
  return {
    text: new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).format(due),
    urgent: false,
  };
}

function taskHref(t: StudentTaskInboxItem): string {
  return t.activityType === "QUIZ"
    ? `/aula/${t.courseAssignmentId}/quiz/${t.activityId}`
    : `/aula/${t.courseAssignmentId}/tareas/${t.activityId}`;
}

/**
 * Inicio del estudiante (y del acudiente): solo tres cosas, en este orden.
 * 1. Lo que sigue (tareas por fecha, de todas las materias).
 * 2. Cómo voy (promedio del periodo).
 * 3. Mi próxima insignia.
 * Las materias, el grupo y el mapa STHEAMI viven en «Mis clases», no aquí.
 */
export async function StudentHome({
  actor,
  view,
  academicYearId,
  audience,
}: {
  actor: SessionUser;
  view: StudentView;
  academicYearId: string;
  audience: "self" | "guardian";
}) {
  const { placement, stage, periodTrend } = view;
  if (!placement) {
    return (
      <p className="card text-center text-muted">
        Sin matrícula activa en el año lectivo actual. Comunícate con Secretaría.
      </p>
    );
  }

  const scale = await getScaleForYear(academicYearId);
  const [inbox, stats] = await Promise.all([
    listTasksInboxForActor(actor, academicYearId),
    getBadgeStats({
      enrollmentId: placement.enrollmentId,
      studentId: view.studentId,
      groupId: placement.groupId,
      academicYearId,
      superiorFrom: scale.superiorFrom,
    }),
  ]);

  const today = todayInBogota();
  const pending = inbox.items
    .filter((t) => t.status === "PENDING")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const shown = pending.slice(0, MAX_TASKS);

  const withAvg = periodTrend.filter((p) => p.average !== null);
  const current = withAvg.at(-1) ?? null;
  const previous = withAvg.at(-2) ?? null;
  const delta = current && previous ? Math.round(((current.average ?? 0) - (previous.average ?? 0)) * 10) / 10 : null;

  const badges = evaluateBadges(stats);
  const earned = badges.filter((b) => b.earned).length;
  const next = nextBadge(badges);

  const isPrimaria = stage === "primaria";
  const who = audience === "guardian" ? view.firstName : null;

  return (
    <div data-stage={stage} className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      {/* 1 · Lo que sigue */}
      <section aria-labelledby="lo-que-sigue" className="card grid min-w-0 gap-4 bg-white">
        <div className="flex items-center justify-between gap-3">
          <h2 id="lo-que-sigue" className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5 text-cobalt" aria-hidden />
            {who ? `Lo que sigue para ${who}` : isPrimaria ? "Tus próximas misiones" : "Lo que sigue"}
          </h2>
          {pending.length > 0 && (
            <span className="rounded-pill bg-yellow px-2.5 py-0.5 text-xs font-black text-navy tabular">
              {pending.length} pendiente{pending.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="flex items-center gap-4 rounded-control bg-green-l/50 px-4 py-4">
            <LunitaMark size={52} />
            <div>
              <p className="font-extrabold text-navy">¡Todo al día!</p>
              <p className="text-sm text-muted">No hay tareas ni cuestionarios pendientes.</p>
            </div>
          </div>
        ) : (
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {shown.map((t, i) => {
              const due = dueLabel(t.dueDate, today);
              return (
                <li key={t.activityId}>
                  <Link
                    href={taskHref(t)}
                    className={`group flex items-center gap-3 rounded-control border px-4 py-3 no-underline transition-colors hover:bg-cloud/70 ${
                      i === 0 ? "border-cobalt/35 bg-cloud/50" : "border-line bg-white"
                    }`}
                  >
                    {t.activityType === "QUIZ" ? (
                      <Sparkles className="size-5 shrink-0 text-purple-solid" aria-hidden />
                    ) : (
                      <ClipboardList className="size-5 shrink-0 text-cobalt" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-navy">{t.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {t.subjectName}
                        {t.activityType === "QUIZ" ? " · Cuestionario" : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-pill px-2.5 py-1 text-xs font-extrabold ${
                        due.urgent ? "bg-orange-l text-orange-solid" : "bg-bg-2 text-muted"
                      }`}
                    >
                      {due.text}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <Link href="/aula/tareas" className="justify-self-start text-sm font-bold text-cobalt no-underline hover:underline">
          {pending.length > MAX_TASKS ? `Ver las ${pending.length} pendientes` : "Ver todas mis tareas"} →
        </Link>
      </section>

      <div className="grid gap-5">
        {/* 2 · Cómo voy */}
        <Link href="/siga/calificaciones" className="card group grid gap-2 bg-white no-underline hover:border-cobalt/30">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">
            {current ? `Promedio · ${current.label}` : "Promedio del periodo"}
          </p>
          <div className="flex items-end justify-between gap-3">
            <p className="text-4xl leading-none font-black text-navy tabular">{formatScore(current?.average ?? null)}</p>
            {current?.average != null && <PerformanceBadge score={current.average} scale={scale} />}
          </div>
          {delta !== null && delta !== 0 ? (
            <p className={`flex items-center gap-1 text-xs font-bold ${delta > 0 ? "text-green-solid" : "text-orange-solid"}`}>
              {delta > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
              {delta > 0 ? "+" : ""}
              {formatScore(delta)} frente a {previous?.label}
            </p>
          ) : (
            <p className="text-xs text-muted">Toca para ver tus notas por materia.</p>
          )}
        </Link>

        {/* 3 · Próxima insignia */}
        <Link href="/aula/insignias" className="card group grid gap-2 bg-white no-underline hover:border-cobalt/30">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
              <Award className="size-4 text-yellow-d" aria-hidden /> Insignias
            </p>
            <p className="text-sm font-black text-navy tabular">
              {earned}/{badges.length}
            </p>
          </div>
          {next ? (
            <>
              <p className="text-sm font-bold text-navy">Próxima: {next.name}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-cobalt" style={{ width: `${next.percent}%` }} />
              </div>
              <p className="text-xs text-muted">{next.detail}</p>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-bold text-green-solid">
              <CheckCircle2 className="size-4" aria-hidden /> ¡Todas conseguidas!
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}
