import type { CSSProperties } from "react";
import "./night-sky.css";

/** Generador determinista (mismas estrellas en servidor y cliente: sin desajustes de hidratación). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rand = seeded(20261127);
const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: +(rand() * 100).toFixed(2),
  y: +(rand() * 72).toFixed(2),
  r: +(0.6 + rand() * (i % 9 === 0 ? 1.8 : 1.1)).toFixed(2),
  delay: +(rand() * 6).toFixed(2),
  dur: +(2.5 + rand() * 4).toFixed(2),
  gold: i % 11 === 0,
}));

/**
 * Fondo "Noche en Chía" del Campus: crepúsculo con aurora, estrellas que
 * titilan, estrellas fugaces y cerros en silueta. Decorativo, solo CSS.
 */
export function NightSkyBackdrop() {
  return (
    <div className="night" aria-hidden="true">
      <div className="night__aurora night__aurora--a" />
      <div className="night__aurora night__aurora--b" />
      <svg className="night__stars" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r / 10}
            className={s.gold ? "night__star night__star--gold" : "night__star"}
            style={{ "--d": `${s.delay}s`, "--t": `${s.dur}s` } as CSSProperties}
          />
        ))}
      </svg>
      <span className="night__shooting" style={{ "--d": "3s", "--y": "14%", "--x": "62%" } as CSSProperties} />
      <span className="night__shooting" style={{ "--d": "9s", "--y": "26%", "--x": "88%" } as CSSProperties} />

      <svg className="night__hills" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          className="night__hill night__hill--far"
          d="M0 170 C120 120 220 150 330 110 C450 66 540 120 660 92 C800 58 900 128 1040 96 C1180 64 1300 118 1440 86 L1440 320 L0 320 Z"
        />
        <path
          className="night__hill night__hill--mid"
          d="M0 220 C140 176 240 206 380 168 C520 130 600 196 760 166 C920 136 1010 198 1160 170 C1290 146 1370 182 1440 168 L1440 320 L0 320 Z"
        />
        <path
          className="night__hill night__hill--near"
          d="M0 270 C160 238 300 262 460 236 C640 206 760 258 940 240 C1110 222 1260 256 1440 232 L1440 320 L0 320 Z"
        />
      </svg>
    </div>
  );
}
