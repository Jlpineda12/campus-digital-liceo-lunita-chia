import type { ReactNode } from "react";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";

/**
 * Íconos SVG de los 7 pilares STHEAMI, tomados del sitio web institucional
 * (página «Así aprendemos: STHEAMI»). Usan `--c` / `--cd` del tono del pilar
 * (`.t-sky`, `.t-purple`…), así heredan la paleta del Campus.
 */
const ICONS: Record<StheamiPillar, ReactNode> = {
  S: (
    <>
      <path
        d="M18 4h12v12l11 20a5 5 0 0 1-4.4 8H11.4A5 5 0 0 1 7 36l11-20z"
        fill="#fff"
        stroke="var(--c)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M12.5 30h23l3.4 6.5a2.5 2.5 0 0 1-2.2 3.5H11.3a2.5 2.5 0 0 1-2.2-3.5z" fill="var(--c)" />
      <circle className="stheami-ic__bubble" cx="20" cy="34" r="2" fill="#fff" />
      <circle className="stheami-ic__bubble stheami-ic__bubble--2" cx="27" cy="23" r="2.4" fill="var(--cd)" />
      <path d="M16 4h16" stroke="var(--cd)" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  T: (
    <>
      <rect x="8" y="9" width="32" height="23" rx="4" fill="var(--c)" />
      <rect x="12" y="13" width="24" height="15" rx="2" fill="#fff" />
      <path className="stheami-ic__play" d="m22 17 6 3.5-6 3.5z" fill="var(--c)" />
      <path d="M3 35h42l-3 5H6z" fill="var(--cd)" />
    </>
  ),
  H: (
    <>
      <path d="M4 12c7-3 13-2 20 2v27c-7-4-13-5-20-2z" fill="var(--c)" />
      <path d="M44 12c-7-3-13-2-20 2v27c7-4 13-5 20-2z" fill="var(--cd)" />
      <path
        d="M9 19c3-1 7-1 10 1M9 25c3-1 7-1 10 1M29 20c3-2 7-2 10-1M29 26c3-2 7-2 10-1"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  E: (
    <g className="stheami-ic__gear">
      <path
        d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"
        fill="var(--c)"
      />
      <circle cx="24" cy="24" r="7.5" fill="#fff" />
      <circle cx="24" cy="24" r="3.5" fill="var(--cd)" />
    </g>
  ),
  A: (
    <>
      <path d="M24 4C12 4 4 12 4 23s8 21 19 21c3 0 4-2 3-4s0-5 3-5h5c6 0 10-4 10-10C44 13 35 4 24 4z" fill="var(--c)" />
      <circle cx="14" cy="20" r="3.5" fill="#ff4b4b" />
      <circle cx="21" cy="12" r="3.5" fill="#ffc800" />
      <circle cx="31" cy="12" r="3.5" fill="#58cc02" />
      <circle cx="37" cy="21" r="3.5" fill="#fff" />
      <circle cx="15" cy="32" r="4.5" fill="var(--cd)" />
    </>
  ),
  M: (
    <>
      <rect x="8" y="4" width="32" height="40" rx="6" fill="var(--c)" />
      <rect x="12" y="8" width="24" height="10" rx="3" fill="#fff" />
      <text
        x="33"
        y="16.5"
        textAnchor="end"
        fontFamily="system-ui,sans-serif"
        fontWeight="900"
        fontSize="8"
        fill="var(--cd)"
      >
        π²
      </text>
      <g fill="#fff">
        <rect x="12" y="22" width="6.5" height="6" rx="2" />
        <rect x="20.8" y="22" width="6.5" height="6" rx="2" />
        <rect x="12" y="31" width="6.5" height="6" rx="2" />
        <rect x="20.8" y="31" width="6.5" height="6" rx="2" />
      </g>
      <rect x="29.5" y="22" width="6.5" height="15" rx="2" fill="var(--cd)" />
    </>
  ),
  I: (
    <>
      <path
        d="M4 30c4-1 8 0 12 3l6 1c2 0 3 2 1 3l-8 1 9 1 10-5c2-1 4 1 3 3l-10 7c-3 2-6 2-9 1L4 41z"
        fill="var(--c)"
      />
      <path
        className="stheami-ic__heart"
        d="M28 24S16 17 16 10a5 5 0 0 1 12-2 5 5 0 0 1 12 2c0 7-12 14-12 14z"
        fill="var(--cd)"
      />
      <ellipse cx="21" cy="10" rx="2" ry="1.4" fill="#fff" opacity=".8" />
    </>
  ),
};

export function StheamiIcon({ pillar, size = 44, className }: { pillar: StheamiPillar; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden overflow="visible">
      {ICONS[pillar]}
    </svg>
  );
}
