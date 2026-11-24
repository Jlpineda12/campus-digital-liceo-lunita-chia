import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Link2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { listTasksInboxForActor } from "@/modules/aula/queries";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "¿Qué tareas tengo? · Órbita Virtual" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const dueFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "America/Bogota",
});

export default async function TareasInboxPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  if (actor.role !== "STUDENT" && actor.role !== "GUARDIAN") {
    redirect("/aula");
  }

  const params = await searchParams;
  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const [inbox, scale] = await Promise.all([
    listTasksInboxForActor(actor, context.year.id),
    getScaleForYear(context.year.id),
  ]);

  const filter = single(params.estado);
  const pending = inbox.items.filter((i) => i.status === "PENDING");
  const submitted = inbox.items.filter((i) => i.status === "SUBMITTED");
  const graded = inbox.items.filter((i) => i.status === "GRADED");

  const visible =
    filter === "pendientes"
      ? pending
      : filter === "entregadas"
        ? submitted
        : filter === "calificadas"
          ? graded
          : inbox.items;

  const stage = inbox.levelCode ? stageForLevel(inbox.levelCode) : undefined;

  return (
    <div data-stage={stage} className="mx-auto grid max-w-4xl gap-6">
      <header className="grid gap-3">
        <Link
          href="/aula"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-sky-solid no-underline hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a Mis cursos
        </Link>

        <div>
          <p className="kicker">Órbita Virtual{inbox.groupLabel ? ` · ${inbox.groupLabel}` : ""}</p>
          <h1 className="mt-1 text-step-3">
            {actor.role === "GUARDIAN" && inbox.studentName
              ? `Tareas de ${inbox.studentName}`
              : "¿Qué tareas tengo?"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Todas las actividades de tus cursos en un solo lugar, ordenadas por fecha de entrega.
          </p>
        </div>

        <nav aria-label="Filtrar tareas" className="flex flex-wrap gap-1.5 border-b border-line pb-3">
          {[
            { key: "todas", label: `Todas (${inbox.items.length})`, href: "/aula/tareas" },
            { key: "pendientes", label: `Pendientes (${pending.length})`, href: "/aula/tareas?estado=pendientes" },
            { key: "entregadas", label: `En revisión (${submitted.length})`, href: "/aula/tareas?estado=entregadas" },
            { key: "calificadas", label: `Calificadas (${graded.length})`, href: "/aula/tareas?estado=calificadas" },
          ].map((tab) => {
            const active =
              (tab.key === "todas" && !["pendientes", "entregadas", "calificadas"].includes(filter ?? "")) ||
              filter === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-control border px-3 py-1.5 text-xs font-semibold no-underline transition-colors",
                  active
                    ? "border-navy bg-navy text-white"
                    : "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-cloud",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {visible.length === 0 ? (
        <TactileCard className="grid gap-1.5 py-10 text-center">
          <CheckCircle2 className="mx-auto size-8 text-green-solid" aria-hidden />
          <p className="font-bold text-navy">No tienes tareas en esta categoría</p>
          <p className="text-sm text-muted">Cuando tus docentes publiquen nuevas actividades aparecerán aquí.</p>
        </TactileCard>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {visible.map((task) => {
            const isQuiz = task.activityType === "QUIZ";
            const href = isQuiz
              ? `/aula/${task.courseAssignmentId}/quiz/${task.activityId}`
              : `/aula/${task.courseAssignmentId}/tareas/${task.activityId}`;
            return (
              <li key={task.activityId}>
                <Link
                  href={href}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 no-underline transition-colors hover:bg-bg-2/60"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <StheamiBadge pillar={task.pillar} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-navy">{task.title}</p>
                        {isQuiz && (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-purple-l px-2 py-0.5 text-[0.68rem] font-extrabold text-purple-solid">
                            <Sparkles className="size-3" aria-hidden />
                            Cuestionario
                            {task.timeLimitMinutes ? ` · ${task.timeLimitMinutes} min` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span className="font-semibold text-ink-2">{task.subjectName}</span>
                        <span aria-hidden>·</span>
                        <span>{task.unitTitle}</span>
                        {task.dueDate && (
                          <>
                            <span aria-hidden>·</span>
                            <span>
                              {isQuiz ? "Cierre" : "Entrega"}: {dueFormat.format(task.dueDate)}
                            </span>
                          </>
                        )}
                        {task.syncToSiga && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-sky-solid">
                            <Link2 className="size-3" aria-hidden /> SIGA
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    {task.status === "GRADED" && task.score !== null ? (
                      <PerformanceBadge score={task.score} scale={scale} />
                    ) : task.status === "SUBMITTED" ? (
                      <Chip tone="sky">
                        <CheckCircle2 aria-hidden /> En revisión
                      </Chip>
                    ) : (
                      <Chip tone="orange">
                        <Clock aria-hidden /> {isQuiz ? "Por presentar" : "Pendiente"}
                      </Chip>
                    )}
                    <ArrowRight className="size-4 text-muted" aria-hidden />
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
