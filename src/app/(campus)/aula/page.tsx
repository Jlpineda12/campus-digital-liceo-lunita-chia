import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseDirectory } from "@/components/aula/CourseDirectory";
import { StudentCourseBoard } from "@/components/aula/StudentCourseBoard";
import { pillButtonClass } from "@/components/ui/PillButton";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { TactileCard } from "@/components/ui/TactileCard";
import { listAulaCoursesForActor } from "@/modules/aula/queries";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { isStheamiPillar } from "@/modules/core/academic-structure/stheami";
import { requireSession } from "@/modules/core/auth/guards";
import { PLATFORM_SPACES } from "@/modules/core/brand/config";
import { stageForLevel } from "@/modules/core/dashboard/stage";

export const metadata: Metadata = { title: "Órbita Virtual · Mis cursos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AulaHomePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  // Directivos revisan los cursos en «Seguimiento de cursos».
  if (actor.role === "COORDINATOR" || actor.role === "ADMIN") redirect("/aula/seguimiento");
  const rawPillar = (await searchParams).pilar;
  const pillar = isStheamiPillar(rawPillar) ? rawPillar : null;
  const context = await getCurrentAcademicContext();
  if (!context) {
    return (
      <TactileCard className="text-center text-muted">
        No hay un año lectivo vigente.
      </TactileCard>
    );
  }

  const data = await listAulaCoursesForActor(actor, context.year.id);
  const isFamily = actor.role === "STUDENT" || actor.role === "GUARDIAN";
  const stage =
    isFamily && data.viewerLevelCode
      ? stageForLevel(data.viewerLevelCode)
      : undefined;
  const isPrimaria = stage === "primaria";


  return (
    <div data-stage={stage} className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <PlatformLogo space="aula" size={50} className="shrink-0" />
          <div>
            <p className="kicker">
              {PLATFORM_SPACES.aula.name}
              {data.viewerGroupLabel
                ? ` · ${data.viewerGroupLabel}`
                : ` · ${context.year.name}`}
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
                ? "Entra a una materia para ver sus guías, tareas y avisos."
                : "Publica unidades, materiales y tareas conectadas automáticamente a tu planilla SIEE."}
            </p>
          </div>
        </div>

        {isFamily && (
          <Link
            href="/aula/tareas"
            className={pillButtonClass({ variant: "navy", size: "sm" })}
          >
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

      {!isFamily && data.courses.length > 0 ? (
        <CourseDirectory courses={data.courses} mode="teacher" pillar={pillar} />
      ) : data.courses.length === 0 ? (
        <TactileCard className="py-10 text-center text-muted">
          No encontramos cursos asignados para este año lectivo.
        </TactileCard>
      ) : (
        <StudentCourseBoard courses={data.courses} pillar={pillar} />
      )}
    </div>
  );
}
