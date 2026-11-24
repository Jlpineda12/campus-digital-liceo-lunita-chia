import {
  getPerformanceLevel,
  PERFORMANCE_META,
  roundScore,
  type PerformanceLevel,
  type SieeScale,
} from "@/modules/siga/siee-grades/scale";
import { Chip } from "./Chip";

type PerformanceBadgeProps =
  | { score: number; level?: undefined; scale?: SieeScale; className?: string }
  | { level: PerformanceLevel; score?: undefined; scale?: undefined; className?: string };

/**
 * Desempeño SIEE con su color institucional (SISTEMA_DISENO.md §2.C).
 * Con `score` calcula el nivel según la escala del año lectivo.
 */
export function PerformanceBadge(props: PerformanceBadgeProps) {
  const level = props.score !== undefined ? getPerformanceLevel(props.score, props.scale) : props.level;
  const meta = PERFORMANCE_META[level];
  const label = meta.label.replace("Desempeño ", "");

  return (
    <Chip tone={meta.tone} className={props.className} title={meta.label}>
      {props.score !== undefined && <span>{roundScore(props.score).toFixed(1)} ·</span>}
      <span>{label}</span>
    </Chip>
  );
}
