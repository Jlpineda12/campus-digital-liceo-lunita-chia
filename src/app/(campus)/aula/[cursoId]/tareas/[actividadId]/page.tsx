import { ArrowLeft, Calendar, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  StudentSubmissionBox,
  TeacherSubmissionsRoster,
} from "@/components/aula/AssignmentWorkspace";
import { Chip } from "@/components/ui/Chip";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { requireSession } from "@/modules/core/auth/guards";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { resolveCourseAccess } from "@/modules/aula/access";
import { getActivityWorkspace } from "@/modules/aula/queries";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Tarea · Órbita Virtual" };

type Params = Promise<{ cursoId: string; actividadId: string }>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dueFormat = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export default async function ActividadDetailPage({ params }: { params: Params }) {
  const actor = await requireSession();
  const { cursoId, actividadId } = await params;
  if (!UUID_RE.test(cursoId) || !UUID_RE.test(actividadId)) notFound();

  const access = await resolveCourseAccess(actor, cursoId);
  if (!access) notFound();

  const [detail, scale] = await Promise.all([
    getActivityWorkspace(access, actividadId),
    getScaleForYear(access.course.academicYearId),
  ]);
  if (!detail) notFound();

  const isFamily = actor.role === "STUDENT" || actor.role === "GUARDIAN";
  const stage = isFamily ? stageForLevel(detail.levelCode) : undefined;

  return (
    <div data-stage={stage} className="mx-auto grid max-w-4xl gap-6">
      <header className="grid gap-3">
        <Link
          href={`/aula/${cursoId}?periodo=${detail.activity.periodId}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-sky-solid no-underline hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a {access.course.subjectName}
        </Link>

        <div className="flex items-start gap-3">
          <StheamiBadge pillar={access.course.pillar} />
          <div className="min-w-0 flex-1">
            <p className="kicker">
              {access.course.subjectName} · {access.course.groupName} · {detail.activity.unitTitle}
            </p>
            <h1 className="mt-0.5 text-step-3">{detail.activity.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {detail.activity.dueDate && (
                <Chip tone="sky">
                  <Calendar aria-hidden /> Fecha límite: {dueFormat.format(detail.activity.dueDate)}
                </Chip>
              )}
              {detail.activity.syncToSiga && (
                <Chip tone="green">
                  <Link2 aria-hidden />
                  Sincronizada con SIGA{detail.activity.sigaLabel ? ` · ${detail.activity.sigaLabel}` : ""}
                </Chip>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Instrucciones del docente */}
      <section aria-label="Instrucciones de la tarea" className="card grid gap-2 bg-white">
        <h2 className="text-xs font-extrabold tracking-wider text-muted uppercase">Instrucciones</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {detail.activity.instructions}
        </p>
      </section>

      {isFamily ? (
        <StudentSubmissionBox
          courseAssignmentId={cursoId}
          activityId={detail.activity.id}
          canSubmit={access.canSubmit}
          isGuardian={actor.role === "GUARDIAN"}
          submission={detail.mySubmission}
          scale={scale}
        />
      ) : (
        <TeacherSubmissionsRoster
          courseAssignmentId={cursoId}
          activityId={detail.activity.id}
          rows={detail.rosterSubmissions}
          canGrade={access.canManage}
          syncToSiga={detail.activity.syncToSiga}
          scale={scale}
        />
      )}
    </div>
  );
}
