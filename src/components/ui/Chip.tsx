import type { ReactNode } from "react";
import type { Tone } from "@/modules/core/auth/roles";
import { cx, toneClass } from "./cx";

interface ChipProps {
  tone?: Tone;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Etiqueta en mayúsculas sobre el tono claro (`.chip`). */
export function Chip({ tone = "sky", className, title, children }: ChipProps) {
  return (
    <span className={cx("chip", toneClass(tone), className)} title={title}>
      {children}
    </span>
  );
}
