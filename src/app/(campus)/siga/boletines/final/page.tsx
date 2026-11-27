import type { Metadata } from "next";
import Link from "next/link";
import { AnnualReportCard } from "@/components/siga/report-cards/AnnualReportCard";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { TactileCard } from "@/components/ui/TactileCard";
import {
  getCurrentAcademicContext,
  getGuardianChildren,
  getInstitutionOverview,
  getStudentPlacement,
} from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { getStudentAnnualReport, listGroupRoster } from "@/modules/siga/report-cards/queries";

export const metadata: Metadata = { title: "Boletín final del año" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BoletinFinalPage({ searchParams }: { searchParams: SearchParams }) {
  const [actor, params, context] = await Promise.all([requireSession(), searchParams, getCurrentAcademicContext()]);
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }
  const periods = context.periods.map((p) => ({
    id: p.id,
    number: p.number,
    name: p.name,
    weightPercent: p.weightPercent,
  }));

  /* ---------------- Estudiante y acudiente ---------------- */
  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    let studentId = actor.id;
    let studentName = `${actor.firstName}`;
    if (actor.role === "GUARDIAN") {
      const children = await getGuardianChildren(actor.id, context.year.id);
      const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
      const child = children.find((c) => c.studentId === selectedId);
      if (!child) {
        return <TactileCard className="text-center text-muted">No hay estudiantes vinculados a tu cuenta.</TactileCard>;
      }
      studentId = child.studentId;
      studentName = `${child.firstName} ${child.lastName}`;
    } else {
      studentName = actor.fullName;
    }

    const placement = await getStudentPlacement(studentId, context.year.id);
    if (!placement) {
      return <TactileCard className="text-center text-muted">Sin matrícula activa en el año lectivo actual.</TactileCard>;
    }
    const summary = await getStudentAnnualReport({
      enrollmentId: placement.enrollmentId,
      groupId: placement.groupId,
      academicYearId: context.year.id,
      periods,
      familyView: true,
    });

    return (
      <div data-stage={stageForLevel(placement.levelCode)} className="grid gap-5">
        <header className="no-print">
          <h1 className="text-step-3">
            {actor.role === "GUARDIAN" ? `Año ${context.year.year} de ${studentName.split(" ")[0]}` : "Mi año escolar"}
          </h1>
          <p className="mt-1 text-muted">Todas tus asignaturas y cómo cerraste cada periodo, en una sola hoja.</p>
        </header>
        <AnnualReportCard
          summary={summary}
          studentName={studentName}
          groupLabel={`${placement.gradeName} · ${placement.groupName}`}
          yearName={context.year.name}
        />
      </div>
    );
  }

  /* ---------------- Coordinación y Secretaría/Rectoría ---------------- */
  if (!can(actor.role, "reportCards.preview")) {
    return (
      <TactileCard className="mx-auto grid max-w-xl gap-3 text-center">
        <h1 className="text-lg">Boletín final del año</h1>
        <p className="text-muted">Como director(a) de grupo, consulta los boletines de tus estudiantes por periodo.</p>
        <Link href="/siga/boletines" className={pillButtonClass({ variant: "navy", size: "sm", className: "justify-self-center" })}>
          Ir a boletines
        </Link>
      </TactileCard>
    );
  }

  const groups = (await getInstitutionOverview(context.year.id)).groups;
  if (groups.length === 0) {
    return <TactileCard className="text-center text-muted">No hay grupos en el año lectivo.</TactileCard>;
  }
  const group = groups.find((g) => g.groupId === single(params.grupo)) ?? groups[0]!;
  const roster = await listGroupRoster(group.groupId, context.year.id);
  const selected = roster.find((r) => r.enrollmentId === single(params.estudiante)) ?? roster[0];
  const summary = selected
    ? await getStudentAnnualReport({
        enrollmentId: selected.enrollmentId,
        groupId: group.groupId,
        academicYearId: context.year.id,
        periods,
        familyView: false,
      })
    : null;

  return (
    <div className="grid gap-5">
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-step-3">Boletín final del año</h1>
          <p className="mt-1 text-muted">Definitivas por asignatura de {group.gradeName} ({group.groupName}).</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="bf-grupo" className="field-label">Grupo</label>
            <select id="bf-grupo" name="grupo" defaultValue={group.groupId} className="input min-h-10 py-1.5 text-sm font-semibold">
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName} · {g.gradeName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
            Ver
          </button>
        </form>
      </header>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Estudiantes del grupo" className="no-print card max-h-[70vh] overflow-y-auto bg-white p-2">
          {roster.length === 0 ? (
            <p className="p-3 text-sm text-muted">Sin estudiantes activos.</p>
          ) : (
            <ul className="grid gap-0.5">
              {roster.map((r) => (
                <li key={r.enrollmentId}>
                  <Link
                    href={`/siga/boletines/final?grupo=${group.groupId}&estudiante=${r.enrollmentId}`}
                    aria-current={r.enrollmentId === selected?.enrollmentId ? "page" : undefined}
                    className={cx(
                      "block truncate rounded-control px-3 py-2 text-sm no-underline",
                      r.enrollmentId === selected?.enrollmentId
                        ? "bg-navy font-bold text-white"
                        : "font-semibold text-navy hover:bg-cloud",
                    )}
                  >
                    {r.studentName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {summary && selected ? (
          <AnnualReportCard
            summary={summary}
            studentName={selected.studentName}
            groupLabel={`${group.gradeName} · ${group.groupName}`}
            yearName={context.year.name}
          />
        ) : (
          <TactileCard className="text-center text-muted">Elige un estudiante para ver su boletín final.</TactileCard>
        )}
      </div>
    </div>
  );
}
