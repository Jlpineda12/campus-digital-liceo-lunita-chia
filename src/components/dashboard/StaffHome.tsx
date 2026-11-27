import {
  FileCheck2,
  FilePenLine,
  Layers,
  MessageSquareWarning,
  ScrollText,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { countByPillar, StheamiBlocks } from "@/components/aula/StheamiBlocks";
import { listAulaCoursesForActor } from "@/modules/aula/queries";
import type { AcademicContext } from "@/modules/core/academic-structure/queries";
import type { SessionUser } from "@/modules/core/auth/session";
import { getPeriodComplianceOverview } from "@/modules/siga/siee-grades/compliance";
import { ActionList, type WorkAction } from "./ActionList";

/**
 * Inicio de Coordinación y Secretaría/Rectoría: solo lo que pide una acción
 * (matrículas, excusas, observador, docentes con planillas o cursos vacíos)
 * y el avance del periodo en tres barras. El detalle está en cada sección.
 */
export async function StaffHome({
  actor,
  context,
  navBadges,
  alerts,
}: {
  actor: SessionUser;
  context: AcademicContext;
  navBadges: Record<string, number>;
  alerts: { pendingObserver: number; pendingExcuses: number };
}) {
  const period = context.currentPeriod;
  const [aula, overview] = await Promise.all([
    listAulaCoursesForActor(actor, context.year.id),
    period
      ? getPeriodComplianceOverview(context.year.id, period.id)
      : Promise.resolve(null),
  ]);

  const emptyCourses = aula.courses.filter((c) => c.unitCount === 0).length;
  const enrollment = navBadges.enrollment ?? 0;
  const teachersPending = overview?.summary.teachersPending ?? 0;

  const actions: WorkAction[] = [];
  if (enrollment > 0) {
    actions.push({
      id: "enrollment",
      icon: FileCheck2,
      title: `${enrollment} ${enrollment === 1 ? "solicitud de matrícula" : "solicitudes de matrícula"} por revisar`,
      detail: "Documentos, aval académico y descuentos",
      href: "/admin/matriculas",
      tone: "urgent",
    });
  }
  if (alerts.pendingExcuses > 0) {
    actions.push({
      id: "excuses",
      icon: ScrollText,
      title: `${alerts.pendingExcuses} ${alerts.pendingExcuses === 1 ? "excusa" : "excusas"} sin responder`,
      detail: "Enviadas por familias",
      href: "/siga/asistencia",
      tone: "urgent",
    });
  }
  if (teachersPending > 0 && period) {
    actions.push({
      id: "grades",
      icon: FilePenLine,
      title: `${teachersPending} ${teachersPending === 1 ? "docente" : "docentes"} con notas o logros incompletos`,
      detail: period.name,
      href: "/aula/seguimiento",
      tone: "normal",
    });
  }
  if (emptyCourses > 0) {
    actions.push({
      id: "empty",
      icon: Layers,
      title: `${emptyCourses} ${emptyCourses === 1 ? "curso" : "cursos"} sin contenido en Órbita`,
      detail: "Revisa quién no ha publicado unidades",
      href: "/aula/seguimiento",
      tone: "normal",
    });
  }
  if (alerts.pendingObserver > 0) {
    actions.push({
      id: "observer",
      icon: MessageSquareWarning,
      title: `${alerts.pendingObserver} anotaciones del Observador sin firma del acudiente`,
      detail: "Seguimiento de convivencia",
      href: "/siga/observador",
      tone: "normal",
    });
  }

  const total = aula.courses.length;
  const bars = overview
    ? [
        {
          label: "Notas subidas",
          value: overview.summary.overallGradesPercent,
        },
        {
          label: "Logros redactados",
          value: overview.summary.overallLogrosPercent,
        },
        {
          label: "Cursos con contenido",
          value:
            total > 0 ? Math.round(((total - emptyCourses) / total) * 100) : 0,
        },
      ]
    : [];

  return (
    <div className="grid gap-7">
      <StheamiBlocks
        counts={countByPillar(aula.courses)}
        hrefBase="/aula/seguimiento"
        unit={{ one: "curso", many: "cursos" }}
        hint="Toca un bloque para revisar los cursos de ese pilar."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <ActionList
          title="Requiere atención"
          actions={actions}
          emptyText="Nada urgente por ahora."
        />

        <Link
          href="/aula/seguimiento"
          className="card grid gap-4 bg-white no-underline hover:border-cobalt/30"
        >
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
              <UserCheck className="size-4 text-cobalt" aria-hidden /> Avance{" "}
              {period ? `· ${period.name}` : "del periodo"}
            </p>
          </div>
          {bars.length === 0 ? (
            <p className="text-sm text-muted">No hay un periodo vigente.</p>
          ) : (
            <ul className="grid gap-3">
              {bars.map((b) => (
                <li key={b.label} className="grid gap-1">
                  <span className="flex justify-between text-sm">
                    <span className="font-semibold text-navy">{b.label}</span>
                    <span className="font-black text-navy tabular">
                      {b.value}%
                    </span>
                  </span>
                  <span
                    className="h-2 overflow-hidden rounded-full bg-line"
                    aria-hidden
                  >
                    <span
                      className={`block h-full rounded-full ${b.value >= 100 ? "bg-green-solid" : "bg-cobalt"}`}
                      style={{ width: `${Math.min(100, b.value)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className="text-xs font-bold text-cobalt">
            Ver seguimiento por docente →
          </span>
        </Link>
      </div>
    </div>
  );
}
