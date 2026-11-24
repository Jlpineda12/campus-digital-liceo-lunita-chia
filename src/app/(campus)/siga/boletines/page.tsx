import { AlertTriangle, BookOpen, CheckCircle2, Eye, Lock, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PeriodTabs } from "@/components/siga/PeriodTabs";
import { OfficialReportCard } from "@/components/siga/report-cards/OfficialReportCard";
import {
  DirectorObservationForm,
  IssueGroupReportCardsForm,
} from "@/components/siga/report-cards/ReportCardControls";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { pillButtonClass } from "@/components/ui/PillButton";
import { TactileCard } from "@/components/ui/TactileCard";
import {
  getCurrentAcademicContext,
  getDirectedGroups,
  getGuardianChildren,
  getInstitutionOverview,
  getStudentPlacement,
  type AcademicContext,
} from "@/modules/core/academic-structure/queries";
import { requireSession } from "@/modules/core/auth/guards";
import { can } from "@/modules/core/auth/permissions";
import { resolveSelectedChildId } from "@/modules/core/auth/policies";
import type { SessionUser } from "@/modules/core/auth/session";
import { stageForLevel } from "@/modules/core/dashboard/stage";
import {
  getStudentReportCardDocument,
  listGroupReportCards,
  listIssuedPeriodIdsForStudent,
} from "@/modules/siga/report-cards/queries";
import { formatScore } from "@/modules/siga/siee-grades/calculator";

export const metadata: Metadata = { title: "Boletines" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SAFE_HOST = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

async function resolveOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const rawHost = h.get("host") ?? "localhost:3000";
  const host = SAFE_HOST.test(rawHost) ? rawHost : "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default async function BoletinesPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  const params = await searchParams;
  const context = await getCurrentAcademicContext();

  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  // Por defecto elegir el último periodo cerrado (donde suele haber boletín oficial), o el vigente.
  const defaultPeriod =
    [...context.periods].reverse().find((p) => p.gradesLocked) ??
    context.currentPeriod ??
    context.periods[0];
  const requestedPeriod = single(params.periodo);
  const period = context.periods.find((p) => p.id === requestedPeriod) ?? defaultPeriod;
  if (!period) {
    return <TactileCard className="text-center text-muted">No hay periodos configurados.</TactileCard>;
  }

  const origin = await resolveOrigin();

  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    return (
      <FamilyReportCardView
        actor={actor}
        context={context}
        requestedPeriodId={requestedPeriod}
        fallbackPeriodId={period.id}
        origin={origin}
      />
    );
  }

  return (
    <StaffOrDirectorReportCardView
      actor={actor}
      context={context}
      periodId={period.id}
      requestedGroupId={single(params.grupo)}
      previewEnrollmentId={single(params.estudiante)}
      origin={origin}
    />
  );
}

/** Ilustración SVG táctil de boletín reservado hasta habilitación de Rectoría. */
function LockedReportCardIllustration() {
  return (
    <svg
      viewBox="0 0 112 112"
      width={92}
      height={92}
      className="mx-auto shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rcLockBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E7E8FB" />
          <stop offset="100%" stopColor="#DDF4FF" />
        </linearGradient>
        <linearGradient id="rcShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#303296" />
          <stop offset="100%" stopColor="#0F1747" />
        </linearGradient>
        <linearGradient id="rcGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD84D" />
          <stop offset="100%" stopColor="#F0A500" />
        </linearGradient>
      </defs>
      {/* Fondo circular suave */}
      <circle cx="56" cy="56" r="50" fill="url(#rcLockBg)" />
      {/* Hoja de boletín 3D */}
      <rect x="26" y="18" width="52" height="66" rx="11" fill="#CBD5E1" transform="translate(0 4)" />
      <rect x="26" y="18" width="52" height="66" rx="11" fill="#FFFFFF" stroke="#303296" strokeWidth="2.5" />
      <rect x="34" y="28" width="28" height="6" rx="3" fill="#303296" />
      <rect x="34" y="40" width="36" height="4.5" rx="2.25" fill="#CBD5E1" />
      <rect x="34" y="50" width="32" height="4.5" rx="2.25" fill="#CBD5E1" />
      <rect x="34" y="60" width="24" height="4.5" rx="2.25" fill="#E2E8F0" />
      {/* Candado dorado táctil de Rectoría */}
      <g transform="translate(56 54)">
        <circle cx="20" cy="24" r="22" fill="#0F1747" opacity="0.14" transform="translate(0 3)" />
        <circle cx="20" cy="22" r="22" fill="url(#rcShield)" stroke="#FFFFFF" strokeWidth="3" />
        <path
          d="M13 20V16.5a7 7 0 0 1 14 0V20"
          fill="none"
          stroke="#FFC800"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <rect x="10" y="19" width="20" height="15" rx="4.5" fill="url(#rcGold)" stroke="#0F1747" strokeWidth="1.5" />
        <circle cx="20" cy="25.5" r="2.2" fill="#0F1747" />
        <rect x="18.9" y="26.5" width="2.2" height="4" rx="1" fill="#0F1747" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Estudiante y Acudiente (requiere habilitación explícita de Rectoría)
   --------------------------------------------------------------------------- */
async function FamilyReportCardView({
  actor,
  context,
  requestedPeriodId,
  fallbackPeriodId,
  origin,
}: {
  actor: SessionUser;
  context: AcademicContext;
  requestedPeriodId?: string;
  fallbackPeriodId: string;
  origin: string;
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

  const issuedPeriodIds = await listIssuedPeriodIdsForStudent(placement.enrollmentId);
  const latestIssuedPeriod = [...context.periods].reverse().find((p) => issuedPeriodIds.has(p.id));
  const selectedPeriod =
    context.periods.find((p) => p.id === requestedPeriodId) ??
    latestIssuedPeriod ??
    context.periods.find((p) => p.id === fallbackPeriodId) ??
    context.periods[0]!;

  // Regla estricta de Rectoría: estudiantes y padres SOLO ven boletines con `issuedAt !== null`.
  const doc = await getStudentReportCardDocument({
    enrollmentId: placement.enrollmentId,
    periodId: selectedPeriod.id,
    origin,
    requireIssued: true,
  });

  return (
    <div data-stage={stageForLevel(placement.levelCode)} className="grid gap-6">
      <header className="no-print grid gap-3">
        <div>
          <p className="kicker">
            {placement.gradeName} · {placement.groupName}
          </p>
          <h1 className="mt-1 text-step-3">
            {actor.role === "GUARDIAN" ? `Boletines de ${studentName}` : "Mis boletines"}
          </h1>
          <p className="mt-1 text-muted">
            Los boletines oficiales se habilitan por Rectoría al cierre de cada periodo y cuentan con código QR verificable.
          </p>
        </div>

        <nav aria-label="Periodos académicos" className="flex flex-wrap gap-1.5">
          {context.periods.map((p) => {
            const current = p.id === selectedPeriod.id;
            const enabled = issuedPeriodIds.has(p.id);
            return (
              <Link
                key={p.id}
                href={`/siga/boletines?periodo=${p.id}`}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-semibold no-underline transition-colors duration-150",
                  current
                    ? "border-navy bg-navy text-white"
                    : "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-cloud",
                )}
              >
                <span>Periodo {p.number}</span>
                {enabled ? (
                  <CheckCircle2
                    className={cx("size-3.5", current ? "text-yellow" : "text-green-solid")}
                    aria-label="habilitado por Rectoría"
                  />
                ) : (
                  <Lock className="size-3.5 opacity-65" aria-label="pendiente de habilitación por Rectoría" />
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {doc ? (
        <OfficialReportCard doc={doc} />
      ) : (
        <TactileCard className="mx-auto grid max-w-2xl gap-4 py-8 text-center">
          <LockedReportCardIllustration />
          <div className="grid gap-1.5">
            <div className="flex justify-center">
              <Chip tone="sky">
                <Lock aria-hidden />
                <span>Pendiente de habilitación por Rectoría</span>
              </Chip>
            </div>
            <h2 className="mt-1 text-step-2">
              Boletín de {selectedPeriod.name} aún no disponible
            </h2>
            <p className="mx-auto max-w-lg text-sm text-muted">
              Por disposición institucional, los boletines oficiales solo pueden ser consultados por estudiantes y padres
              de familia una vez que <strong>Rectoría</strong> finaliza la validación del comité de evaluación y habilita
              su publicación.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {latestIssuedPeriod && latestIssuedPeriod.id !== selectedPeriod.id && (
              <Link
                href={`/siga/boletines?periodo=${latestIssuedPeriod.id}`}
                className={pillButtonClass({ variant: "navy", size: "sm" })}
              >
                <CheckCircle2 aria-hidden />
                Ver {latestIssuedPeriod.name} (habilitado)
              </Link>
            )}
            <Link
              href={`/siga/calificaciones?periodo=${selectedPeriod.id}`}
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              <BookOpen aria-hidden />
              Consultar seguimiento de notas
            </Link>
          </div>
        </TactileCard>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Docente (Director de Grupo), Coordinación y Secretaría / Rectoría
   --------------------------------------------------------------------------- */
async function StaffOrDirectorReportCardView({
  actor,
  context,
  periodId,
  requestedGroupId,
  previewEnrollmentId,
  origin,
}: {
  actor: SessionUser;
  context: AcademicContext;
  periodId: string;
  requestedGroupId?: string;
  previewEnrollmentId?: string;
  origin: string;
}) {
  const canIssue = can(actor.role, "reportCards.issue");
  const isStaff = can(actor.role, "reportCards.preview");

  const availableGroups: Array<{ groupId: string; groupName: string; gradeName: string }> = isStaff
    ? (await getInstitutionOverview(context.year.id)).groups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        gradeName: g.gradeName,
      }))
    : (await getDirectedGroups(actor.id, context.year.id)).map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        gradeName: g.gradeName,
      }));

  if (availableGroups.length === 0) {
    return (
      <TactileCard className="text-center">
        <h1 className="text-lg">Boletines del grupo</h1>
        <p className="mt-1 text-muted">
          Esta vista está habilitada para Directores de Grupo, Coordinación y Secretaría.
        </p>
      </TactileCard>
    );
  }

  const selectedGroup =
    availableGroups.find((g) => g.groupId === requestedGroupId) ?? availableGroups[0]!;
  const period = context.periods.find((p) => p.id === periodId)!;

  const rows = await listGroupReportCards({
    groupId: selectedGroup.groupId,
    academicYearId: context.year.id,
    periodId: period.id,
  });

  const validPreview = previewEnrollmentId
    ? rows.find((r) => r.enrollmentId === previewEnrollmentId)
    : undefined;
  const previewDoc = validPreview
    ? await getStudentReportCardDocument({
        enrollmentId: validPreview.enrollmentId,
        periodId: period.id,
        origin,
      })
    : null;

  const issuedCount = rows.filter((r) => r.issuedAt !== null).length;

  return (
    <div className="grid gap-6">
      <header className="no-print grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker">Boletines oficiales · {context.year.name}</p>
            <h1 className="mt-1 text-step-3">
              Boletines · {selectedGroup.gradeName} ({selectedGroup.groupName})
            </h1>
            <p className="mt-1 text-muted">
              {period.name} · {issuedCount} de {rows.length} habilitados por Rectoría para consulta de estudiantes y padres.
            </p>
          </div>

          {availableGroups.length > 1 && (
            <form method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="periodo" value={period.id} />
              <div>
                <label htmlFor="rc-grupo" className="field-label">
                  Grupo
                </label>
                <select
                  id="rc-grupo"
                  name="grupo"
                  defaultValue={selectedGroup.groupId}
                  className="input min-h-10 py-1.5 text-sm font-semibold"
                >
                  {availableGroups.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.groupName} · {g.gradeName}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
                Ver grupo
              </button>
            </form>
          )}
        </div>

        <PeriodTabs
          periods={context.periods}
          selectedId={period.id}
          hrefFor={(id) => `/siga/boletines?grupo=${selectedGroup.groupId}&periodo=${id}`}
        />

        {canIssue ? (
          <IssueGroupReportCardsForm
            groupId={selectedGroup.groupId}
            groupName={selectedGroup.groupName}
            periodId={period.id}
            periodName={period.name}
            issuedCount={issuedCount}
            totalCount={rows.length}
          />
        ) : (
          <div className="flex items-center gap-2.5 rounded-control border border-line bg-cloud/80 px-3.5 py-2.5 text-sm text-ink-2">
            <ShieldAlert className="size-4 shrink-0 text-cobalt" aria-hidden />
            <p>
              Puedes redactar observaciones y revisar vistas previas. La habilitación para estudiantes y padres es
              exclusiva de <strong>Rectoría</strong>.
            </p>
          </div>
        )}
      </header>

      {previewDoc && (
        <section aria-label="Vista previa del boletín" className="grid gap-3">
          <div className="no-print flex items-center justify-between">
            <h2 className="text-lg">Vista del boletín seleccionado</h2>
            <Link
              href={`/siga/boletines?grupo=${selectedGroup.groupId}&periodo=${period.id}`}
              className="text-sm font-semibold text-sky-solid"
            >
              Cerrar vista previa
            </Link>
          </div>
          <OfficialReportCard doc={previewDoc} />
        </section>
      )}

      <section aria-labelledby="lista-boletines" className="no-print grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 id="lista-boletines" className="text-lg">
            Estudiantes de {selectedGroup.groupName} ({rows.length})
          </h2>
          <p className="text-xs text-muted">
            Revisa la vista previa o redacta observaciones de dirección de grupo antes de habilitar.
          </p>
        </div>

        <ul className="card divide-y divide-line p-0">
          {rows.map((r) => (
            <li key={r.enrollmentId} className="grid gap-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-navy">{r.studentName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {r.issuedAt ? (
                      <Chip tone={r.isStale ? "orange" : "green"}>
                        {r.isStale ? <AlertTriangle aria-hidden /> : <CheckCircle2 aria-hidden />}
                        <span>{r.isStale ? "Desactualizado" : "Habilitado"}</span>
                      </Chip>
                    ) : (
                      <Chip tone="sky">
                        <Lock aria-hidden /> Oculto
                      </Chip>
                    )}
                    {r.averageScore !== null && r.performanceLevel && (
                      <PerformanceBadge level={r.performanceLevel} />
                    )}
                    {r.averageScore !== null && (
                      <span className="font-bold text-navy tabular">Prom. {formatScore(r.averageScore)}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <DirectorObservationForm
                    enrollmentId={r.enrollmentId}
                    periodId={period.id}
                    studentName={r.studentName}
                    initialValue={r.directorObservations}
                  />
                  <Link
                    href={`/siga/boletines?grupo=${selectedGroup.groupId}&periodo=${period.id}&estudiante=${r.enrollmentId}`}
                    className={pillButtonClass({ variant: "outline", size: "sm" })}
                  >
                    <Eye aria-hidden /> Ver boletín
                  </Link>
                </div>
              </div>

              {r.directorObservations && (
                <p className="rounded-control bg-cloud/60 px-3 py-2 text-xs leading-relaxed text-ink-2">
                  <strong className="text-navy">Observación:</strong> {r.directorObservations}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
