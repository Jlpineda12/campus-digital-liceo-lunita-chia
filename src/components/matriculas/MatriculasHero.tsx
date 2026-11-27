import { ArrowLeft, CalendarClock, LaptopMinimal, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LunitaCharacter } from "@/components/brand/LunitaCharacter";
import { LunitaMark } from "@/components/brand/LunitaMark";
import { daysUntil, EARLY_BIRD_DEADLINE_2027 } from "@/modules/matriculas/discount-policy";
import "./matriculas-hero.css";

const DEADLINE_LABEL = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(
  new Date(`${EARLY_BIRD_DEADLINE_2027}T12:00:00Z`),
);

/** Íconos SVG de la ruta (mismo lenguaje de los círculos 3D del sitio web). */
const STEP_ICONS: Record<number, ReactNode> = {
  1: (
    <>
      <rect x="11" y="8" width="26" height="32" rx="5" fill="#fff" />
      <path d="M17 18h14M17 24h14M17 30h8" stroke="var(--cd)" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  2: (
    <>
      <path d="M13 6h15l8 8v26a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" />
      <path d="M28 6v8h8" fill="none" stroke="var(--cd)" strokeWidth="3" strokeLinejoin="round" />
      <path d="m17 30 4 4 9-9" fill="none" stroke="var(--cd)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  3: (
    <>
      <rect x="6" y="13" width="36" height="24" rx="5" fill="#fff" />
      <rect x="6" y="18" width="36" height="5" fill="var(--cd)" />
      <rect x="11" y="28" width="11" height="4" rx="2" fill="var(--cd)" />
    </>
  ),
  4: (
    <>
      <circle cx="24" cy="19" r="11" fill="#fff" />
      <path d="m24 13 2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.6z" fill="var(--cd)" />
      <path d="m17 28-3 13 10-5 10 5-3-13" fill="#fff" />
    </>
  ),
};

const STEPS = [
  { n: 1, title: "Solicitud y grado", hint: "Formulario en 4 pasos", tone: "t-orange" },
  { n: 2, title: "8 documentos", hint: "Se suben aquí mismo", tone: "t-sky" },
  { n: 3, title: "Soporte de pago", hint: "Nequi, PSE, Bre-B…", tone: "t-green" },
  { n: 4, title: "¡Cupo confirmado!", hint: "Bienvenido a Lunita", tone: "t-purple" },
];

/**
 * Cabecera de `/matriculas` con el estilo del sitio web (Admisiones): fondo
 * pastel, Lunita en su portal, ruta animada de 4 pasos y ola punteada con estrella.
 */
export function MatriculasHero({ today, hasSession }: { today: string; hasSession: boolean }) {
  const daysLeft = daysUntil(today);

  return (
    <div className="mhero">
      <svg className="mhero__sky" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g className="mhero__float mhero__float--a">
          <circle cx="1040" cy="90" r="16" fill="#ce82ff" opacity=".35" />
          <ellipse cx="1040" cy="90" rx="28" ry="7" fill="none" stroke="#ce82ff" strokeWidth="3" opacity=".45" />
        </g>
        <g className="mhero__float mhero__float--b">
          <circle cx="90" cy="380" r="11" fill="#1cb0f6" opacity=".3" />
        </g>
        {[
          [160, 70, 9],
          [560, 40, 7],
          [760, 130, 6],
          [980, 380, 8],
          [420, 420, 6],
          [1140, 260, 7],
        ].map(([x, y, r], i) => (
          <path
            key={i}
            className="mhero__twinkle"
            style={{ "--i": i } as CSSProperties}
            transform={`translate(${x} ${y}) scale(${(r ?? 6) / 10})`}
            d="M0-10 2.6-2.6 10 0 2.6 2.6 0 10-2.6 2.6-10 0-2.6-2.6Z"
            fill={i % 2 ? "#ffc800" : "#ff86d0"}
          />
        ))}
      </svg>

      <header className="mhero__bar">
        <Link href="/login" className="mhero__brand">
          <LunitaMark size={40} />
          <span>
            <span className="mhero__brand-kicker">Campus Digital</span>
            <span className="mhero__brand-name">Liceo Lunita de Chía</span>
          </span>
        </Link>
        <Link href={hasSession ? "/dashboard" : "/login"} className="mhero__back">
          <ArrowLeft className="size-3.5" aria-hidden /> {hasSession ? "Volver al Campus" : "Ingresar al Campus"}
        </Link>
      </header>

      <div className="mhero__main">
        <div className="mhero__copy">
          <p className="mhero__kicker">
            <span className="moon" aria-hidden /> Matrícula 2027
          </p>
          <h1 className="mhero__title">
            ¡Únete a la <span>familia Lunita!</span>
          </h1>
          <p className="mhero__lead">
            Haz todo en línea: solicitud, documentos y pago. Te guiamos en 4 pasos sencillos.
          </p>
          <ul className="mhero__chips">
            {daysLeft >= 0 && (
              <li className="mhero__chip mhero__chip--hot">
                <CalendarClock aria-hidden /> Pronto pago hasta el {DEADLINE_LABEL}
                {daysLeft > 0 ? ` · quedan ${daysLeft} días` : " · ¡último día!"}
              </li>
            )}
            <li className="mhero__chip">
              <LaptopMinimal aria-hidden /> 100% en línea
            </li>
            <li className="mhero__chip">
              <ShieldCheck aria-hidden /> Datos protegidos (Ley 1581)
            </li>
          </ul>
        </div>

        <div className="mhero__portal" aria-hidden>
          <span className="mhero__ring" />
          <LunitaCharacter size="clamp(130px, 17vw, 200px)" decorative />
        </div>
      </div>

      <ol className="mhero__route" aria-label="Pasos del proceso de matrícula">
        <li className="mhero__comet" aria-hidden />
        {STEPS.map((s) => (
          <li key={s.n} className={`mhero__step ${s.tone}`} style={{ "--i": s.n } as CSSProperties}>
            <span className="mhero__node">
              <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden>
                {STEP_ICONS[s.n]}
              </svg>
              <span className="mhero__num">{s.n}</span>
            </span>
            <span className="mhero__step-text">
              <strong>{s.title}</strong>
              <small>{s.hint}</small>
            </span>
          </li>
        ))}
      </ol>

      <div className="mhero__wave" aria-hidden>
        <svg viewBox="0 0 1200 70" preserveAspectRatio="none">
          <path d="M0 40 C 200 0, 360 70, 600 36 S 1000 0, 1200 30 V70 H0 Z" fill="#F6F8FC" />
          <path className="mhero__dash" d="M0 40 C 200 0, 360 70, 600 36 S 1000 0, 1200 30" fill="none" />
        </svg>
        <span className="mhero__star">★</span>
      </div>

    </div>
  );
}
