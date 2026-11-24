import type { CSSProperties } from "react";
import { PILLAR_META, type StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { cx, toneClass } from "./cx";

const SIZES = { sm: 24, md: 32, lg: 44 } as const;

interface StheamiBadgeProps {
  pillar: StheamiPillar;
  size?: keyof typeof SIZES;
  /** Muestra el nombre del pilar junto a la insignia. */
  showName?: boolean;
  className?: string;
}

/** Insignia del pilar STHEAMI de una asignatura (REGLAS.md §2.2). */
export function StheamiBadge({ pillar, size = "md", showName = false, className }: StheamiBadgeProps) {
  const meta = PILLAR_META[pillar];
  const tile = (
    <span
      className={cx("pillar-tile", toneClass(meta.tone))}
      style={{ "--size": `${SIZES[size]}px` } as CSSProperties}
      role={showName ? undefined : "img"}
      aria-label={showName ? undefined : `Pilar STHEAMI: ${meta.name}`}
      aria-hidden={showName ? true : undefined}
      title={showName ? undefined : `${meta.name} (${meta.english})`}
    >
      {meta.letter}
    </span>
  );

  if (!showName) return <span className={className}>{tile}</span>;

  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      {tile}
      <span className="text-sm font-extrabold text-navy">{meta.name}</span>
    </span>
  );
}
