import { AlertTriangle, Award, CheckCircle2, ExternalLink, Lock, Quote } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { LunitaEmblem } from "@/components/ui/LunitaEmblem";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import { formatDateRange } from "@/modules/core/academic-structure/dates";
import { PILLAR_META, STHEAMI_PILLARS, type StheamiPillar } from "@/modules/core/academic-structure/stheami";
import type { ReportCardDocument } from "@/modules/siga/report-cards/queries";
import {
  DIMENSION_LABELS,
  formatScore,
  isQualitativeLevel,
  QUALITATIVE_LABELS,
} from "@/modules/siga/siee-grades/calculator";
import { parseLogroLines } from "@/modules/siga/siee-grades/logros";
import {
  describeScale,
  MAX_SCORE,
  PERFORMANCE_META,
  roundScore,
  type PerformanceLevel,
} from "@/modules/siga/siee-grades/scale";
import { PrintReportButton } from "./ReportCardControls";

const issuedFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const LEVEL_STROKE: Record<PerformanceLevel, string> = {
  SUPERIOR: "#58CC02",
  ALTO: "#1CB0F6",
  BASICO: "#FFC800",
  BAJO: "#FF4B4B",
};

const LEVEL_BAR_BG: Record<PerformanceLevel, string> = {
  SUPERIOR: "bg-green-solid",
  ALTO: "bg-sky-solid",
  BASICO: "bg-orange-solid",
  BAJO: "bg-red-solid",
};

/** Indicador radial SVG del promedio general SIEE (escala 1.0–5.0). */
function AverageRadialGauge({
  average,
  level,
  maxScore,
}: {
  average: number;
  level: PerformanceLevel;
  maxScore: number;
}) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, average / maxScore));
  const dashOffset = circumference * (1 - ratio);
  const strokeColor = LEVEL_STROKE[level];
  const shortLabel = PERFORMANCE_META[level].label.replace("Desempeño ", "");

  return (
    <div className="flex items-center gap-3.5 rounded-card border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-xs">
      <div className="relative grid size-18 shrink-0 place-items-center">
        <svg viewBox="0 0 80 80" width={72} height={72} className="-rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6.5" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center leading-none">
          <div>
            <span className="block text-lg font-black text-white tabular-nums">{formatScore(average)}</span>
            <span className="mt-0.5 block text-[0.6rem] font-bold tracking-wider text-white/75 uppercase">
              / {maxScore.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 text-left">
        <p className="text-[0.65rem] font-extrabold tracking-widest text-yellow uppercase">Promedio general</p>
        <p className="mt-0.5 text-base font-black text-white">Desempeño {shortLabel}</p>
        <p className="mt-0.5 text-[0.72rem] font-medium text-white/80">Escala SIEE · Decreto 1290</p>
      </div>
    </div>
  );
}

/** Sello circular institucional SVG de Rectoría. */
function OfficialRectoriaSeal({
  uid,
  year,
  isIssued,
}: {
  uid: string;
  year: number;
  isIssued: boolean;
}) {
  const ringColor = isIssued ? "#303296" : "#B45309";
  const accentColor = isIssued ? "#F0A500" : "#D97706";
  const topArcId = `${uid}-seal-top`;
  const bottomArcId = `${uid}-seal-bottom`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={94}
      height={94}
      className="shrink-0 select-none"
      role="img"
      aria-label={
        isIssued
          ? `Sello oficial de Rectoría Liceo Lunita de Chía ${year}`
          : "Sello de vista previa no habilitada para familias"
      }
    >
      <defs>
        <path id={topArcId} d="M 18,60 A 42,42 0 1,1 102,60" />
        <path id={bottomArcId} d="M 102,60 A 42,42 0 1,1 18,60" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="#FFFFFF" fillOpacity="0.94" stroke={ringColor} strokeWidth="2.4" />
      <circle
        cx="60"
        cy="60"
        r="51"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.2"
        strokeDasharray="2.5 2.5"
      />
      <circle cx="60" cy="60" r="32" fill={ringColor} fillOpacity="0.06" stroke={ringColor} strokeWidth="1.4" />

      <text
        fill={ringColor}
        fontSize="7.5"
        fontWeight="800"
        letterSpacing="1.35"
        fontFamily="Inter Variable, system-ui, sans-serif"
      >
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
          LICEO LUNITA DE CHÍA
        </textPath>
      </text>
      <text
        fill={ringColor}
        fontSize="7"
        fontWeight="800"
        letterSpacing="1.2"
        fontFamily="Inter Variable, system-ui, sans-serif"
      >
        <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
          {isIssued ? `• RECTORÍA SIEE ${year} •` : "• BORRADOR INTERNO •"}
        </textPath>
      </text>

      <path
        d="M58 40 A14 14 0 1 0 70 61 A11 11 0 1 1 58 40 Z"
        fill={accentColor}
        stroke={ringColor}
        strokeWidth="1.2"
      />
      <polygon
        points="67,41 68.5,45.2 73,45.2 69.4,47.8 70.8,52 67,49.4 63.2,52 64.6,47.8 61,45.2 65.5,45.2"
        fill={accentColor}
        stroke={ringColor}
        strokeWidth="0.9"
      />

      <rect x="28" y="65" width="64" height="14" rx="4" fill={ringColor} />
      <text
        x="60"
        y="74.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="7.4"
        fontWeight="800"
        letterSpacing="0.9"
        fontFamily="Inter Variable, system-ui, sans-serif"
      >
        {isIssued ? "HABILITADO" : "VISTA PREVIA"}
      </text>
    </svg>
  );
}

/** Trazo caligráfico decorativo minimalista para línea de firma digital. */
function SignatureFlourish({ variant }: { variant: "rectoria" | "director" }) {
  return (
    <svg viewBox="0 0 180 34" width={140} height={26} className="mb-1 text-cobalt/70" aria-hidden="true">
      {variant === "rectoria" ? (
        <path
          d="M12 24 C28 6, 40 28, 56 14 C68 4, 72 26, 88 18 C100 12, 114 23, 134 15 C146 10, 158 18, 168 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M14 22 C30 10, 44 26, 62 12 C76 2, 86 24, 104 16 C118 10, 132 22, 150 14 C158 11, 164 15, 170 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * Documento oficial imprimible del Boletín de Valoración (SIEE · Decreto 1290).
 * Rediseñado con lectura editorial aireada: encabezado ceremonial SVG,
 * marca de agua institucional del escudo del colegio, valoración + logros
 * redactados por cada docente por materia, sello circular de Rectoría y QR.
 */
export function OfficialReportCard({ doc }: { doc: ReportCardDocument }) {
  const isIssued = Boolean(doc.record?.issuedAt);
  const isQualitative = doc.group.assessmentMode === "QUALITATIVE";
  const qrDataUri = doc.qrSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc.qrSvg)}`
    : null;
  const uid = `rc-${doc.enrollmentId.slice(0, 8)}-p${doc.period.number}`;

  const pillarSummaries = !isQualitative
    ? STHEAMI_PILLARS.map((pillar) => {
        const scores = doc.subjects
          .filter((s) => s.pillar === pillar)
          .map((s) => s.result.final)
          .filter((n): n is number => n !== null);
        if (scores.length === 0) return null;
        const avg = roundScore(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { pillar, avg };
      }).filter((item): item is { pillar: StheamiPillar; avg: number } => item !== null)
    : [];

  const totalAtt =
    doc.attendance.present + doc.attendance.late + doc.attendance.excused + doc.attendance.absent;

  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isIssued ? (
            <Chip tone={doc.record?.isStale ? "orange" : "green"}>
              {doc.record?.isStale ? <AlertTriangle aria-hidden /> : <CheckCircle2 aria-hidden />}
              <span>
                {doc.record?.isStale
                  ? "Habilitado · pendiente actualizar tras cambio de nota o logro"
                  : "Boletín oficial habilitado por Rectoría"}
              </span>
            </Chip>
          ) : (
            <Chip tone="orange">
              <Lock aria-hidden />
              <span>Vista previa interna (oculto para familias hasta habilitación de Rectoría)</span>
            </Chip>
          )}
        </div>
        <PrintReportButton />
      </div>

      <article
        aria-label={`Boletín oficial de ${doc.student.fullName} — ${doc.period.name}`}
        className="report-sheet relative overflow-hidden rounded-card border border-line-2 bg-white shadow-sm"
      >
        <div className="relative z-10">
          {/* Cenefa Muisca superior */}
          <div className="muisca muisca-thin" aria-hidden />

          {/* Encabezado ceremonial SVG institucional */}
          <header
            className="report-sheet-header relative overflow-hidden border-b-2 border-yellow/70 px-6 py-6 text-white sm:px-8"
            style={{
              background: "linear-gradient(122deg, #0b1138 0%, #1c246e 56%, #303296 100%)",
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 960 220"
              preserveAspectRatio="xMidYMid slice"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
            >
              <circle cx="840" cy="40" r="180" fill="none" stroke="#FFC800" strokeWidth="1.2" strokeDasharray="5 7" />
              <circle cx="840" cy="40" r="120" fill="none" stroke="#1CB0F6" strokeWidth="1" />
              <circle cx="110" cy="210" r="140" fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeDasharray="3 6" />
              <circle cx="640" cy="36" r="3" fill="#FFC800" />
              <circle cx="710" cy="168" r="2.5" fill="#1CB0F6" />
              <path
                d="M590 24 L592 30 L598 32 L592 34 L590 40 L588 34 L582 32 L588 30 Z"
                fill="#FFC800"
              />
            </svg>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="grid size-17 shrink-0 place-items-center rounded-full bg-white p-1.5 shadow-sm ring-2 ring-yellow/90">
                  <LunitaEmblem size={48} />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-extrabold tracking-[0.15em] text-yellow uppercase">
                    República de Colombia · Chía, Cundinamarca · Modelo STHEAMI
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                    Liceo Lunita de Chía
                  </h2>
                  <p className="mt-0.5 text-sm font-bold text-white/95">
                    Boletín Oficial de Valoración Académica — {doc.period.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-white/80">
                    {doc.year.name} · {formatDateRange(doc.period.startDate, doc.period.endDate)} · Decreto 1290 (SIEE)
                  </p>
                </div>
              </div>

              {!isQualitative && doc.overallAverage !== null && doc.overallLevel ? (
                <AverageRadialGauge
                  average={doc.overallAverage}
                  level={doc.overallLevel}
                  maxScore={MAX_SCORE}
                />
              ) : (
                <div className="flex items-center gap-2.5 rounded-card border border-white/25 bg-white/10 px-4 py-3">
                  <Award className="size-7 text-yellow" aria-hidden />
                  <div>
                    <p className="text-[0.66rem] font-extrabold tracking-widest text-yellow uppercase">
                      Primera Infancia
                    </p>
                    <p className="text-sm font-extrabold text-white">Valoración Cualitativa</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Ficha de identificación del estudiante */}
          <dl className="grid gap-4 border-b border-line bg-cloud/65 px-6 py-4 text-sm sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <div>
              <dt className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">Estudiante</dt>
              <dd className="mt-0.5 font-extrabold text-navy">{doc.student.fullName}</dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">Identificación</dt>
              <dd className="mt-0.5 font-semibold text-navy tabular">
                {doc.student.documentType} {doc.student.documentNumber}
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">Grado y grupo</dt>
              <dd className="mt-0.5 font-semibold text-navy">
                {doc.group.gradeName} · {doc.group.groupName} ({doc.group.levelName})
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-extrabold tracking-wider text-muted uppercase">
                Director(a) de grupo
              </dt>
              <dd className="mt-0.5 font-semibold text-navy">{doc.group.directorName ?? "Por asignar"}</dd>
            </div>
          </dl>

          {/* Síntesis serena por pilares STHEAMI (píldoras compactas sin saturación) */}
          {pillarSummaries.length > 0 && (
            <section
              aria-label="Resumen por pilares STHEAMI"
              className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-6 py-3.5 sm:px-8"
            >
              <span className="mr-1 text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
                Pilares STHEAMI:
              </span>
              {pillarSummaries.map(({ pillar, avg }) => (
                <span
                  key={pillar}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-bg-2/70 py-1 pr-2.5 pl-1.5 text-xs font-semibold text-navy"
                >
                  <StheamiBadge pillar={pillar} size="sm" />
                  <span>{PILLAR_META[pillar].name}</span>
                  <strong className="font-extrabold tabular-nums">{formatScore(avg)}</strong>
                </span>
              ))}
            </section>
          )}

          {/* Cuerpo académico: asignaturas + logros por materia sobre marca de agua del escudo */}
          <section
            aria-label="Valoración y logros por asignatura"
            className="relative overflow-hidden px-6 py-6 sm:px-8"
          >
            {/* Marca de agua institucional centrada detrás de asignaturas y logros */}
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center"
            >
              <div className="relative flex items-center justify-center">
                <svg viewBox="0 0 540 540" width={480} height={480} className="absolute opacity-[0.075]">
                  <circle
                    cx="270"
                    cy="270"
                    r="248"
                    fill="none"
                    stroke="#303296"
                    strokeWidth="2.4"
                    strokeDasharray="8 6"
                  />
                  <circle cx="270" cy="270" r="228" fill="none" stroke="#F0A500" strokeWidth="1.8" />
                  <circle cx="270" cy="270" r="210" fill="none" stroke="#303296" strokeWidth="1" />
                </svg>
                <LunitaEmblem size={340} className="opacity-[0.10]" />
              </div>
            </div>

            <div className="relative z-10">
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-line pb-2">
                <h3 className="text-xs font-extrabold tracking-wider text-navy uppercase">
                  Valoración académica y logros por asignatura
                </h3>
                <span className="text-xs text-muted">{doc.subjects.length} asignaturas</span>
              </div>

              <ol className="divide-y divide-line/85">
                {doc.subjects.map((subject) => {
                  const dimByCode = new Map(subject.dimensions.map((d) => [d.dimension, d]));
                  const latestQual = subject.dimensions
                    .flatMap((d) => d.columns.map((c) => c.qualitative).filter(isQualitativeLevel))
                    .at(-1);
                  const logrosByDim = subject.dimensions
                    .map((d) => ({
                      competencyId: d.competencyId,
                      dimension: d.dimension,
                      lines: parseLogroLines(d.description),
                    }))
                    .filter((item) => item.lines.length > 0);

                  return (
                    <li key={subject.courseAssignmentId} className="break-inside-avoid py-4 first:pt-2 last:pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <StheamiBadge pillar={subject.pillar} size="sm" />
                          <div className="min-w-0">
                            <p className="font-extrabold text-navy">{subject.subjectName}</p>
                            <p className="text-xs text-muted">
                              {PILLAR_META[subject.pillar].name}
                              {subject.teacherName ? ` · Prof. ${subject.teacherName}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {!isQualitative && (
                            <div className="hidden items-center gap-2.5 text-xs text-muted tabular md:flex">
                              {(["SABER", "HACER", "SER"] as const).map((code) => {
                                const d = dimByCode.get(code);
                                return (
                                  <span key={code}>
                                    {DIMENSION_LABELS[code]}{" "}
                                    <strong className="font-bold text-navy">
                                      {d ? formatScore(subject.result.byDimension[d.competencyId]) : "—"}
                                    </strong>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {isQualitative ? (
                            <span className="rounded-chip bg-cloud px-2.5 py-1 text-xs font-bold text-navy">
                              {latestQual ? QUALITATIVE_LABELS[latestQual] : "Sin valoración"}
                            </span>
                          ) : subject.result.final !== null ? (
                            <PerformanceBadge score={subject.result.final} scale={doc.scale} />
                          ) : (
                            <span className="text-xs font-semibold text-muted">Sin notas</span>
                          )}
                        </div>
                      </div>

                      {logrosByDim.length > 0 && (
                        <ul className="mt-2.5 grid gap-1.5 border-l-2 border-cobalt/20 pl-3.5 text-xs leading-relaxed text-ink-2 sm:ml-9">
                          {logrosByDim.map((item) =>
                            item.lines.map((line, lineIdx) => (
                              <li key={`${item.competencyId}-${lineIdx}`}>
                                {item.dimension !== "QUALITATIVE" && lineIdx === 0 && (
                                  <strong className="mr-1.5 font-bold text-navy">
                                    {DIMENSION_LABELS[item.dimension]}:
                                  </strong>
                                )}
                                <span>{line}</span>
                              </li>
                            )),
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* Asistencia del periodo + Escala SIEE */}
          <div className="grid gap-5 border-t border-line bg-bg-2/65 px-6 py-4 sm:px-8 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold tracking-wider text-navy uppercase">
                  Asistencia en {doc.period.name}
                </h3>
                <span className="rounded-chip bg-green-l px-2 py-0.5 text-xs font-extrabold text-green-solid tabular">
                  {doc.attendance.ratePercent}% cubierta
                </span>
              </div>
              <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-line">
                {totalAtt === 0 ? (
                  <div className="h-full w-full bg-green-solid/80" />
                ) : (
                  <>
                    {doc.attendance.present > 0 && (
                      <div
                        className="bg-green-solid"
                        style={{ width: `${(doc.attendance.present / totalAtt) * 100}%` }}
                      />
                    )}
                    {doc.attendance.late > 0 && (
                      <div
                        className="bg-orange-solid"
                        style={{ width: `${(doc.attendance.late / totalAtt) * 100}%` }}
                      />
                    )}
                    {doc.attendance.excused > 0 && (
                      <div
                        className="bg-sky-solid"
                        style={{ width: `${(doc.attendance.excused / totalAtt) * 100}%` }}
                      />
                    )}
                    {doc.attendance.absent > 0 && (
                      <div
                        className="bg-red-solid"
                        style={{ width: `${(doc.attendance.absent / totalAtt) * 100}%` }}
                      />
                    )}
                  </>
                )}
              </div>
              <p className="text-xs font-medium text-ink-2 tabular">
                Asistencias: <strong className="text-navy">{doc.attendance.present}</strong> ·{" "}
                Fallas: <strong className="text-navy">{doc.attendance.absent}</strong> ·{" "}
                Retardos: <strong className="text-navy">{doc.attendance.late}</strong> ·{" "}
                Excusas: <strong className="text-navy">{doc.attendance.excused}</strong>
              </p>
            </div>

            {!isQualitative && (
              <div className="grid gap-2">
                <h3 className="text-xs font-extrabold tracking-wider text-navy uppercase">
                  Escala SIEE ({DIMENSION_LABELS.SABER} / {DIMENSION_LABELS.HACER} / {DIMENSION_LABELS.SER})
                </h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-muted tabular">
                  {describeScale(doc.scale).map((r) => (
                    <li key={r.level} className="inline-flex items-center gap-1.5">
                      <span
                        className={`inline-block size-2 rounded-full ${LEVEL_BAR_BG[r.level]}`}
                        aria-hidden="true"
                      />
                      <span className="font-bold text-navy">
                        {PERFORMANCE_META[r.level].label.replace("Desempeño ", "")}:
                      </span>{" "}
                      {r.from}–{r.to}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Observación pedagógica de Dirección de Grupo */}
          <div className="border-t border-line bg-white px-6 py-5 sm:px-8">
            <div className="rounded-control border border-cobalt/15 border-l-4 border-l-cobalt bg-cloud/60 px-4 py-3.5">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-navy uppercase">
                <Quote className="size-3.5 text-cobalt" aria-hidden />
                Observaciones de Dirección de Grupo
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                {doc.record?.directorObservations ??
                  "Felicitaciones por el compromiso demostrado durante el periodo. Continúa fortaleciendo tus hábitos de estudio y participación en los proyectos STHEAMI."}
              </p>
            </div>
          </div>

          {/* Pie ceremonial: Firmas + Sello SVG de Rectoría + Verificación QR */}
          <footer className="grid gap-6 border-t border-line bg-white px-6 py-6 sm:px-8 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <div>
                <div className="flex h-8 items-end">
                  <SignatureFlourish variant="rectoria" />
                </div>
                <div className="border-t border-navy/40 pt-2">
                  <p className="text-sm font-extrabold text-navy">Rectoría · Liceo Lunita de Chía</p>
                  <p className="text-xs text-muted">Aval institucional y registro digital SIEE</p>
                </div>
              </div>
              <div>
                <div className="flex h-8 items-end">
                  <SignatureFlourish variant="director" />
                </div>
                <div className="border-t border-navy/40 pt-2">
                  <p className="text-sm font-extrabold text-navy">
                    {doc.group.directorName ?? "Dirección de Grupo"}
                  </p>
                  <p className="text-xs text-muted">Director(a) de {doc.group.groupName}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <OfficialRectoriaSeal uid={uid} year={doc.year.year} isIssued={isIssued} />
            </div>

            {qrDataUri && doc.record?.verificationCode && doc.record.issuedAt && (
              <div className="flex items-center gap-3 rounded-control border border-cobalt/20 bg-cloud/65 p-3">
                <div className="rounded-md bg-white p-1 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUri}
                    alt={`Código QR de verificación ${doc.record.verificationCode}`}
                    width={82}
                    height={82}
                    className="shrink-0"
                  />
                </div>
                <div className="min-w-0 text-xs">
                  <p className="font-extrabold tracking-wider text-navy uppercase">Verificación oficial</p>
                  <p className="mt-0.5 font-mono text-[0.76rem] font-bold text-cobalt">
                    {doc.record.verificationCode}
                  </p>
                  <p className="mt-0.5 text-muted">
                    Habilitado: {issuedFormat.format(doc.record.issuedAt)}
                  </p>
                  <Link
                    href={`/verificar/${doc.record.verificationCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-print mt-1 inline-flex items-center gap-1 font-bold text-sky-solid"
                  >
                    Probar enlace QR <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </footer>

          {/* Cenefa Muisca inferior */}
          <div className="muisca muisca-thin" aria-hidden />
        </div>
      </article>
    </div>
  );
}
