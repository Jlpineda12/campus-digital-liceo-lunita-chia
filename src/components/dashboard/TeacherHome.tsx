import { ClipboardCheck, FilePenLine, Layers, PenLine } from "lucide-react";
import Link from "next/link";
import { listAulaCoursesForActor } from "@/modules/aula/queries";
import type { AcademicContext, DirectedGroup } from "@/modules/core/academic-structure/queries";
import type { SessionUser } from "@/modules/core/auth/session";
import { getPeriodComplianceOverview } from "@/modules/siga/siee-grades/compliance";
import { ActionList, type WorkAction } from "./ActionList";

/**
 * Inicio del docente: «Lo que sigue» (calificar, completar planillas y logros,
 * publicar contenido) + accesos de dirección de grupo. La lista completa de
 * cursos vive en «Mis clases», con buscador y filtros.
 */
export async function TeacherHome({
  actor,
  context,
  directed,
}: {
  actor: SessionUser;
  context: AcademicContext;
  directed: DirectedGroup[];
}) {
  const period = context.currentPeriod;
  const [aula, overview] = await Promise.all([
    listAulaCoursesForActor(actor, context.year.id),
    period && !period.gradesLocked
      ? getPeriodComplianceOverview(context.year.id, period.id)
      : Promise.resolve(null),
  ]);
  const mine = overview?.teachers.find((t) => t.teacherId === actor.id)?.courses ?? [];
  const label = (c: { subjectName: string; groupName: string }) => `${c.subjectName} · ${c.groupName}`;

  const actions: WorkAction[] = [
    ...aula.courses
      .filter((c) => c.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount)
      .map((c) => ({
        id: `grade-${c.courseAssignmentId}`,
        icon: ClipboardCheck,
        title: `Calificar ${c.pendingCount} ${c.pendingCount === 1 ? "entrega" : "entregas"}`,
        detail: label(c),
        href: `/aula/${c.courseAssignmentId}`,
        tone: "urgent" as const,
      })),
    ...mine
      .filter((c) => c.gradesPercent < 100)
      .sort((a, b) => a.gradesPercent - b.gradesPercent)
      .map((c) => ({
        id: `sheet-${c.courseAssignmentId}`,
        icon: FilePenLine,
        title: `Completar planilla (${c.gradesPercent}%)`,
        detail: `${label(c)} · ${period?.name ?? ""}`,
        href: `/siga/calificaciones?curso=${c.courseAssignmentId}`,
        tone: "normal" as const,
      })),
    ...mine
      .filter((c) => c.gradesPercent >= 100 && c.logrosPercent < 100)
      .map((c) => ({
        id: `logros-${c.courseAssignmentId}`,
        icon: PenLine,
        title: `Redactar logros (${c.logrosFilled}/${c.logrosExpected})`,
        detail: label(c),
        href: `/siga/calificaciones?curso=${c.courseAssignmentId}`,
        tone: "normal" as const,
      })),
    ...aula.courses
      .filter((c) => c.unitCount === 0)
      .map((c) => ({
        id: `content-${c.courseAssignmentId}`,
        icon: Layers,
        title: "Publicar la primera unidad",
        detail: label(c),
        href: `/aula/${c.courseAssignmentId}`,
        tone: "normal" as const,
      })),
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <ActionList title="Lo que sigue" actions={actions} emptyText="Todo al día: sin entregas ni planillas pendientes." />

      <div className="grid gap-5">
        <Link href="/aula" className="card grid gap-1 bg-white no-underline hover:border-cobalt/30">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Mis clases</p>
          <p className="text-3xl font-black text-navy tabular">{aula.courses.length}</p>
          <p className="text-xs text-muted">cursos · busca y filtra por grupo o asignatura →</p>
        </Link>

        {directed.map((g) => (
          <div key={g.groupId} className="card grid gap-3 bg-white">
            <div>
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Dirección de grupo</p>
              <p className="text-lg font-extrabold text-navy">
                {g.groupName} · {g.gradeName}
              </p>
              <p className="text-xs text-muted tabular">{g.studentCount} estudiantes</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { href: `/siga/boletines?grupo=${g.groupId}`, text: "Boletines" },
                { href: `/siga/observador?grupo=${g.groupId}`, text: "Observador" },
              ].map((l) => (
                <Link
                  key={l.text}
                  href={l.href}
                  className="rounded-control border border-line px-3 py-1.5 text-xs font-bold text-navy no-underline hover:bg-cloud"
                >
                  {l.text}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
