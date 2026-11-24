import { Award, ChevronLeft, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { revealStyle } from "@/components/dashboard/parts";
import { CreateObserverForm } from "@/components/siga/observer/CreateObserverForm";
import { ObserverTimeline } from "@/components/siga/observer/ObserverTimeline";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
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
import {
  isObserverCategory,
  OBSERVER_CATEGORIES,
  OBSERVER_CATEGORY_META,
  type ObserverCategory,
} from "@/modules/siga/observer/meta";
import {
  listObserverCandidates,
  listObserverForStaff,
  listStudentObserverRecords,
} from "@/modules/siga/observer/queries";

export const metadata: Metadata = { title: "Observador" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function buildHref(base: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function ObservadorPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSession();
  const params = await searchParams;
  const context = await getCurrentAcademicContext();

  if (!context) {
    return <TactileCard className="text-center text-muted">No hay un año lectivo vigente.</TactileCard>;
  }

  const rawCategory = single(params.categoria);
  const category = isObserverCategory(rawCategory) ? rawCategory : undefined;

  if (actor.role === "STUDENT" || actor.role === "GUARDIAN") {
    return <FamilyObserverView actor={actor} context={context} category={category} />;
  }

  const rawPage = Number(single(params.pagina));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  return (
    <StaffObserverView
      actor={actor}
      context={context}
      category={category}
      groupId={single(params.grupo)}
      pendingOnly={single(params.pendientes) === "1"}
      query={single(params.q)}
      page={page}
    />
  );
}

/* ---------------------------------------------------------------------------
   Vista Estudiante y Acudiente (respeta data-stage del nivel escolar)
   --------------------------------------------------------------------------- */
async function FamilyObserverView({
  actor,
  context,
  category,
}: {
  actor: SessionUser;
  context: AcademicContext;
  category?: ObserverCategory;
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

  const { entries, summary } = await listStudentObserverRecords({
    enrollmentId: placement.enrollmentId,
    category,
  });

  const stage = stageForLevel(placement.levelCode);

  return (
    <div data-stage={stage} className="grid gap-6">
      <header className="grid gap-3">
        <div>
          <p className="kicker">
            {placement.gradeName} · {placement.groupName}
          </p>
          <h1 className="mt-1 text-step-3">
            {actor.role === "GUARDIAN" ? `Observador de ${studentName}` : "Mi observador"}
          </h1>
          <p className="mt-1 text-muted">
            {actor.role === "GUARDIAN"
              ? "Felicitaciones, seguimientos y anotaciones de convivencia con confirmación de lectura."
              : stage === "primaria"
                ? "Aquí guardamos tus felicitaciones y compromisos para seguir creciendo."
                : "Historial de reconocimientos, seguimiento académico y debido proceso de convivencia."}
          </p>
        </div>

        <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-1.5">
          <FilterPill href="/siga/observador" active={!category}>
            Todas ({summary.total})
          </FilterPill>
          {OBSERVER_CATEGORIES.map((cat) => (
            <FilterPill
              key={cat}
              href={buildHref("/siga/observador", { categoria: cat })}
              active={category === cat}
            >
              {OBSERVER_CATEGORY_META[cat].shortLabel}
            </FilterPill>
          ))}
        </nav>
      </header>

      <section
        aria-label="Resumen del observador"
        className="card reveal grid divide-y divide-line p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        style={revealStyle(1)}
      >
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <Award className="size-3.5 text-green-solid" aria-hidden /> Felicitaciones
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">{summary.praise}</p>
        </div>
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <Clock className="size-3.5 text-sky-solid" aria-hidden />
            {actor.role === "GUARDIAN" ? "Pendientes de Enterado" : "Descargos pendientes"}
          </p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">
            {actor.role === "GUARDIAN" ? summary.pendingGuardian : summary.pendingStatement}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Total en {context.year.year}</p>
          <p className="mt-1.5 text-step-3 leading-none font-black text-navy tabular-nums">{summary.total}</p>
        </div>
      </section>

      <ObserverTimeline
        entries={entries}
        viewerRole={actor.role}
        emptyMessage={
          category
            ? "No hay anotaciones en esta categoría para el año en curso."
            : "Aún no se han registrado anotaciones este año."
        }
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Vista Docentes, Coordinación y Secretaría (institucional + paginación)
   --------------------------------------------------------------------------- */
async function StaffObserverView({
  actor,
  context,
  category,
  groupId,
  pendingOnly,
  query,
  page,
}: {
  actor: SessionUser;
  context: AcademicContext;
  category?: ObserverCategory;
  groupId?: string;
  pendingOnly: boolean;
  query?: string;
  page: number;
}) {
  const [data, candidates] = await Promise.all([
    listObserverForStaff({
      actor,
      academicYearId: context.year.id,
      groupId,
      category,
      pendingOnly,
      query,
      page,
    }),
    listObserverCandidates(actor, context.year.id),
  ]);

  const isGlobal = can(actor.role, "observer.review");

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Convivencia y seguimiento · {context.year.name}</p>
          <h1 className="mt-1 text-step-3">Observador del estudiante</h1>
          <p className="mt-1 text-muted">
            {isGlobal
              ? "Seguimiento institucional con debido proceso, descargos y confirmación de acudientes."
              : "Anotaciones de los grupos donde dictas clase o ejerces dirección de grupo."}
          </p>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores del observador">
        <li className="card reveal" style={revealStyle(1)}>
          <p className="text-sm font-semibold text-muted">Total registradas</p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">{data.summary.total}</p>
        </li>
        <li className="card reveal" style={revealStyle(2)}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Award className="size-4 text-green-solid" aria-hidden /> Felicitaciones
          </p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">{data.summary.praise}</p>
        </li>
        <li className="card reveal" style={revealStyle(3)}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Clock className="size-4 text-orange-solid" aria-hidden /> Sin firma acudiente
          </p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.summary.pendingGuardian}
          </p>
        </li>
        <li className="card reveal" style={revealStyle(4)}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <ShieldAlert className="size-4 text-red-solid" aria-hidden /> Tipo II / III
          </p>
          <p className="mt-1 text-step-3 leading-none font-black text-navy tabular-nums">
            {data.summary.escalated}
          </p>
        </li>
      </ul>

      <CreateObserverForm
        groups={candidates}
        periods={context.periods.map((p) => ({ id: p.id, name: p.name }))}
        defaultPeriodId={context.currentPeriod?.id}
      />

      <form method="get" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end">
        <div>
          <label htmlFor="obs-q" className="field-label">
            Buscar estudiante o título
          </label>
          <input
            id="obs-q"
            name="q"
            type="search"
            defaultValue={query ?? ""}
            placeholder="Nombre, apellido o palabra clave…"
            className="input min-h-11 py-2 text-sm font-medium"
          />
        </div>

        <div>
          <label htmlFor="obs-grupo" className="field-label">
            Grupo
          </label>
          <select
            id="obs-grupo"
            name="grupo"
            defaultValue={groupId ?? ""}
            className="input min-h-11 py-2 text-sm font-semibold"
          >
            <option value="">Todos los grupos</option>
            {candidates.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName} · {g.gradeName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="obs-cat" className="field-label">
            Categoría
          </label>
          <select
            id="obs-cat"
            name="categoria"
            defaultValue={category ?? ""}
            className="input min-h-11 py-2 text-sm font-semibold"
          >
            <option value="">Todas</option>
            {OBSERVER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {OBSERVER_CATEGORY_META[cat].shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
            <input
              type="checkbox"
              name="pendientes"
              value="1"
              defaultChecked={pendingOnly}
              className="size-4 accent-navy"
            />
            Sin Enterado
          </label>
          <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
            Filtrar
          </button>
          {(query || groupId || category || pendingOnly) && (
            <Link href="/siga/observador" className="text-sm font-semibold text-sky-solid">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <ObserverTimeline
        entries={data.entries}
        viewerRole={actor.role}
        showStudentHeader
        emptyMessage="No encontramos anotaciones con los filtros seleccionados."
      />

      {data.totalPages > 1 && (
        <nav aria-label="Paginación del observador" className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted tabular">
            Página {data.page} de {data.totalPages} ({data.totalCount} anotaciones)
          </p>
          <div className="flex items-center gap-2">
            {data.page > 1 && (
              <Link
                href={buildHref("/siga/observador", {
                  q: query,
                  grupo: groupId,
                  categoria: category,
                  pendientes: pendingOnly ? "1" : undefined,
                  pagina: String(data.page - 1),
                })}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <ChevronLeft aria-hidden /> Anterior
              </Link>
            )}
            {data.page < data.totalPages && (
              <Link
                href={buildHref("/siga/observador", {
                  q: query,
                  grupo: groupId,
                  categoria: category,
                  pendientes: pendingOnly ? "1" : undefined,
                  pagina: String(data.page + 1),
                })}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                Siguiente <ChevronRight aria-hidden />
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "inline-flex items-center rounded-control border px-3 py-1.5 text-sm font-semibold no-underline transition-colors duration-150",
        active
          ? "border-navy bg-navy text-white"
          : "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-cloud",
      )}
    >
      {children}
    </Link>
  );
}
