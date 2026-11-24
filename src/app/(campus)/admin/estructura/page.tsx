import { Clock, Lock, LockOpen, X } from "lucide-react";
import type { Metadata } from "next";
import { revealStyle, SectionHeader } from "@/components/dashboard/parts";
import { ConfirmSubmit } from "@/components/siga/ConfirmSubmit";
import { UnlockWindowForm, type CourseOptionGroup } from "@/components/siga/UnlockWindowForm";
import { Chip } from "@/components/ui/Chip";
import { TactileCard } from "@/components/ui/TactileCard";
import { formatDateRange } from "@/modules/core/academic-structure/dates";
import { getCurrentAcademicContext } from "@/modules/core/academic-structure/queries";
import { requirePermission } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { listGradebookCourses } from "@/modules/siga/siee-grades/queries";
import { getPeriodsForAdmin } from "@/modules/siga/siee-grades/period-admin";
import {
  closeUnlockWindowAction,
  setPeriodLockAction,
} from "@/modules/siga/siee-grades/period-actions";

export const metadata: Metadata = { title: "Estructura académica" };

const expiresFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export default async function EstructuraPage() {
  const actor = await requirePermission("structure.read");
  const context = await getCurrentAcademicContext();
  if (!context) {
    return (
      <TactileCard className="text-center text-muted">No hay un año lectivo marcado como vigente.</TactileCard>
    );
  }

  const [periods, courses] = await Promise.all([
    getPeriodsForAdmin(context.year.id),
    listGradebookCourses(actor, context.year.id),
  ]);
  const canEdit = can(actor.role, "structure.edit.academic");
  const canUnlock = can(actor.role, "periods.unlock");

  const courseGroups: CourseOptionGroup[] = [];
  for (const c of courses) {
    let group = courseGroups.find((g) => g.groupName === c.groupName);
    if (!group) {
      group = { groupName: c.groupName, courses: [] };
      courseGroups.push(group);
    }
    group.courses.push({ id: c.courseAssignmentId, label: c.subjectName });
  }

  return (
    <div className="grid gap-6">
      <header>
        <p className="kicker">Gestión institucional</p>
        <h1 className="mt-1 text-step-3">Estructura académica</h1>
        <p className="mt-1 text-muted">
          {context.year.name} · nota mínima aprobatoria {context.year.minPassingScore.toFixed(1)}
        </p>
      </header>

      <section aria-labelledby="periodos">
        <SectionHeader
          id="periodos"
          title="Periodos y cierre de notas"
          description="Al cerrar un periodo, la planilla pasa a solo lectura para todos los docentes. Cada cierre, apertura y ventana temporal queda en la auditoría."
        />
        <ul className="grid gap-4">
          {periods.map((p, index) => {
            const isCurrent = p.id === context.currentPeriod?.id;
            return (
              <li key={p.id} className="card reveal grid gap-4" style={revealStyle(index)}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-icon-sm text-lg font-black ${
                      isCurrent ? "bg-yellow text-navy" : "bg-cloud text-navy"
                    }`}
                    aria-hidden
                  >
                    {p.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg">
                      {p.name}
                      {isCurrent && <span className="ml-2 align-middle text-xs font-bold text-muted">(vigente)</span>}
                    </h3>
                    <p className="text-sm text-muted">
                      {formatDateRange(p.startDate, p.endDate)} · peso {p.weightPercent}%
                    </p>
                  </div>
                  {p.gradesLocked ? (
                    <Chip tone="red">
                      <Lock aria-hidden /> Cerrado
                    </Chip>
                  ) : (
                    <Chip tone="green">
                      <LockOpen aria-hidden /> Abierto
                    </Chip>
                  )}
                  {canEdit && (
                    <form action={setPeriodLockAction}>
                      <input type="hidden" name="periodId" value={p.id} />
                      <input type="hidden" name="locked" value={p.gradesLocked ? "false" : "true"} />
                      <ConfirmSubmit
                        confirmLabel={p.gradesLocked ? "Confirmar apertura" : "Confirmar cierre"}
                      >
                        {p.gradesLocked ? "Abrir periodo" : "Cerrar periodo"}
                      </ConfirmSubmit>
                    </form>
                  )}
                </div>

                {p.windows.length > 0 && (
                  <ul className="grid gap-2" aria-label={`Ventanas temporales del ${p.name}`}>
                    {p.windows.map((w) => (
                      <li
                        key={w.id}
                        className="flex flex-wrap items-center gap-3 rounded-control border border-sky bg-sky-l/60 px-3 py-2 text-sm"
                      >
                        <Clock className="size-4 shrink-0 text-sky-solid" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <strong className="font-semibold">{w.scope}</strong> · hasta{" "}
                          <time dateTime={w.expiresAt.toISOString()}>{expiresFormat.format(w.expiresAt)}</time>
                          <span className="block text-muted">
                            “{w.reason}”{w.openedBy ? ` — ${w.openedBy}` : ""}
                          </span>
                        </span>
                        {canUnlock && (
                          <form action={closeUnlockWindowAction}>
                            <input type="hidden" name="windowId" value={w.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-control px-2 py-1 font-semibold text-navy hover:bg-white"
                            >
                              <X className="size-4" aria-hidden /> Cerrar ventana
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {p.gradesLocked && canUnlock && (
                  <UnlockWindowForm periodId={p.id} periodName={p.name} courseGroups={courseGroups} />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
