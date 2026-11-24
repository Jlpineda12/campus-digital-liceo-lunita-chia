import { ArrowLeft, Calendar, Link2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizBuilderPanel } from "@/components/aula/QuizBuilderPanel";
import { QuizPlayer } from "@/components/aula/QuizPlayer";
import { Chip } from "@/components/ui/Chip";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { resolveCourseAccess } from "@/modules/aula/access";
import { getQuizWorkspace } from "@/modules/aula/quizzes/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { getScaleForYear } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Cuestionario · Órbita Virtual" };

type Params = Promise<{ cursoId: string; actividadId: string }>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dueFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export default async function QuizWorkspacePage({ params }: { params: Params }) {
  const actor = await requireSession();
  const { cursoId, actividadId } = await params;
  if (!UUID_RE.test(cursoId) || !UUID_RE.test(actividadId)) notFound();

  const access = await resolveCourseAccess(actor, cursoId);
  if (!access) notFound();

  const [workspace, scale] = await Promise.all([
    getQuizWorkspace(access, actividadId),
    getScaleForYear(access.course.academicYearId),
  ]);
  if (!workspace) notFound();

  const isFamily = actor.role === "STUDENT" || actor.role === "GUARDIAN";
  const stage = isFamily ? stageForLevel(workspace.levelCode) : undefined;

  return (
    <div data-stage={stage} className="mx-auto grid max-w-4xl gap-6">
      <header className="grid gap-3">
        <Link
          href={`/aula/${cursoId}?periodo=${workspace.quiz.periodId}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-sky-solid no-underline hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a {access.course.subjectName}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <StheamiBadge pillar={access.course.pillar} />
            <div>
              <p className="kicker">
                {access.course.subjectName} ({access.course.groupName}) · {workspace.quiz.periodName} ·{" "}
                {workspace.quiz.unitTitle}
              </p>
              <h1 className="mt-0.5 text-step-3">{workspace.quiz.title}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="purple">
              <Sparkles aria-hidden /> Cuestionario interactivo
            </Chip>
            {workspace.quiz.dueDate && (
              <Chip tone="orange">
                <Calendar aria-hidden /> Cierre: {dueFormat.format(workspace.quiz.dueDate)}
              </Chip>
            )}
            {workspace.quiz.syncToSiga && (
              <Chip tone="sky">
                <Link2 aria-hidden /> SIGA{workspace.quiz.sigaLabel ? ` · ${workspace.quiz.sigaLabel}` : ""}
              </Chip>
            )}
          </div>
        </div>
      </header>

      {isFamily ? (
        <QuizPlayer
          courseAssignmentId={cursoId}
          workspace={workspace}
          canSubmit={access.canSubmit}
          isGuardian={actor.role === "GUARDIAN"}
          scale={scale}
        />
      ) : (
        <QuizBuilderPanel
          courseAssignmentId={cursoId}
          workspace={workspace}
          canManage={access.canManage}
          scale={scale}
        />
      )}
    </div>
  );
}
