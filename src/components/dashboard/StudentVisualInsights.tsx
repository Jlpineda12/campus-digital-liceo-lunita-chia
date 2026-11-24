import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { GroupCourse } from "@/modules/core/academic-structure/queries";
import type { PeriodTrendPoint } from "@/modules/core/dashboard/service";

/** Construye una curva suave (Catmull-Rom → Bézier cúbica) para el gráfico SVG. */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Panel visual insignia estudiantil (fusión Liceo Lunita × VENTES):
 * - Izquierda: gráfico SVG de curvas suaves con evolución de promedio por periodo.
 * - Derecha: tarjeta en degradado cobalto con % de meta en Órbita Virtual,
 *   avatares reales apilados de sus docentes y curva dorada luminosa.
 */
export function StudentVisualInsights({
  firstName,
  isPrimaria,
  periodTrend,
  orbitProgress,
  courses,
}: {
  firstName: string;
  isPrimaria: boolean;
  periodTrend: PeriodTrendPoint[];
  orbitProgress: { completed: number; total: number; percent: number };
  courses: GroupCourse[];
}) {
  // Coordenadas del gráfico SVG (escala SIEE 1.0 – 5.0)
  const w = 460;
  const h = 175;
  const padL = 36;
  const padR = 24;
  const padT = 26;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const yForScore = (score: number) => {
    const clamped = Math.max(1, Math.min(5, score));
    return padT + plotH - ((clamped - 1) / 4) * plotH;
  };

  const count = Math.max(periodTrend.length, 4);
  const xForIdx = (idx: number) => padL + (idx / Math.max(count - 1, 1)) * plotW;

  const scoredPoints = periodTrend
    .map((p, idx) => (p.average !== null ? { x: xForIdx(idx), y: yForScore(p.average), ...p } : null))
    .filter((p): p is { x: number; y: number; periodNumber: number; label: string; average: number } => p !== null);

  const curvePath = buildSmoothPath(scoredPoints);
  const areaPath =
    scoredPoints.length >= 2
      ? `${curvePath} L ${scoredPoints.at(-1)!.x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${scoredPoints[0]!.x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : "";
  const latestPoint = scoredPoints.at(-1) ?? null;

  // Avatares únicos de docentes del grupo (muestra fotos reales si las subieron)
  const uniqueTeachers = Array.from(
    new Map(
      courses
        .filter((c) => c.teacherName)
        .map((c) => [
          c.teacherName!,
          {
            name: c.teacherName!,
            initials: c.teacherInitials ?? c.teacherName!.slice(0, 2).toUpperCase(),
            avatarUrl: c.teacherAvatarUrl,
          },
        ]),
    ).values(),
  );
  const shownTeachers = uniqueTeachers.slice(0, 4);
  const extraTeachers = Math.max(0, uniqueTeachers.length - shownTeachers.length);

  return (
    <section aria-label="Evolución y meta del periodo" className="grid gap-5 lg:grid-cols-12">
      {/* Izquierda: Curva suave de rendimiento académico */}
      <div className="card flex flex-col justify-between gap-3 bg-white lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-navy">
              {isPrimaria ? `Así vas este año, ${firstName}` : "Evolución académica por periodo"}
            </h2>
            <p className="text-xs text-muted">Promedio acumulado en escala SIEE (1.0 a 5.0)</p>
          </div>
          <div className="flex items-center gap-3 text-[0.72rem] font-bold">
            <span className="inline-flex items-center gap-1.5 text-cobalt">
              <span className="size-2 rounded-full bg-cobalt" aria-hidden /> Tu promedio
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full bg-yellow-d" aria-hidden /> Meta 4.0
            </span>
          </div>
        </div>

        {scoredPoints.length === 0 ? (
          <div className="grid h-40 place-items-center rounded-control bg-bg-2/70 px-4 text-center text-xs text-muted">
            Cuando tus docentes registren las primeras notas del año verás aquí tu curva de progreso.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="h-44 w-full min-w-[300px]"
              role="img"
              aria-label="Gráfico de evolución del promedio por periodo"
            >
              <defs>
                <linearGradient id="lunita-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#303296" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#303296" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Guías horizontales 2.0, 3.5, 5.0 */}
              {[2, 3.5, 5].map((val) => {
                const y = yForScore(val);
                return (
                  <g key={val}>
                    <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#EEF1F8" strokeWidth="1" />
                    <text
                      x={padL - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#647084"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Línea de meta 4.0 (Alto) */}
              <line
                x1={padL}
                x2={w - padR}
                y1={yForScore(4.0)}
                y2={yForScore(4.0)}
                stroke="#E5A400"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.7"
              />

              {/* Área y curva suavizada */}
              {areaPath && <path d={areaPath} fill="url(#lunita-curve-fill)" />}
              {curvePath && (
                <path
                  d={curvePath}
                  fill="none"
                  stroke="#303296"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Puntos + etiqueta flotante en el último periodo */}
              {scoredPoints.map((pt) => {
                const isLatest = latestPoint?.periodNumber === pt.periodNumber;
                return (
                  <g key={pt.periodNumber}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isLatest ? 6 : 4.5}
                      fill={isLatest ? "#FFC800" : "#FFFFFF"}
                      stroke="#303296"
                      strokeWidth="2.5"
                    />
                    {isLatest && (
                      <g transform={`translate(${Math.min(w - 58, Math.max(48, pt.x))}, ${Math.max(20, pt.y - 16)})`}>
                        <rect x="-26" y="-12" width="52" height="20" rx="10" fill="#303296" />
                        <text x="0" y="1.5" textAnchor="middle" fill="#FFFFFF" fontSize="10.5" fontWeight="800">
                          {pt.average.toFixed(1)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Etiquetas P1..P4 */}
              {periodTrend.map((p, idx) => (
                <text
                  key={p.periodNumber}
                  x={xForIdx(idx)}
                  y={h - 8}
                  textAnchor="middle"
                  fill="#525C70"
                  fontSize="11"
                  fontWeight="700"
                >
                  {p.label}
                </text>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Derecha: Tarjeta degradada protagonista (Meta en Órbita + avatares docentes) */}
      <div
        className="relative flex flex-col justify-between overflow-hidden rounded-[22px] p-6 text-white shadow-[0_14px_34px_-12px_rgba(48,50,150,0.45)] lg:col-span-5"
        style={{ background: "linear-gradient(135deg, #2B2D8F 0%, #3E39B0 55%, #5947CC 100%)" }}
      >
        {/* Ondas topográficas decorativas */}
        <svg
          viewBox="0 0 360 220"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
          aria-hidden="true"
        >
          <path d="M-20 170 Q90 120 190 165 T380 140" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M-20 195 Q110 145 210 185 T380 165" fill="none" stroke="#FFC800" strokeWidth="1.3" />
          <circle cx="315" cy="40" r="56" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="4 6" />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-yellow uppercase">
              <Sparkles className="size-3.5" aria-hidden /> Meta en Órbita Virtual
            </p>
            <p className="mt-2 text-4xl leading-none font-black tracking-tight tabular-nums">
              {orbitProgress.percent}%
            </p>
            <p className="mt-1 text-xs font-semibold text-white/80">
              {orbitProgress.total > 0
                ? `${orbitProgress.completed} de ${orbitProgress.total} actividades completadas`
                : "Sin tareas pendientes por ahora"}
            </p>
          </div>

          {/* Avatares apilados de docentes del curso */}
          {shownTeachers.length > 0 && (
            <div className="flex items-center -space-x-2" aria-label="Tus docentes">
              {shownTeachers.map((t) => (
                <Avatar
                  key={t.name}
                  initials={t.initials}
                  src={t.avatarUrl}
                  alt={t.name}
                  size="sm"
                  tone="yellow"
                  className="ring-2 ring-[#3E39B0]"
                />
              ))}
              {extraTeachers > 0 && (
                <span className="grid size-8 place-items-center rounded-full bg-white/20 text-[0.7rem] font-extrabold text-white ring-2 ring-[#3E39B0] backdrop-blur-xs">
                  +{extraTeachers}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mini-sparkline luminosa y CTA */}
        <div className="relative z-10 mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
          <Link
            href="/aula"
            className="inline-flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-2 text-xs font-extrabold text-cobalt no-underline shadow-sm transition-transform hover:-translate-y-0.5"
          >
            Entrar a Órbita <ArrowRight className="size-3.5" aria-hidden />
          </Link>

          <svg viewBox="0 0 120 42" className="h-10 w-28 shrink-0" aria-hidden="true">
            <defs>
              <linearGradient id="lunita-spark" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FF86D0" />
                <stop offset="55%" stopColor="#FFC800" />
                <stop offset="100%" stopColor="#58CC02" />
              </linearGradient>
            </defs>
            <path
              d="M6 34 C 24 34, 30 14, 48 18 C 66 22, 72 28, 88 14 C 98 6, 108 10, 114 6"
              fill="none"
              stroke="url(#lunita-spark)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="114" cy="6" r="3.5" fill="#FFC800" />
          </svg>
        </div>
      </div>
    </section>
  );
}
