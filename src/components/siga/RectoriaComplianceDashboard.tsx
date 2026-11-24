"use client";

import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Search,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import type {
  ComplianceStatus,
  PeriodComplianceOverview,
} from "@/modules/siga/siee-grades/compliance";

const STATUS_META: Record<
  ComplianceStatus,
  { label: string; tone: "green" | "orange" | "red"; icon: "check" | "clock" | "alert" }
> = {
  COMPLETE: { label: "Al día", tone: "green", icon: "check" },
  IN_PROGRESS: { label: "En progreso", tone: "orange", icon: "clock" },
  NOT_STARTED: { label: "Sin iniciar", tone: "red", icon: "alert" },
};

/** Anillo SVG limpio de progreso porcentual (0–100%). */
function DonutGauge({
  percent,
  color,
  track = "#E2E8F0",
  label,
  detail,
}: {
  percent: number;
  color: string;
  track?: string;
  label: string;
  detail: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="relative grid size-20 shrink-0 place-items-center">
        <svg viewBox="0 0 84 84" width={80} height={80} className="-rotate-90" aria-hidden="true">
          <circle cx="42" cy="42" r={radius} fill="none" stroke={track} strokeWidth="7.5" />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-lg font-black text-navy tabular-nums">{percent}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-extrabold tracking-wider text-muted uppercase">{label}</p>
        <p className="mt-1 text-sm font-semibold text-navy">{detail}</p>
      </div>
    </div>
  );
}

/**
 * Tablero visual de seguimiento docente para Rectoría y Coordinación:
 * - Anillos radiales SVG de notas, logros y cumplimiento general.
 * - Gráfico de barras agrupadas SVG por grupo escolar (Notas vs Logros).
 * - Lista filtrable por docente con desglose y acceso directo a planilla/logros.
 */
export function RectoriaComplianceDashboard({
  data,
  periodId,
  periodName,
}: {
  data: PeriodComplianceOverview;
  periodId: string;
  periodName: string;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "complete">("all");
  const [search, setSearch] = useState("");

  const filteredTeachers = useMemo(() => {
    const q = search
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

    return data.teachers.filter((t) => {
      if (filter === "pending" && t.status === "COMPLETE") return false;
      if (filter === "complete" && t.status !== "COMPLETE") return false;
      if (!q) return true;
      const hay = `${t.teacherName} ${t.courses.map((c) => `${c.subjectName} ${c.groupName}`).join(" ")}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data.teachers, filter, search]);

  const shortGroupLabel = (name: string) =>
    name
      .replace(/^Prejardín/i, "Prej.")
      .replace(/^Jardín/i, "Jard.")
      .replace(/^Transición/i, "Trans.");

  const chartWidth = Math.max(760, data.groups.length * 60 + 64);
  const chartHeight = 200;
  const plotTop = 18;
  const plotBottom = 160;
  const plotHeight = plotBottom - plotTop;

  return (
    <div className="grid gap-6">
      {/* 1. Tres indicadores radiales SVG en una sola franja limpia */}
      <section
        aria-label={`Resumen de cumplimiento docente en ${periodName}`}
        className="card grid divide-y divide-line p-0 lg:grid-cols-3 lg:divide-x lg:divide-y-0"
      >
        <DonutGauge
          percent={data.summary.overallGradesPercent}
          color="#0369A1"
          label="Notas subidas"
          detail={`${data.summary.coursesWithColumnsPercent}% de planillas con actividades`}
        />
        <DonutGauge
          percent={data.summary.overallLogrosPercent}
          color="#2F7D00"
          label="Logros redactados"
          detail={`${data.summary.completeCourses} de ${data.summary.totalCourses} materias al día`}
        />
        <div className="flex flex-col justify-center gap-2 px-5 py-4">
          <p className="text-xs font-extrabold tracking-wider text-muted uppercase">
            Estado del equipo docente
          </p>
          <p className="text-step-2 leading-none font-black text-navy tabular-nums">
            {data.summary.teachersComplete}
            <span className="text-sm font-semibold text-muted"> / {data.summary.totalTeachers} al día</span>
          </p>
          <div className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-line">
            {data.summary.totalCourses > 0 && (
              <>
                <div
                  className="bg-green-solid"
                  style={{ width: `${(data.summary.completeCourses / data.summary.totalCourses) * 100}%` }}
                  title={`Al día: ${data.summary.completeCourses}`}
                />
                <div
                  className="bg-orange-solid"
                  style={{ width: `${(data.summary.inProgressCourses / data.summary.totalCourses) * 100}%` }}
                  title={`En progreso: ${data.summary.inProgressCourses}`}
                />
                <div
                  className="bg-red-solid"
                  style={{ width: `${(data.summary.notStartedCourses / data.summary.totalCourses) * 100}%` }}
                  title={`Sin iniciar: ${data.summary.notStartedCourses}`}
                />
              </>
            )}
          </div>
          <p className="text-xs text-muted tabular">
            Planillas:{" "}
            <strong className="text-green-solid">{data.summary.completeCourses}</strong> al día ·{" "}
            <strong className="text-orange-solid">{data.summary.inProgressCourses}</strong> en progreso ·{" "}
            <strong className="text-red-solid">{data.summary.notStartedCourses}</strong> sin iniciar
          </p>
        </div>
      </section>

      {/* 2. Gráfico SVG de barras agrupadas por grupo escolar (Notas vs Logros) */}
      <section aria-labelledby="chart-grupos" className="card grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="chart-grupos" className="text-base font-bold text-navy">
              Avance por grupo escolar · {periodName}
            </h2>
            <p className="text-xs text-muted">
              Compara rápidamente qué grupos ya tienen notas y logros completos antes de habilitar boletines.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-navy">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-sky-solid" aria-hidden /> Notas %
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-green-solid" aria-hidden /> Logros %
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-52 w-full min-w-[640px]"
            role="img"
            aria-label={`Diagrama de barras de avance de notas y logros por grupo en ${periodName}`}
          >
            {/* Líneas guía 0%, 50%, 100% */}
            {[0, 50, 100].map((tick) => {
              const y = plotBottom - (tick / 100) * plotHeight;
              return (
                <g key={tick}>
                  <line
                    x1="36"
                    x2={chartWidth - 12}
                    y1={y}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray={tick === 0 ? undefined : "4 4"}
                  />
                  <text
                    x="30"
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="Inter Variable, system-ui, sans-serif"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {data.groups.map((g, i) => {
              const step = (chartWidth - 56) / Math.max(data.groups.length, 1);
              const centerX = 48 + i * step + step / 2;
              const barW = Math.min(14, Math.max(8, step * 0.28));
              const gradesH = (g.gradesPercent / 100) * plotHeight;
              const logrosH = (g.logrosPercent / 100) * plotHeight;

              return (
                <g key={g.groupId}>
                  {/* Barra Notas */}
                  <rect
                    x={centerX - barW - 1.5}
                    y={plotBottom - Math.max(gradesH, 2)}
                    width={barW}
                    height={Math.max(gradesH, 2)}
                    rx="3"
                    fill={g.gradesPercent > 0 ? "#0369A1" : "#CBD5E1"}
                  >
                    <title>
                      {g.groupName} ({g.gradeName}): Notas {g.gradesPercent}%
                    </title>
                  </rect>
                  {/* Barra Logros */}
                  <rect
                    x={centerX + 1.5}
                    y={plotBottom - Math.max(logrosH, 2)}
                    width={barW}
                    height={Math.max(logrosH, 2)}
                    rx="3"
                    fill={g.logrosPercent > 0 ? "#2F7D00" : "#CBD5E1"}
                  >
                    <title>
                      {g.groupName} ({g.gradeName}): Logros {g.logrosPercent}%
                    </title>
                  </rect>
                  {/* Etiqueta del grupo */}
                  <text
                    x={centerX}
                    y={plotBottom + 18}
                    textAnchor="middle"
                    fill="#0F1747"
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily="Inter Variable, system-ui, sans-serif"
                  >
                    <title>
                      {g.groupName} ({g.gradeName})
                    </title>
                    {shortGroupLabel(g.groupName)}
                  </text>
                  {g.readyForReportCards && (
                    <circle cx={centerX} cy={plotBottom + 28} r="3" fill="#2F7D00">
                      <title>Grupo listo para habilitar boletines</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* 3. Seguimiento individual por docente (con desglose de materias y acceso en 1 clic) */}
      <section aria-labelledby="seguimiento-docentes" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="seguimiento-docentes" className="text-base font-bold text-navy">
              Seguimiento por docente ({filteredTeachers.length})
            </h2>
            <p className="text-xs text-muted">
              Ordenados de menor a mayor avance para priorizar el acompañamiento pedagógico.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar docente o materia…"
                aria-label="Filtrar docente o materia"
                className="input min-h-9 w-56 pl-8 text-xs font-medium"
              />
            </div>

            <div className="inline-flex rounded-control border border-line bg-bg-2 p-0.5 text-xs">
              {(
                [
                  { key: "all", label: `Todos (${data.teachers.length})` },
                  { key: "pending", label: `Pendientes (${data.summary.teachersPending})` },
                  { key: "complete", label: `Al día (${data.summary.teachersComplete})` },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilter(opt.key)}
                  className={cx(
                    "rounded-md px-2.5 py-1 font-semibold transition-colors",
                    filter === opt.key ? "bg-white text-navy shadow-2xs" : "text-muted hover:text-navy",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul className="card divide-y divide-line p-0">
          {filteredTeachers.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-muted">
              No hay docentes que coincidan con este filtro.
            </li>
          ) : (
            filteredTeachers.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <li key={t.teacherId}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-bg-2/50">
                      <div className="min-w-48 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-navy">{t.teacherName}</span>
                          <Chip tone={meta.tone}>
                            {meta.icon === "check" && <CheckCircle2 aria-hidden />}
                            {meta.icon === "clock" && <Clock aria-hidden />}
                            {meta.icon === "alert" && <AlertCircle aria-hidden />}
                            <span>{meta.label}</span>
                          </Chip>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {t.courseCount} {t.courseCount === 1 ? "asignatura" : "asignaturas"} ·{" "}
                          {t.completeCourses} al día
                        </p>
                      </div>

                      {/* Dos barras compactas: Notas y Logros */}
                      <div className="grid w-full gap-2 sm:w-72 sm:grid-cols-2">
                        <div>
                          <div className="flex justify-between text-[0.7rem] font-bold text-muted tabular">
                            <span>Notas</span>
                            <span className="text-navy">{t.gradesPercent}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-sky-solid"
                              style={{ width: `${t.gradesPercent}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[0.7rem] font-bold text-muted tabular">
                            <span>Logros</span>
                            <span className="text-navy">{t.logrosPercent}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-green-solid"
                              style={{ width: `${t.logrosPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <ChevronDown
                        className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>

                    <div className="border-t border-line bg-bg-2/40 px-5 py-3">
                      <ul className="divide-y divide-line/70">
                        {t.courses.map((c) => (
                          <li
                            key={c.courseAssignmentId}
                            className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-navy">{c.subjectName}</span>
                              <span className="ml-1.5 text-muted">
                                · {c.groupName} ({c.gradeName}) · {c.columnCount} col. · Logros {c.logrosFilled}/
                                {c.logrosExpected}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 tabular">
                              <span className="font-semibold text-sky-solid">Notas {c.gradesPercent}%</span>
                              <span className="font-semibold text-green-solid">Logros {c.logrosPercent}%</span>
                              <Link
                                href={`/siga/calificaciones?curso=${c.courseAssignmentId}&periodo=${periodId}&vista=planilla`}
                                className="inline-flex items-center gap-1 font-bold text-navy hover:text-sky-solid"
                              >
                                <Table2 className="size-3.5" aria-hidden /> Planilla
                              </Link>
                              <Link
                                href={`/siga/calificaciones?curso=${c.courseAssignmentId}&periodo=${periodId}&vista=logros`}
                                className="inline-flex items-center gap-1 font-bold text-navy hover:text-sky-solid"
                              >
                                <Award className="size-3.5" aria-hidden /> Logros
                                <ExternalLink className="size-3" aria-hidden />
                              </Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
