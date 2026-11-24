import { Award, BarChart3, Clock, Lock, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddColumnForm } from "@/components/siga/AddColumnForm";
import { CourseSelect, type CourseSelectGroup } from "@/components/siga/CourseSelect";
import { Gradebook } from "@/components/siga/Gradebook";
import { LogrosEditor } from "@/components/siga/LogrosEditor";
import { PeriodTabs } from "@/components/siga/PeriodTabs";
import { RectoriaComplianceDashboard } from "@/components/siga/RectoriaComplianceDashboard";
import { StudentGrades } from "@/components/siga/StudentGrades";
import { cx } from "@/components/ui/cx";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { TactileCard } from "@/components/ui/TactileCard";
import {
  getCurrentAcademicContext,
  getGuardianChildren,
  getStudentPlacement,
  type AcademicContext,
} from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import { canEditGradebook, canViewGradebook, getCourseContext } from "@/modules/siga/siee-grades/access";
import { remainingWeight } from "@/modules/siga/siee-grades/calculator";
import { getPeriodComplianceOverview } from "@/modules/siga/siee-grades/compliance";
import { countFilledLogros } from "@/modules/siga/siee-grades/logros";
import {
  getEditState,
  getGradebook,
  getScaleForYear,
  getStudentPeriodGrades,
  listCopyableLogroSources,
  listGradebookCourses,
} from "@/modules/siga/siee-grades/queries";

export const metadata: Metadata = { title: "Calificaciones" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const expiresFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

export default async function CalificacionesPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  const params = await searchParams;
  const context = await getCurrentAcademicContext();
  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }
  const requested = single(params.periodo);
  const period =
    context.periods.find((p) => p.id === requested) ?? context.currentPeriod ?? context.periods[0];
  if (!period) notFound();

  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    return <FamilyView actor={actor} context={context} periodId={period.id} />;
  }
  const requestedCourse = single(params.curso);
  const rawView = single(params.vista);
  const isExecutive = can(actor.role, "dashboard.executive");
  const activeTab: "seguimiento" | "planilla" | "logros" =
    rawView === "logros"
      ? "logros"
      : rawView === "planilla"
        ? "planilla"
        : rawView === "seguimiento" || (isExecutive && !requestedCourse)
          ? "seguimiento"
          : "planilla";
  return (
    <GradebookView
      actor={actor}
      context={context}
      periodId={period.id}
      requestedCourse={requestedCourse}
      activeTab={activeTab}
    />
  );
}

/* ---------------------------------------------------------------------------
   Estudiante y acudiente
   --------------------------------------------------------------------------- */
async function FamilyView({
  actor,
  context,
  periodId,
}: {
  actor: SessionUser;
  context: AcademicContext;
  periodId: string;
}) {
  let studentId = actor.id;
  let studentName = actor.firstName;
  if (actor.role === "GUARDIAN") {
    // Solo hijos vinculados (guardian_links); la cookie elige entre ellos.
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
  const scale = await getScaleForYear(context.year.id);
  const subjects = await getStudentPeriodGrades({
    enrollmentId: placement.enrollmentId,
    groupId: placement.groupId,
    periodId,
    scale,
  });
  const period = context.periods.find((p) => p.id === periodId)!;

  return (
    <div data-stage={stageForLevel(placement.levelCode)} className="grid gap-6">
      <header className="grid gap-3">
        <div>
          <p className="kicker">
            {placement.gradeName} · {placement.groupName}
          </p>
          <h1 className="mt-1 text-step-3">
            {actor.role === "GUARDIAN" ? `Calificaciones de ${studentName}` : "Mis calificaciones"}
          </h1>
          <p className="mt-1 text-muted">
            {period.name} · {period.gradesLocked ? "notas definitivas" : "notas parciales (el periodo sigue abierto)"}
          </p>
        </div>
        <PeriodTabs
          periods={context.periods}
          selectedId={periodId}
          hrefFor={(id) => `/siga/calificaciones?periodo=${id}`}
        />
      </header>
      <StudentGrades subjects={subjects} scale={scale} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Docente (edición) y directivos (consulta)
   --------------------------------------------------------------------------- */
async function GradebookView({
  actor,
  context,
  periodId,
  requestedCourse,
  activeTab,
}: {
  actor: SessionUser;
  context: AcademicContext;
  periodId: string;
  requestedCourse: string | undefined;
  activeTab: "seguimiento" | "planilla" | "logros";
}) {
  const isExecutive = can(actor.role, "dashboard.executive");
  const period = context.periods.find((p) => p.id === periodId)!;

  if (isExecutive && activeTab === "seguimiento") {
    const overview = await getPeriodComplianceOverview(context.year.id, period.id);
    return (
      <div className="grid gap-6">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="kicker">Rectoría y Coordinación · Seguimiento SIEE</p>
              <h1 className="mt-1 text-step-3">Control de calificaciones y logros</h1>
              <p className="mt-1 text-sm text-muted">
                Monitorea el avance de notas y logros por docente y por grupo en {period.name}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <PeriodTabs
              periods={context.periods}
              selectedId={period.id}
              hrefFor={(id) => `/siga/calificaciones?periodo=${id}&vista=seguimiento`}
            />

            <nav aria-label="Modo de visualización" className="inline-flex rounded-control border border-line bg-bg-2 p-1">
              <Link
                href={`/siga/calificaciones?periodo=${period.id}&vista=seguimiento`}
                aria-current="page"
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-navy no-underline shadow-2xs"
              >
                <BarChart3 className="size-4" aria-hidden />
                Seguimiento docente
              </Link>
              <Link
                href={`/siga/calificaciones?periodo=${period.id}&vista=planilla`}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-muted no-underline transition-colors hover:text-navy"
              >
                <Table2 className="size-4" aria-hidden />
                Explorar planillas
              </Link>
            </nav>
          </div>
        </header>

        <RectoriaComplianceDashboard data={overview} periodId={period.id} periodName={period.name} />
      </div>
    );
  }

  const courses = await listGradebookCourses(actor, context.year.id);
  if (courses.length === 0) {
    return (
      <TactileCard className="text-center">
        <h1 className="text-lg">Planilla de calificaciones</h1>
        <p className="mt-1 text-muted">No tienes cargas académicas asignadas este año.</p>
      </TactileCard>
    );
  }
  const selected = courses.find((c) => c.courseAssignmentId === requestedCourse) ?? courses[0]!;
  const course = await getCourseContext(selected.courseAssignmentId);
  if (!course || !canViewGradebook(actor, course)) notFound();

  const [gradebook, editState, scale, copySources] = await Promise.all([
    getGradebook(course, period.id),
    getEditState(period, course.courseAssignmentId),
    getScaleForYear(course.academicYearId),
    activeTab === "logros"
      ? listCopyableLogroSources({ actor, course, currentPeriodId: period.id })
      : Promise.resolve([]),
  ]);
  const isOwner = canEditGradebook(actor, course);
  const editable = isOwner && editState.editable;
  const logrosProgress = countFilledLogros(gradebook.dimensions);

  const groups: CourseSelectGroup[] = [];
  for (const c of courses) {
    let group = groups.find((g) => g.label === c.groupName);
    if (!group) {
      group = { label: c.groupName, options: [] };
      groups.push(group);
    }
    group.options.push({ value: c.courseAssignmentId, label: `${c.subjectName} · ${c.groupName}` });
  }

  const baseHref = `/siga/calificaciones?curso=${course.courseAssignmentId}&periodo=${period.id}`;

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker">SIGA · Planilla y logros</p>
            <h1 className="mt-1 flex items-center gap-2.5 text-step-3">
              <StheamiBadge pillar={course.pillar} />
              <span>
                {course.subjectName} · {course.groupName}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {period.name} · {gradebook.students.length} estudiantes
              {course.teacherName && !isOwner ? ` · Docente: ${course.teacherName}` : ""}
            </p>
          </div>
          <CourseSelect groups={groups} selected={course.courseAssignmentId} periodId={period.id} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <PeriodTabs
            periods={context.periods}
            selectedId={period.id}
            hrefFor={(id) =>
              `/siga/calificaciones?curso=${course.courseAssignmentId}&periodo=${id}&vista=${activeTab}`
            }
          />

          <nav aria-label="Vista del curso" className="inline-flex flex-wrap rounded-control border border-line bg-bg-2 p-1">
            {isExecutive && (
              <Link
                href={`/siga/calificaciones?periodo=${period.id}&vista=seguimiento`}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-muted no-underline transition-colors hover:text-navy"
              >
                <BarChart3 className="size-4" aria-hidden />
                Seguimiento docente
              </Link>
            )}
            <Link
              href={`${baseHref}&vista=planilla`}
              aria-current={activeTab === "planilla" ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold no-underline transition-colors",
                activeTab === "planilla"
                  ? "bg-white text-navy shadow-2xs"
                  : "text-muted hover:text-navy",
              )}
            >
              <Table2 className="size-4" aria-hidden />
              Planilla de notas
            </Link>
            <Link
              href={`${baseHref}&vista=logros`}
              aria-current={activeTab === "logros" ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold no-underline transition-colors",
                activeTab === "logros"
                  ? "bg-white text-navy shadow-2xs"
                  : "text-muted hover:text-navy",
              )}
            >
              <Award className="size-4" aria-hidden />
              Logros del boletín
              <span
                className={cx(
                  "rounded-chip px-1.5 py-0.2 text-xs font-bold tabular",
                  logrosProgress.filled === logrosProgress.total && logrosProgress.total > 0
                    ? "bg-green-l text-green-solid"
                    : "bg-line text-muted",
                )}
              >
                {logrosProgress.filled}/{logrosProgress.total}
              </span>
            </Link>
          </nav>
        </div>
      </header>

      {!editState.editable && (
        <p role="status" className="flex items-start gap-3 rounded-card border border-line bg-cloud px-4 py-3 text-sm font-semibold text-navy">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <span>
            Periodo cerrado: en modo solo lectura.
            {isOwner && " Solicita una ventana temporal a Coordinación si requieres ajustar notas o logros."}
          </span>
        </p>
      )}
      {editState.editable && editState.via === "window" && (
        <p role="status" className="flex items-start gap-3 rounded-card border border-sky bg-sky-l/60 px-4 py-3 text-sm font-semibold text-navy">
          <Clock className="mt-0.5 size-4 shrink-0 text-sky-solid" aria-hidden />
          <span>
            Edición habilitada temporalmente hasta {expiresFormat.format(editState.window.expiresAt)}. Los cambios
            quedan registrados en la auditoría.
          </span>
        </p>
      )}
      {!isOwner && (
        <p className="text-sm text-muted">
          Vista de consulta: solo el docente titular de la carga puede modificar notas o logros.
        </p>
      )}

      {activeTab === "logros" ? (
        <LogrosEditor
          key={`logros:${course.courseAssignmentId}:${period.id}`}
          courseAssignmentId={course.courseAssignmentId}
          periodId={period.id}
          periodName={period.name}
          subjectName={course.subjectName}
          groupName={course.groupName}
          pillar={course.pillar}
          editable={editable}
          dimensions={gradebook.dimensions.map((d) => ({
            competencyId: d.competencyId,
            dimension: d.dimension,
            description: d.description,
            weightPercent: d.weightPercent,
          }))}
          copySources={copySources}
        />
      ) : (
        <>
          {editable && (
            <AddColumnForm
              courseAssignmentId={course.courseAssignmentId}
              periodId={period.id}
              dimensions={gradebook.dimensions.map((d) => ({
                competencyId: d.competencyId,
                dimension: d.dimension,
                available: remainingWeight(d.columns),
              }))}
            />
          )}

          <Gradebook
            key={`${course.courseAssignmentId}:${period.id}`}
            courseAssignmentId={course.courseAssignmentId}
            periodId={period.id}
            editable={editable}
            scale={scale}
            dimensions={gradebook.dimensions}
            students={gradebook.students}
            scores={gradebook.scores}
            qualitative={gradebook.qualitative}
          />
        </>
      )}
    </div>
  );
}
