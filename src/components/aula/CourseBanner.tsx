import { StheamiBadge } from "@/components/ui/StheamiBadge";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import {
  resolveBannerGradient,
  type BannerPreset,
  type CourseIconKey,
  type CourseThemeConfig,
} from "@/modules/aula/themes";

/**
 * 20 emblemas SVG duotono personalizados del Liceo Lunita de Chía para cursos.
 * Usan `currentColor` para trazos y relleno suave translúcido (`fillOpacity="0.22"`).
 */
export function CourseEmblemIcon({
  iconKey,
  className = "size-6",
}: {
  iconKey: CourseIconKey;
  className?: string;
}) {
  const p = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (iconKey) {
    case "calculator":
      return (
        <svg {...p}>
          <rect x="4" y="2.5" width="16" height="19" rx="3" fill="currentColor" fillOpacity="0.16" />
          <rect x="7" y="5.5" width="10" height="4" rx="1" fill="currentColor" fillOpacity="0.3" />
          <circle cx="8.5" cy="13" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="13" r="1" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="17" r="1" fill="currentColor" stroke="none" />
          <line x1="12" y1="17" x2="16" y2="17" />
        </svg>
      );
    case "flask":
      return (
        <svg {...p}>
          <path d="M9 3h6M10 3v5.5L5.2 17.6A2.2 2.2 0 0 0 7.1 21h9.8a2.2 2.2 0 0 0 1.9-3.4L14 8.5V3" />
          <path d="M6.8 15h10.4l1.5 2.7A2 2 0 0 1 17 20.5H7a2 2 0 0 1-1.7-2.8L6.8 15Z" fill="currentColor" fillOpacity="0.26" stroke="none" />
          <circle cx="10.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "microscope":
      return (
        <svg {...p}>
          <path d="M6 20h12" />
          <path d="M9 20v-2a6 6 0 0 0 6-6" />
          <rect x="10.5" y="3.5" width="4" height="9" rx="1.2" transform="rotate(-24 12.5 8)" fill="currentColor" fillOpacity="0.22" />
          <path d="M7 14h6" />
          <circle cx="14.5" cy="13" r="2.2" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case "dna":
      return (
        <svg {...p}>
          <path d="M7 3c0 5 10 5 10 9.5S7 17 7 21" />
          <path d="M17 3c0 5-10 5-10 9.5S17 17 17 21" />
          <path d="M8.5 6.5h7M9 12h6M8.5 17.5h7" strokeOpacity="0.8" />
          <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.25" stroke="none" />
        </svg>
      );
    case "atom":
      return (
        <svg {...p}>
          <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(30 12 12)" fill="currentColor" fillOpacity="0.1" />
          <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(-30 12 12)" />
          <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(90 12 12)" />
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...p}>
          <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" fillOpacity="0.18" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" fillOpacity="0.35" />
          <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
        </svg>
      );
    case "code":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity="0.15" />
          <path d="m8.5 9.5-2.5 2.5 2.5 2.5M15.5 9.5 18 12l-2.5 2.5M13 8.5l-2 7" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...p}>
          <path d="M14.5 3.5c3.5 0 6 2.5 6 6-2 3.5-5.5 6.5-9.5 8L6.5 13c1.5-4 4.5-7.5 8-9.5Z" fill="currentColor" fillOpacity="0.2" />
          <circle cx="14.5" cy="9.5" r="1.6" fill="currentColor" />
          <path d="M6.5 13 3.5 14l2 2M11 17.5 10 20.5l-2-2" />
          <path d="M4.5 19.5c1-1.5 2-2 3-2.5" />
        </svg>
      );
    case "planet":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="5.5" fill="currentColor" fillOpacity="0.22" />
          <ellipse cx="12" cy="12" rx="10.2" ry="3.4" transform="rotate(-22 12 12)" />
          <circle cx="18.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "palette":
      return (
        <svg {...p}>
          <path d="M12 3a9 9 0 1 0 0 18h1.4a2.4 2.4 0 0 0 1.8-4 2.1 2.1 0 0 1 1.6-3.4H18a3 3 0 0 0 3-3A7.6 7.6 0 0 0 12 3Z" fill="currentColor" fillOpacity="0.18" />
          <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "music":
      return (
        <svg {...p}>
          <path d="M9 17.5V6.2l10-2.2v11.3" />
          <path d="M9 10l10-2.2" />
          <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" fillOpacity="0.28" />
          <circle cx="16.5" cy="15.3" r="2.5" fill="currentColor" fillOpacity="0.28" />
        </svg>
      );
    case "feather":
      return (
        <svg {...p}>
          <path d="M20 4c-5.5 0-11 3.5-13.5 9.5L4 20l6.5-2.5C16.5 15 20 9.5 20 4Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M4 20 15 9M10 14h5" />
        </svg>
      );
    case "scroll":
      return (
        <svg {...p}>
          <path d="M7 4h10a2.5 2.5 0 0 1 2.5 2.5V8H17V6.5" />
          <path d="M7 4a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V16H7v1.5" fill="currentColor" fillOpacity="0.18" />
          <path d="M9 9h6M9 12.5h4.5" />
        </svg>
      );
    case "globe":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.16" />
          <ellipse cx="12" cy="12" rx="4.2" ry="9" />
          <path d="M3.5 9.5h17M3.5 14.5h17" />
        </svg>
      );
    case "compass":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.16" />
          <polygon points="15.5,8.5 13.4,13.4 8.5,15.5 10.6,10.6" fill="currentColor" fillOpacity="0.4" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...p}>
          <path d="M19.5 4.5C12 4.5 6 8.5 5.5 16.5c4.5 2.5 11.5 1 13.5-5 1-3 .5-7 .5-7Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M4 20c2.5-3.5 6.5-7 11.5-9.5" />
        </svg>
      );
    case "heart":
      return (
        <svg {...p}>
          <path d="M12 20s-7.5-4.7-9-9.4C1.9 7 4.4 4 7.7 4c1.9 0 3.4 1 4.3 2.4C12.9 5 14.4 4 16.3 4 19.6 4 22.1 7 21 10.6 19.5 15.3 12 20 12 20Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M9 11.5 11 13.5 15 9.5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...p}>
          <path d="M4 19.5h16" />
          <rect x="5.5" y="12.5" width="3" height="7" rx="1" fill="currentColor" fillOpacity="0.24" />
          <rect x="10.5" y="8.5" width="3" height="11" rx="1" fill="currentColor" fillOpacity="0.24" />
          <rect x="15.5" y="5" width="3" height="14.5" rx="1" fill="currentColor" fillOpacity="0.32" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...p}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M7 6H4.5a2 2 0 0 0 0 4H7M17 6h2.5a2 2 0 0 1 0 4H17M12 14v4M8.5 20h7" />
        </svg>
      );
    default: // book
      return (
        <svg {...p}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" fill="currentColor" fillOpacity="0.18" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
  }
}

/** 12 artes SVG exclusivos para las portadas de cursos en Órbita Virtual. */
function BannerPatternSvg({ preset }: { preset: BannerPreset }) {
  switch (preset) {
    case "geometry":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-22" aria-hidden="true">
          <polygon points="720,10 860,190 580,190" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <rect x="640" y="34" width="110" height="110" rx="14" fill="none" stroke="#FFC800" strokeWidth="1.4" transform="rotate(14 695 89)" />
          <circle cx="810" cy="70" r="46" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="5 5" />
          <polygon points="110,180 170,110 230,180" fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
        </svg>
      );
    case "botanical":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <path d="M680 220 C680 120, 760 70, 860 30" fill="none" stroke="#FFC800" strokeWidth="1.8" />
          <path d="M740 135 C785 120, 815 95, 835 60 C795 75, 760 95, 740 135 Z" fill="#FFFFFF" fillOpacity="0.25" />
          <path d="M715 165 C675 140, 650 110, 645 75 C685 95, 710 125, 715 165 Z" fill="#FFFFFF" fillOpacity="0.2" />
          <circle cx="790" cy="170" r="36" fill="none" stroke="#FFFFFF" strokeWidth="1.1" strokeDasharray="4 6" />
        </svg>
      );
    case "waves":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <path d="M0 155 Q150 95 300 155 T600 155 T900 155" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M0 185 Q150 125 300 185 T600 185 T900 185" fill="none" stroke="#FFC800" strokeWidth="1.4" />
          <path d="M0 125 Q150 65 300 125 T600 125 T900 125" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="5 6" />
        </svg>
      );
    case "lab":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <polygon points="740,35 785,60 785,110 740,135 695,110 695,60" fill="none" stroke="#FFC800" strokeWidth="1.6" />
          <polygon points="830,85 875,110 875,160 830,185 785,160 785,110" fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
          <circle cx="740" cy="85" r="14" fill="#FFFFFF" fillOpacity="0.22" />
          <circle cx="635" cy="145" r="6" fill="#FFC800" />
          <line x1="641" y1="142" x2="695" y2="110" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
      );
    case "muisca":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <path d="M580 180 L620 140 L660 180 L700 140 L740 180 L780 140 L820 180 L860 140" fill="none" stroke="#FFC800" strokeWidth="2.2" />
          <path d="M620 90 L660 50 L700 90 L660 130 Z" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M740 90 L780 50 L820 90 L780 130 Z" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="660" cy="90" r="8" fill="#FFC800" />
          <circle cx="780" cy="90" r="8" fill="#FFC800" />
        </svg>
      );
    case "circuits":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <path d="M560 50 H650 L680 80 H770 M600 155 H710 L745 120 H860 M680 80 V140 L710 170 H820" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="560" cy="50" r="5" fill="#FFC800" />
          <circle cx="770" cy="80" r="6" fill="none" stroke="#FFC800" strokeWidth="2" />
          <circle cx="860" cy="120" r="5" fill="#FFFFFF" />
          <rect x="730" y="148" width="44" height="44" rx="8" fill="#FFFFFF" fillOpacity="0.16" stroke="#FFC800" strokeWidth="1.4" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-22" aria-hidden="true">
          {[70, 88, 106, 124, 142].map((y) => (
            <path key={y} d={`M480 ${y} Q690 ${y - 28} 900 ${y}`} fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
          ))}
          <circle cx="660" cy="108" r="10" fill="#FFC800" />
          <line x1="670" y1="108" x2="670" y2="54" stroke="#FFC800" strokeWidth="2.2" />
          <circle cx="765" cy="92" r="9" fill="#FFFFFF" />
          <line x1="774" y1="92" x2="774" y2="42" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="670" y1="54" x2="774" y2="42" stroke="#FFC800" strokeWidth="3" />
        </svg>
      );
    case "stars":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-26" aria-hidden="true">
          <path d="M770 40 A48 48 0 1 0 842 104 A36 36 0 1 1 770 40 Z" fill="#FFC800" fillOpacity="0.45" />
          <path d="M645 48 L649 60 L661 64 L649 68 L645 80 L641 68 L629 64 L641 60 Z" fill="#FFFFFF" />
          <path d="M710 135 L713 144 L722 147 L713 150 L710 159 L707 150 L698 147 L707 144 Z" fill="#FFC800" />
          <circle cx="590" cy="120" r="3" fill="#FFFFFF" />
          <circle cx="835" cy="170" r="4" fill="#FFFFFF" />
          <circle cx="690" cy="40" r="2.5" fill="#FFC800" />
        </svg>
      );
    case "mathgrid":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-22" aria-hidden="true">
          {[560, 620, 680, 740, 800, 860].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="220" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.45" />
          ))}
          {[40, 90, 140, 190].map((y) => (
            <line key={y} x1="520" y1={y} x2="900" y2={y} stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.45" />
          ))}
          <path d="M540 190 Q660 20 750 120 T885 35" fill="none" stroke="#FFC800" strokeWidth="2.4" />
          <circle cx="680" cy="82" r="5" fill="#FFC800" />
          <circle cx="800" cy="112" r="5" fill="#FFFFFF" />
        </svg>
      );
    case "artbrush":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-24" aria-hidden="true">
          <path d="M590 175 C640 85, 720 65, 865 95" fill="none" stroke="#FFC800" strokeWidth="14" strokeLinecap="round" strokeOpacity="0.38" />
          <path d="M620 45 C700 125, 760 185, 860 155" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeOpacity="0.32" />
          <circle cx="785" cy="52" r="16" fill="#FFFFFF" fillOpacity="0.22" />
          <circle cx="675" cy="168" r="10" fill="#FFC800" fillOpacity="0.45" />
        </svg>
      );
    case "literature":
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-22" aria-hidden="true">
          <path d="M635 170 Q710 140 765 170 Q820 140 885 170 V68 Q820 42 765 68 Q710 42 635 68 Z" fill="#FFFFFF" fillOpacity="0.14" stroke="#FFFFFF" strokeWidth="1.6" />
          <line x1="765" y1="68" x2="765" y2="170" stroke="#FFC800" strokeWidth="1.8" />
          <path d="M660 94 H738 M660 116 H732 M660 138 H720 M792 94 H860 M792 116 H852" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default: // constellation
      return (
        <svg viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full opacity-26" aria-hidden="true">
          <circle cx="790" cy="50" r="150" fill="none" stroke="#FFC800" strokeWidth="1.3" strokeDasharray="5 7" />
          <circle cx="790" cy="50" r="95" fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
          <circle cx="620" cy="48" r="3" fill="#FFC800" />
          <circle cx="685" cy="158" r="2.5" fill="#FFFFFF" />
          <path d="M720 26 L722 32 L728 34 L722 36 L720 42 L718 36 L712 34 L718 32 Z" fill="#FFC800" />
        </svg>
      );
  }
}

/** Portada personalizada del curso en Órbita Virtual (contraste WCAG AA garantizado). */
export function CourseBanner({
  courseAssignmentId,
  subjectName,
  groupName,
  gradeName,
  teacherName,
  periodName,
  pillar,
  theme,
  previewBannerUrl,
  subtitleRight,
  actions,
}: {
  courseAssignmentId?: string;
  subjectName: string;
  groupName: string;
  gradeName: string;
  teacherName: string | null;
  periodName: string;
  pillar: StheamiPillar;
  theme: CourseThemeConfig;
  /** URL temporal de vista previa local en el editor del docente (override sobre banner guardado). */
  previewBannerUrl?: string | null;
  subtitleRight?: string;
  actions?: React.ReactNode;
}) {
  const gradient = resolveBannerGradient(theme);
  const bannerImageSrc =
    previewBannerUrl !== undefined
      ? previewBannerUrl
      : theme.hasBannerImage && courseAssignmentId
        ? `/api/aula/archivos?tipo=banner&id=${courseAssignmentId}`
        : null;

  return (
    <div
      className="relative overflow-hidden rounded-card border border-white/15 px-6 py-6 text-white shadow-sm"
      style={{ background: gradient }}
    >
      {bannerImageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerImageSrc}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Velo oscuro degradado para garantizar contraste WCAG AA del texto blanco sobre cualquier foto */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, rgba(10, 15, 45, 0.84) 0%, rgba(15, 23, 71, 0.62) 55%, rgba(15, 23, 71, 0.42) 100%)",
            }}
          />
        </>
      ) : (
        <BannerPatternSvg preset={theme.bannerPreset} />
      )}

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-yellow ring-1 ring-white/25 backdrop-blur-xs">
            <CourseEmblemIcon iconKey={theme.iconKey} className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StheamiBadge pillar={pillar} size="sm" />
              <span className="text-xs font-extrabold tracking-wider text-yellow uppercase">
                Órbita Virtual · {groupName} ({gradeName})
              </span>
            </div>
            <h1 className="mt-1.5 text-step-3 text-white drop-shadow-xs">{subjectName}</h1>
            <p className="mt-0.5 text-sm font-medium text-white/90">
              {teacherName ? `Prof. ${teacherName}` : "Docente por asignar"} · {periodName}
              {subtitleRight ? ` · ${subtitleRight}` : ""}
            </p>
            {theme.welcomeMessage && (
              <p className="mt-2.5 max-w-2xl rounded-control bg-black/30 px-3 py-2 text-xs leading-relaxed text-white/95 backdrop-blur-xs">
                {theme.welcomeMessage}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
