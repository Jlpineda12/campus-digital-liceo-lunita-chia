"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import { emitToast } from "@/components/ui/ToastViewport";
import type { MigrationSourceKind } from "@/db/schema/migration";
import { LEVEL_CODES, LEVEL_LABELS, type LevelCode } from "@/modules/core/academic-structure/constants";
import { runMigrationAction, type MigrationActionState } from "@/modules/migration/actions";
import type {
  AvailableQuizTarget,
  MigrationBatchItem,
  ReconciliationGroupRow,
  SimatStudentRow,
} from "@/modules/migration/queries";

const INITIAL: MigrationActionState = { status: "idle" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const FLOW_META: Record<
  MigrationSourceKind,
  {
    title: string;
    subtitle: string;
    accept: string;
    templateLabel: string;
    badge: string;
    icon: "users" | "grades" | "billing" | "moodle";
  }
> = {
  STUDENTS_FAMILIES: {
    title: "Estudiantes, Acudientes y Matrículas",
    subtitle: "Unifica identidad por documento desde SIGA o Excel y matricula automáticamente por curso.",
    accept: ".xlsx,.csv",
    templateLabel: "Plantilla Estudiantes (.xlsx)",
    badge: "SIGA / Excel",
    icon: "users",
  },
  HISTORICAL_GRADES: {
    title: "Histórico de Calificaciones SIEE",
    subtitle: "Carga notas definitivas por asignatura, periodo (1–4) y dimensión Saber/Hacer/Ser.",
    accept: ".xlsx,.csv",
    templateLabel: "Plantilla Notas SIEE (.xlsx)",
    badge: "SIGA Notas",
    icon: "grades",
  },
  BILLING_BALANCES: {
    title: "Cartera y Pagos Previos (Feb–Nov)",
    subtitle: "Concilia pagos y abonos del Mega-Excel del colegio sin duplicar recibos.",
    accept: ".xlsx,.csv",
    templateLabel: "Plantilla Cartera (.xlsx)",
    badge: "Mega-Excel",
    icon: "billing",
  },
  MOODLE_QUIZ_XML: {
    title: "Banco de Preguntas Moodle XML",
    subtitle: "Importa evaluaciones (opción múltiple y verdadero/falso) directo a un cuestionario de Órbita Virtual.",
    accept: ".xml",
    templateLabel: "Ejemplo Moodle (.xml)",
    badge: "Moodle XML",
    icon: "moodle",
  },
};

function FlowIcon({ kind }: { kind: "users" | "grades" | "billing" | "moodle" }) {
  if (kind === "users") return <Users className="size-4" aria-hidden />;
  if (kind === "grades") return <BookOpenCheck className="size-4" aria-hidden />;
  if (kind === "billing") return <Wallet className="size-4" aria-hidden />;
  return <Sparkles className="size-4" aria-hidden />;
}

export function MigrationWorkspace({
  yearName,
  yearNumber,
  reconciliation,
  availableQuizzes,
  batches,
  simatRows,
}: {
  yearName: string;
  yearNumber: number;
  reconciliation: {
    totalActiveStudents: number;
    totalActiveTeachers: number;
    totalGuardianLinks: number;
    totalCourseAssignments: number;
    totalGradesRecorded: number;
    totalBillingCharges: number;
    totalBillingPayments: number;
    totalQuizzes: number;
    totalQuizQuestions: number;
    groups: ReconciliationGroupRow[];
  };
  availableQuizzes: AvailableQuizTarget[];
  batches: MigrationBatchItem[];
  simatRows: SimatStudentRow[];
}) {
  const [tab, setTab] = useState<"etl" | "simat" | "reconciliation">("etl");
  const [sourceKind, setSourceKind] = useState<MigrationSourceKind>("STUDENTS_FAMILIES");
  const [targetQuizId, setTargetQuizId] = useState<string>(availableQuizzes[0]?.activityId ?? "");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const modeInputRef = useRef<HTMLInputElement | null>(null);

  // Filtros SIMAT
  const [simatLevel, setSimatLevel] = useState<"ALL" | LevelCode>("ALL");
  const [simatGroup, setSimatGroup] = useState<string>("ALL");

  const [state, action, pending] = useActionState(runMigrationAction, INITIAL);

  useEffect(() => {
    if (state.status === "executed" && state.message) {
      emitToast({ title: "Migración ejecutada", description: state.message, tone: "success" });
    } else if (state.status === "preview" && state.message) {
      emitToast({ title: "Validación previa lista", description: state.message, tone: "info" });
    } else if (state.status === "error" && state.message) {
      emitToast({ title: "Revisa el archivo", description: state.message, tone: "error" });
    }
  }, [state]);

  const activeFlow = FLOW_META[sourceKind];

  const simatVisibleGroups = useMemo(
    () =>
      simatLevel === "ALL"
        ? reconciliation.groups
        : reconciliation.groups.filter((g) => g.levelCode === simatLevel),
    [reconciliation.groups, simatLevel],
  );

  const filteredSimatRows = useMemo(
    () =>
      simatRows.filter((r) => {
        if (simatLevel !== "ALL" && r.levelCode !== simatLevel) return false;
        if (simatGroup !== "ALL" && r.groupName !== simatGroup) return false;
        return true;
      }),
    [simatRows, simatLevel, simatGroup],
  );

  const buildSimatUrl = (format: "xlsx" | "csv") => {
    const p = new URLSearchParams({ formato: format });
    if (simatLevel !== "ALL") p.set("level", simatLevel);
    if (simatGroup !== "ALL") p.set("group", simatGroup);
    return `/api/admin/migracion/simat?${p.toString()}`;
  };

  return (
    <div className="grid gap-6">
      {/* Banner de seguridad y navegación entre pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-cobalt/20 bg-cloud/75 px-4 py-3">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cobalt text-yellow">
            <Lock className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-extrabold text-navy">
              Centro de Migración y SIMAT · Acceso exclusivo Rectoría y Secretaría
            </p>
            <p className="text-muted">
              Validación previa sin escribir en base de datos, deduplicación por documento y trazabilidad en auditoría.
            </p>
          </div>
        </div>

        <nav aria-label="Secciones de migración" className="inline-flex flex-wrap rounded-control border border-line bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("etl")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold transition-colors ${
              tab === "etl" ? "bg-cobalt text-white" : "text-muted hover:text-navy"
            }`}
          >
            <FileUp className="size-3.5" aria-hidden /> Asistente ETL
          </button>
          <button
            type="button"
            onClick={() => setTab("simat")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold transition-colors ${
              tab === "simat" ? "bg-cobalt text-white" : "text-muted hover:text-navy"
            }`}
          >
            <FileSpreadsheet className="size-3.5" aria-hidden /> Exportador SIMAT
          </button>
          <button
            type="button"
            onClick={() => setTab("reconciliation")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold transition-colors ${
              tab === "reconciliation" ? "bg-cobalt text-white" : "text-muted hover:text-navy"
            }`}
          >
            <ClipboardCheck className="size-3.5" aria-hidden /> Acta de Conciliación ({batches.length})
          </button>
        </nav>
      </div>

      {/* =================================================================
          PESTAÑA 1: ASISTENTE DE MIGRACIÓN ETL (4 FLUJOS)
         ================================================================= */}
      {tab === "etl" && (
        <div className="grid gap-5">
          {/* Selector visual de los 4 flujos */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(FLOW_META) as MigrationSourceKind[]).map((key) => {
              const item = FLOW_META[key];
              const active = sourceKind === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSourceKind(key);
                    setSelectedFileName("");
                  }}
                  className={`card flex flex-col items-start gap-2.5 p-4 text-left transition-all ${
                    active
                      ? "border-cobalt bg-cloud/60 ring-2 ring-cobalt/25"
                      : "bg-white hover:border-cobalt/35 hover:bg-cloud/30"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={`grid size-9 place-items-center rounded-control ${
                        active ? "bg-cobalt text-yellow" : "bg-cloud text-cobalt"
                      }`}
                    >
                      <FlowIcon kind={item.icon} />
                    </span>
                    <span className="rounded-pill bg-bg-2 px-2 py-0.5 text-[0.65rem] font-extrabold text-muted">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-navy">{item.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{item.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Formulario de carga y validación en 2 pasos */}
          <form action={action} className="card grid gap-5 bg-white">
            <input type="hidden" name="sourceKind" value={sourceKind} />
            <input ref={modeInputRef} type="hidden" name="mode" defaultValue="preview" />

            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[0.7rem] font-extrabold tracking-wider text-cobalt uppercase">
                  Paso 1 · Descargar plantilla y subir archivo
                </p>
                <h2 className="mt-0.5 text-lg font-black text-navy">{activeFlow.title}</h2>
                <p className="mt-0.5 text-xs text-muted">{activeFlow.subtitle}</p>
              </div>
              <a
                href={`/api/admin/migracion/plantilla?tipo=${sourceKind}`}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <Download aria-hidden /> {activeFlow.templateLabel}
              </a>
            </div>

            {sourceKind === "MOODLE_QUIZ_XML" && (
              <div>
                <label className="field-label">Cuestionario de destino en Órbita Virtual</label>
                {availableQuizzes.length === 0 ? (
                  <p className="text-xs font-semibold text-orange-solid">
                    Aún no hay cuestionarios creados en Órbita Virtual. Crea primero un cuestionario dentro de un curso.
                  </p>
                ) : (
                  <select
                    name="targetQuizId"
                    value={targetQuizId}
                    onChange={(e) => setTargetQuizId(e.target.value)}
                    className="input min-h-10 text-sm font-semibold"
                  >
                    {availableQuizzes.map((q) => (
                      <option key={q.activityId} value={q.activityId}>
                        {q.groupName} · {q.subjectName} — {q.title} ({q.questionCount} preg. actuales)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="rounded-card border-2 border-dashed border-cobalt/30 bg-cloud/35 p-5 text-center">
              <FileUp className="mx-auto size-8 text-cobalt" aria-hidden />
              <p className="mt-2 text-sm font-bold text-navy">
                {selectedFileName
                  ? `Archivo listo: ${selectedFileName}`
                  : `Selecciona tu archivo (${activeFlow.accept}) · máx. 8 MB`}
              </p>
              <p className="mt-1 text-xs text-muted">
                Primero ejecuta <strong>Validar vista previa</strong> para verificar errores fila por fila sin tocar la base de datos.
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-pill border border-cobalt/40 bg-white px-4 py-2 text-xs font-extrabold text-cobalt transition-colors hover:bg-cobalt hover:text-white">
                <FileUp className="size-3.5" aria-hidden />
                {selectedFileName ? "Cambiar archivo" : "Elegir archivo desde mi equipo"}
                <input
                  type="file"
                  name="file"
                  required
                  accept={activeFlow.accept}
                  onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                disabled={pending}
                onClick={() => {
                  if (modeInputRef.current) modeInputRef.current.value = "preview";
                }}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <ShieldCheck aria-hidden />
                {pending ? "Analizando…" : "1. Validar vista previa (sin guardar)"}
              </button>

              <button
                type="submit"
                disabled={pending || (sourceKind === "MOODLE_QUIZ_XML" && availableQuizzes.length === 0)}
                onClick={() => {
                  if (modeInputRef.current) modeInputRef.current.value = "execute";
                }}
                className={pillButtonClass({ variant: "navy", size: "sm" })}
              >
                <Database aria-hidden />
                {pending ? "Importando…" : "2. Ejecutar migración auditada"}
              </button>
            </div>
          </form>

          {/* Resultado de validación previa o ejecución real */}
          {state.status !== "idle" && (
            <section
              aria-label="Resultado de migración"
              className={`card grid gap-4 bg-white ${
                state.status === "error"
                  ? "border-red-solid/40"
                  : state.status === "executed"
                    ? "border-green-solid/40"
                    : "border-cobalt/35"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {state.status === "error" ? (
                    <AlertTriangle className="size-5 text-red-solid" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-5 text-green-solid" aria-hidden />
                  )}
                  <p className="text-sm font-extrabold text-navy">{state.message}</p>
                </div>
                {state.fileName && <Chip tone="blue">{state.fileName}</Chip>}
              </div>

              {state.totalRows !== undefined && (
                <div className="grid grid-cols-2 gap-3 rounded-control border border-line bg-bg-2/60 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="font-bold text-muted uppercase">Filas leídas</p>
                    <p className="mt-0.5 text-lg font-black text-navy tabular">{state.totalRows}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted uppercase">Válidas</p>
                    <p className="mt-0.5 text-lg font-black text-green-solid tabular">{state.validCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted uppercase">
                      {state.status === "executed" ? "Creadas / Act." : "Advertencias"}
                    </p>
                    <p className="mt-0.5 text-lg font-black text-cobalt tabular">
                      {state.status === "executed"
                        ? `${state.createdCount ?? 0} / ${state.updatedCount ?? 0}`
                        : (state.issues?.filter((i) => i.severity === "warning").length ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-muted uppercase">Errores</p>
                    <p className="mt-0.5 text-lg font-black text-red-solid tabular">{state.errorCount ?? 0}</p>
                  </div>
                </div>
              )}

              {state.sampleHeaders && state.sampleRows && state.sampleRows.length > 0 && (
                <div className="overflow-x-auto rounded-control border border-line">
                  <table className="tactile-table text-xs">
                    <thead>
                      <tr>
                        {state.sampleHeaders.map((h) => (
                          <th key={h} scope="col">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.sampleRows.map((row, idx) => (
                        <tr key={idx}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="font-medium text-navy">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.issues && state.issues.length > 0 && (
                <div className="grid gap-1.5 rounded-control border border-orange-solid/30 bg-orange-l/35 p-3.5 text-xs">
                  <p className="font-extrabold text-navy">
                    Observaciones detectadas ({state.issues.length})
                  </p>
                  <ul className="grid max-h-48 gap-1 overflow-y-auto">
                    {state.issues.map((issue, idx) => (
                      <li
                        key={idx}
                        className={issue.severity === "error" ? "font-semibold text-red-solid" : "text-ink-2"}
                      >
                        Fila {issue.rowNumber}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* =================================================================
          PESTAÑA 2: EXPORTADOR OFICIAL SIMAT (MEN COLOMBIA)
         ================================================================= */}
      {tab === "simat" && (
        <div className="grid gap-5">
          <section className="card grid gap-4 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="text-[0.7rem] font-extrabold tracking-wider text-cobalt uppercase">
                  Ministerio de Educación Nacional · {yearName}
                </p>
                <h2 className="mt-0.5 text-lg font-black text-navy">Exportador Oficial SIMAT</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Genera el reporte oficial de matrícula activa con documento, grado, grupo y acudiente responsable, listo para carga en SIMAT.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={buildSimatUrl("xlsx")} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                  <Download aria-hidden /> Descargar SIMAT (.xlsx)
                </a>
                <a href={buildSimatUrl("csv")} className={pillButtonClass({ variant: "outline", size: "sm" })}>
                  <Download aria-hidden /> Plano SIMAT (.csv)
                </a>
              </div>
            </div>

            {/* Filtros por Nivel y Curso */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap rounded-control border border-line bg-bg-2 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSimatLevel("ALL");
                    setSimatGroup("ALL");
                  }}
                  className={`rounded-md px-3 py-1.5 font-bold ${
                    simatLevel === "ALL" ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
                  }`}
                >
                  Todo el colegio ({simatRows.length})
                </button>
                {LEVEL_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setSimatLevel(code);
                      setSimatGroup("ALL");
                    }}
                    className={`rounded-md px-3 py-1.5 font-bold ${
                      simatLevel === code ? "bg-white text-cobalt shadow-2xs" : "text-muted hover:text-navy"
                    }`}
                  >
                    {LEVEL_LABELS[code]} ({simatRows.filter((r) => r.levelCode === code).length})
                  </button>
                ))}
              </div>

              <select
                aria-label="Filtrar SIMAT por curso"
                value={simatGroup}
                onChange={(e) => setSimatGroup(e.target.value)}
                className="input min-h-9 w-auto py-1 text-xs font-bold"
              >
                <option value="ALL">Todos los cursos ({simatVisibleGroups.length})</option>
                {simatVisibleGroups.map((g) => (
                  <option key={g.groupId} value={g.groupName}>
                    {g.groupName} · {g.gradeName} ({g.activeStudents})
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-control border border-line">
              <table className="tactile-table text-xs">
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Apellidos y nombres</th>
                    <th scope="col">Nivel / Grado</th>
                    <th scope="col">Grupo</th>
                    <th scope="col">Acudiente responsable</th>
                    <th scope="col">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSimatRows.slice(0, 25).map((r) => (
                    <tr key={r.enrollmentId}>
                      <td className="font-mono font-bold text-navy tabular">
                        {r.documentType} {r.documentNumber}
                      </td>
                      <td className="font-bold text-navy">
                        {r.lastName}, {r.firstName}
                      </td>
                      <td className="text-muted">
                        {LEVEL_LABELS[r.levelCode]} · {r.gradeName}
                      </td>
                      <td>
                        <Chip tone="blue">{r.groupName}</Chip>
                      </td>
                      <td className="text-ink-2">{r.guardianName || "Sin vincular"}</td>
                      <td className="text-muted tabular">{r.guardianPhone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredSimatRows.length > 25 && (
              <p className="text-right text-xs text-muted">
                Mostrando 25 de <strong>{filteredSimatRows.length}</strong> registros. La descarga incluye el 100%.
              </p>
            )}
          </section>
        </div>
      )}

      {/* =================================================================
          PESTAÑA 3: ACTA DE CONCILIACIÓN DE DATOS E HISTORIAL DE LOTES
         ================================================================= */}
      {tab === "reconciliation" && (
        <div className="grid gap-6">
          <section className="card grid gap-4 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-[0.7rem] font-extrabold tracking-wider text-cobalt uppercase">
                  Verificación de cifras · {yearName} ({yearNumber})
                </p>
                <h2 className="mt-0.5 text-lg font-black text-navy">Acta de Conciliación de Datos</h2>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className={`no-print ${pillButtonClass({ variant: "outline", size: "sm" })}`}
              >
                <Printer aria-hidden /> Imprimir acta
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-control border border-line bg-bg-2/60 p-3.5">
                <p className="text-[0.68rem] font-bold text-muted uppercase">Estudiantes activos</p>
                <p className="mt-1 text-2xl font-black text-navy tabular">{reconciliation.totalActiveStudents}</p>
                <p className="text-[0.7rem] text-muted">{reconciliation.totalGuardianLinks} vínculos familiares</p>
              </div>
              <div className="rounded-control border border-line bg-bg-2/60 p-3.5">
                <p className="text-[0.68rem] font-bold text-muted uppercase">Docentes y cargas</p>
                <p className="mt-1 text-2xl font-black text-navy tabular">{reconciliation.totalActiveTeachers}</p>
                <p className="text-[0.7rem] text-muted">{reconciliation.totalCourseAssignments} cursos asignados</p>
              </div>
              <div className="rounded-control border border-line bg-bg-2/60 p-3.5">
                <p className="text-[0.68rem] font-bold text-muted uppercase">Notas y Órbita Virtual</p>
                <p className="mt-1 text-2xl font-black text-cobalt tabular">{reconciliation.totalGradesRecorded}</p>
                <p className="text-[0.7rem] text-muted">
                  {reconciliation.totalQuizzes} quices · {reconciliation.totalQuizQuestions} preguntas
                </p>
              </div>
              <div className="rounded-control border border-line bg-bg-2/60 p-3.5">
                <p className="text-[0.68rem] font-bold text-muted uppercase">Cartera escolar</p>
                <p className="mt-1 text-2xl font-black text-green-solid tabular">{reconciliation.totalBillingCharges}</p>
                <p className="text-[0.7rem] text-muted">{reconciliation.totalBillingPayments} recibos conciliados</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-control border border-line">
              <table className="tactile-table text-xs">
                <thead>
                  <tr>
                    <th scope="col">Nivel</th>
                    <th scope="col">Grado</th>
                    <th scope="col">Grupo</th>
                    <th scope="col" className="text-right">Estudiantes activos</th>
                    <th scope="col" className="text-right">Asignaturas / Cargas</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.groups.map((g) => (
                    <tr key={g.groupId}>
                      <td className="font-semibold text-muted">{LEVEL_LABELS[g.levelCode]}</td>
                      <td className="font-bold text-navy">{g.gradeName}</td>
                      <td><Chip tone="blue">{g.groupName}</Chip></td>
                      <td className="text-right font-black text-navy tabular">{g.activeStudents}</td>
                      <td className="text-right font-semibold text-ink-2 tabular">{g.courseAssignmentsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bitácora de lotes ejecutados */}
          <section className="card overflow-hidden bg-white p-0">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <History className="size-4 text-cobalt" aria-hidden />
              <h2 className="text-sm font-extrabold text-navy">Historial de migraciones ejecutadas ({batches.length})</h2>
            </div>
            {batches.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-muted">
                Aún no se han ejecutado lotes de migración en {yearName}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tactile-table text-xs">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Flujo</th>
                      <th scope="col">Archivo</th>
                      <th scope="col">Ejecutado por</th>
                      <th scope="col" className="text-right">Creados / Act. / Omit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td className="whitespace-nowrap text-muted tabular">{dateFormat.format(b.createdAt)}</td>
                        <td className="font-bold text-navy">{FLOW_META[b.sourceKind].title}</td>
                        <td className="font-mono text-ink-2">{b.fileName}</td>
                        <td className="text-muted">{b.actorName}</td>
                        <td className="text-right font-bold tabular">
                          <span className="text-green-solid">{b.createdCount}</span> /{" "}
                          <span className="text-cobalt">{b.updatedCount}</span> /{" "}
                          <span className="text-muted">{b.skippedCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
