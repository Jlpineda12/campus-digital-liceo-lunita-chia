import { CalendarCheck2, CalendarDays, Clock, FileCheck2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { revealStyle, SectionHeader } from "@/components/dashboard/parts";
import { AttendanceBadge, ExcuseBadge } from "@/components/siga/attendance/AttendanceBadge";
import { ExcuseReviewControls, GuardianExcuseForm } from "@/components/siga/attendance/ExcuseForms";
import { RollCallBoard } from "@/components/siga/attendance/RollCallBoard";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import { formatDateRange } from "@/modules/core/academic-structure/dates";
import {
  getCurrentAcademicContext,
  getGuardianChildren,
  getStudentPlacement,
  todayInBogota,
  type AcademicContext,
} from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import {
  EXCUSE_REASON_LABELS,
  EXCUSE_STATUS_META,
  EXCUSE_STATUSES,
  isExcuseStatus,
  isIsoDateString,
  type ExcuseReasonType,
  type ExcuseStatus,
} from "@/modules/siga/attendance/meta";
import {
  getAttendanceRollSheet,
  getStaffAttendanceDashboard,
  getStudentAttendanceOverview,
} from "@/modules/siga/attendance/queries";
import { getCourseContext } from "@/modules/siga/siee-grades/access";
import { listGradebookCourses } from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Asistencia" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default async function AsistenciaPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  const params = await searchParams;
  const context = await getCurrentAcademicContext();

  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const today = todayInBogota();
  const rawDate = single(params.fecha);
  const date = rawDate && isIsoDateString(rawDate) ? rawDate : today;

  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    return <FamilyAttendanceView actor={actor} context={context} today={today} />;
  }

  if (actor.role === "TEACHER") {
    return (
      <TeacherAttendanceView
        actor={actor}
        context={context}
        requestedCourse={single(params.curso)}
        date={date}
      />
    );
  }

  const rawStatus = single(params.estado);
  const excuseStatus = isExcuseStatus(rawStatus) ? rawStatus : undefined;
  return (
    <StaffAttendanceView
      context={context}
      date={date}
      excuseStatus={excuseStatus}
    />
  );
}

/* ---------------------------------------------------------------------------
   Estudiante y Acudiente (respeta data-stage del nivel escolar)
   --------------------------------------------------------------------------- */
async function FamilyAttendanceView({
  actor,
  context,
  today,
}: {
  actor: SessionUser;
  context: AcademicContext;
  today: string;
}) {
  let studentId = actor.id;
  let studentName = actor.firstName;
  if (actor.role === "GUARDIAN") {
    const children = await getGuardianChildren(actor.id, context.year.id);
    const selectedId = await resolveSelectedChildId(children.map((c) => c.studentId));
    const child = children.find((c) => c.studentId === selectedId);
    if (!child) {
      return <TactileCard className="text-center text-muted">No hay estudiantes vinculados a tu cuenta.</TactileCard>;
    }
    studentId = child.studentId;
    studentName = child.firstName;
  }

  const placement = await getStudentPlacement(studentId, context.year.id);
  if (!placement) {
    return <TactileCard className="text-center text-muted">Sin matrícula activa en el año lectivo actual.</TactileCard>;
  }

  const { stats, logs, excuses } = await getStudentAttendanceOverview(placement.enrollmentId);
  const stage = stageForLevel(placement.levelCode);

  return (
    <div data-stage={stage} className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">
            {placement.gradeName} · {placement.groupName}
          </p>
          <h1 className="mt-1 text-step-3">
            {actor.role === "GUARDIAN" ? `Asistencia de ${studentName}` : "Mi asistencia"}
          </h1>
          <p className="mt-1 text-muted">
            {actor.role === "GUARDIAN"
              ? "Registro diario de clases y radicación de excusas justificadas."
              : stage === "primaria"
                ? "Mira qué tan juicioso has venido al cole este año."
                : "Consolidado de asistencia, retardos y excusas del año lectivo."}
          </p>
        </div>
        {actor.role === "GUARDIAN" && (
          <GuardianExcuseForm
            enrollmentId={placement.enrollmentId}
            studentName={studentName}
            today={today}
          />
        )}
      </header>

      <section
        aria-label="Resumen de asistencia"
        className="card reveal grid grid-cols-2 divide-y divide-line p-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0"
        style={revealStyle(1)}
      >
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <CalendarCheck2 className="size-3.5 text-green-solid" aria-hidden /> Asistencia
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {stats.ratePercent}%
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Fallas</p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {stats.absent}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <Clock className="size-3.5 text-orange-solid" aria-hidden /> Retardos
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {stats.late}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <FileCheck2 className="size-3.5 text-sky-solid" aria-hidden /> Excusas
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {stats.excused}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="registro-clases">
          <SectionHeader
            id="registro-clases"
            title="Registros recientes"
            description="Últimas 40 clases con control de asistencia."
          />
          {logs.length === 0 ? (
            <TactileCard className="text-center text-muted">
              Aún no hay registros de asistencia en este año lectivo.
            </TactileCard>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="tactile-table">
                <caption className="sr-only">Historial de asistencia</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Asignatura</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="hidden sm:table-cell">
                      Observación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap font-semibold text-navy">{formatDay(log.date)}</td>
                      <td>{log.subjectName ?? "Jornada escolar"}</td>
                      <td>
                        <AttendanceBadge status={log.status} compact />
                      </td>
                      <td className="hidden text-sm text-muted sm:table-cell">{log.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="excusas-lista">
          <SectionHeader id="excusas-lista" title="Excusas radicadas" />
          {excuses.length === 0 ? (
            <TactileCard className="text-center text-sm text-muted">
              No hay excusas radicadas este año.
            </TactileCard>
          ) : (
            <ul className="grid gap-3">
              {excuses.map((ex) => (
                <TactileCard as="li" key={ex.id} className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ExcuseBadge status={ex.status} />
                    <span className="text-xs font-semibold text-muted tabular">
                      {formatDateRange(ex.fromDate, ex.toDate)}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-navy">
                    {EXCUSE_REASON_LABELS[ex.reasonType as ExcuseReasonType] ?? ex.reasonType}
                  </p>
                  {ex.description && <p className="text-sm text-ink-2">{ex.description}</p>}
                  {ex.reviewNotes && (
                    <p className="rounded-control bg-cloud px-2.5 py-1.5 text-xs font-semibold text-navy">
                      Coordinación: {ex.reviewNotes}
                    </p>
                  )}
                </TactileCard>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Docente: Llamado a lista rápido por clase y fecha
   --------------------------------------------------------------------------- */
async function TeacherAttendanceView({
  actor,
  context,
  requestedCourse,
  date,
}: {
  actor: SessionUser;
  context: AcademicContext;
  requestedCourse?: string;
  date: string;
}) {
  const allCourses = await listGradebookCourses(actor, context.year.id);
  if (allCourses.length === 0) {
    return (
      <TactileCard className="text-center text-muted">
        No tienes cargas académicas asignadas para tomar lista.
      </TactileCard>
    );
  }

  // Agrupa clases propias vs. materias visibles por dirección de grupo
  const ownCourses = allCourses.filter((c) => c.teacherId === actor.id);
  const directedCourses = allCourses.filter((c) => c.teacherId !== actor.id);

  // Seleccionar primero cursos propios; si no hay solicitado, el primero propio.
  const selectedOption =
    allCourses.find((c) => c.courseAssignmentId === requestedCourse) ?? ownCourses[0] ?? allCourses[0]!;
  const course = await getCourseContext(selectedOption.courseAssignmentId);
  if (!course) {
    return <TactileCard className="text-center text-muted">No encontramos la asignatura seleccionada.</TactileCard>;
  }

  const isOwner = course.teacherId === actor.id;
  const sheet = await getAttendanceRollSheet({
    courseAssignmentId: course.courseAssignmentId,
    groupId: course.groupId,
    academicYearId: course.academicYearId,
    date,
  });

  return (
    <div className="grid gap-5">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker">Llamado a lista · SIGA Lunita</p>
            <h1 className="mt-1 flex items-center gap-2 text-step-3">
              <StheamiBadge pillar={course.pillar} />
              {course.subjectName} · {course.groupName}
            </h1>
            <p className="mt-1 text-muted">
              {formatDay(date)} · {sheet.students.length} estudiantes
              {sheet.alreadySavedCount > 0 ? " · Lista ya registrada (puedes ajustarla)" : " · Todos premarcados Presente"}
            </p>
          </div>
        </div>

        <form method="get" className="card flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <label htmlFor="att-curso" className="field-label">
              Curso / Asignatura
            </label>
            <select
              id="att-curso"
              name="curso"
              defaultValue={course.courseAssignmentId}
              className="input min-h-11 py-2 text-base font-semibold sm:text-sm"
            >
              {directedCourses.length > 0 ? (
                <>
                  {ownCourses.length > 0 && (
                    <optgroup label="Mis clases asignadas">
                      {ownCourses.map((c) => (
                        <option key={c.courseAssignmentId} value={c.courseAssignmentId}>
                          {c.groupName} · {c.subjectName}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Dirección de grupo (solo consulta)">
                    {directedCourses.map((c) => (
                      <option key={c.courseAssignmentId} value={c.courseAssignmentId}>
                        {c.groupName} · {c.subjectName}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                allCourses.map((c) => (
                  <option key={c.courseAssignmentId} value={c.courseAssignmentId}>
                    {c.groupName} · {c.subjectName}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="att-fecha" className="field-label">
              Fecha
            </label>
            <input
              id="att-fecha"
              name="fecha"
              type="date"
              defaultValue={date}
              className="input min-h-11 py-2 text-sm font-semibold"
            />
          </div>

          <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
            <CalendarDays aria-hidden /> Abrir lista
          </button>
        </form>
      </header>

      {!isOwner ? (
        <TactileCard className="text-muted">
          Vista de dirección de grupo: solo el docente titular ({course.teacherName ?? "por asignar"}) puede guardar el llamado a lista de esta materia.
        </TactileCard>
      ) : (
        <RollCallBoard
          key={`${course.courseAssignmentId}:${date}`}
          courseAssignmentId={course.courseAssignmentId}
          date={date}
          initialStudents={sheet.students}
          alreadySavedCount={sheet.alreadySavedCount}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Coordinación / Secretaría: Pulso diario + Revisión de Excusas
   --------------------------------------------------------------------------- */
async function StaffAttendanceView({
  context,
  date,
  excuseStatus,
}: {
  context: AcademicContext;
  date: string;
  excuseStatus?: ExcuseStatus;
}) {
  const data = await getStaffAttendanceDashboard({
    academicYearId: context.year.id,
    date,
    excuseStatus,
  });

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Control diario · {context.year.name}</p>
          <h1 className="mt-1 text-step-3">Asistencia y excusas</h1>
          <p className="mt-1 text-muted">
            Seguimiento del {formatDay(date)} y bandeja de revisión de excusas radicadas por las familias.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          {excuseStatus && <input type="hidden" name="estado" value={excuseStatus} />}
          <div>
            <label htmlFor="staff-att-date" className="field-label">
              Fecha de consulta
            </label>
            <input
              id="staff-att-date"
              name="fecha"
              type="date"
              defaultValue={date}
              className="input min-h-10 py-1.5 text-sm font-semibold"
            />
          </div>
          <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
            Consultar
          </button>
        </form>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen diario institucional">
        <li className="card reveal" style={revealStyle(1)}>
          <p className="text-sm font-semibold text-muted">Asistencia del día</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.dailyStats.total > 0 ? `${data.dailyStats.ratePercent}%` : "—"}
          </p>
        </li>
        <li className="card reveal" style={revealStyle(2)}>
          <p className="text-sm font-semibold text-muted">Fallas hoy</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.dailyStats.absent}
          </p>
        </li>
        <li className="card reveal" style={revealStyle(3)}>
          <p className="text-sm font-semibold text-muted">Retardos hoy</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.dailyStats.late}
          </p>
        </li>
        <li className="card reveal" style={revealStyle(4)}>
          <p className="text-sm font-semibold text-muted">Excusas pendientes</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.pendingExcusesCount}
          </p>
        </li>
      </ul>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="bandeja-excusas" className="grid content-start gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader
              id="bandeja-excusas"
              title="Bandeja de excusas"
              description="Al aprobar una excusa, las fallas registradas en ese rango se justifican automáticamente."
            />
            <nav aria-label="Filtrar excusas por estado" className="flex flex-wrap gap-1.5">
              <Link
                href={`/siga/asistencia?fecha=${date}`}
                className={cx(
                  "rounded-control border px-2.5 py-1 text-xs font-semibold no-underline",
                  !excuseStatus ? "border-navy bg-navy text-white" : "border-line-2 bg-white text-navy hover:bg-cloud",
                )}
              >
                Todas
              </Link>
              {EXCUSE_STATUSES.map((st) => (
                <Link
                  key={st}
                  href={`/siga/asistencia?fecha=${date}&estado=${st}`}
                  className={cx(
                    "rounded-control border px-2.5 py-1 text-xs font-semibold no-underline",
                    excuseStatus === st
                      ? "border-navy bg-navy text-white"
                      : "border-line-2 bg-white text-navy hover:bg-cloud",
                  )}
                >
                  {EXCUSE_STATUS_META[st].label}
                </Link>
              ))}
            </nav>
          </div>

          {data.excuses.length === 0 ? (
            <TactileCard className="text-center text-muted">
              No hay excusas con este filtro.
            </TactileCard>
          ) : (
            <ul className="grid gap-3">
              {data.excuses.map((ex) => (
                <TactileCard as="li" key={ex.id} className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
                        {ex.studentName} · {ex.gradeName} ({ex.groupName})
                      </p>
                      <h3 className="mt-0.5 text-base">
                        {EXCUSE_REASON_LABELS[ex.reasonType as ExcuseReasonType] ?? ex.reasonType}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExcuseBadge status={ex.status} />
                      <span className="text-xs font-semibold text-muted tabular">
                        {formatDateRange(ex.fromDate, ex.toDate)}
                      </span>
                    </div>
                  </div>

                  {ex.description && <p className="text-sm text-ink-2">{ex.description}</p>}

                  {ex.guardianName && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <UserRound className="size-3.5" aria-hidden />
                      Radicada por: {ex.guardianName}
                    </p>
                  )}

                  {ex.status === "PENDING" ? (
                    <ExcuseReviewControls excuseId={ex.id} />
                  ) : (
                    ex.reviewNotes && (
                      <p className="rounded-control bg-cloud px-3 py-2 text-xs font-semibold text-navy">
                        Observación ({ex.reviewerName ?? "Coordinación"}): {ex.reviewNotes}
                      </p>
                    )
                  )}
                </TactileCard>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="novedades-dia" className="grid content-start gap-3">
          <SectionHeader
            id="novedades-dia"
            title="Novedades del día"
            description="Fallas, retardos y excusas registradas en la fecha elegida."
          />
          {data.incidents.length === 0 ? (
            <TactileCard className="text-center text-sm text-muted">
              Sin novedades de inasistencia registradas para el {formatDay(date)}.
            </TactileCard>
          ) : (
            <ul className="grid gap-2">
              {data.incidents.map((inc) => (
                <TactileCard as="li" key={inc.id} className="grid gap-1.5 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-navy">{inc.studentName}</span>
                    <AttendanceBadge status={inc.status} compact />
                  </div>
                  <p className="text-xs font-semibold text-muted">
                    {inc.groupName} · {inc.subjectName ?? "Jornada"}
                  </p>
                  {inc.notes && <p className="text-xs text-ink-2">{inc.notes}</p>}
                </TactileCard>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
