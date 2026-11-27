import { LunitaCharacter } from "@/components/brand/LunitaCharacter";
import type { PlatformSpaceKey } from "@/modules/core/brand/config";

/**
 * Logos vectoriales personalizados estilo táctil 3D (inspiración Duolingo + identidad Lunita):
 * colores planos vibrantes, labio inferior sólido 3D, brillos superiores suaves y geometría
 * redondeada con alta legibilidad desde 24px hasta 64px.
 */
export function PlatformLogo({
  space,
  size = 44,
  title,
  className,
}: {
  space: PlatformSpaceKey;
  size?: number;
  title?: string;
  className?: string;
}) {
  if (space === "siga") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        {title && <title>{title}</title>}
        {/* Base táctil 3D celeste (--sky / --sky-d) */}
        <rect x="2" y="6" width="60" height="56" rx="18" fill="#1899D6" />
        <rect x="2" y="2" width="60" height="55" rx="18" fill="#1CB0F6" />
        {/* Brillo superior tipo Duolingo */}
        <path d="M12 10.5C15.5 7.8 21.5 7 29 7H35" stroke="#7CE0FF" strokeWidth="3.5" strokeLinecap="round" />

        {/* Libreta académica táctil blanca con lomo navy */}
        <rect x="14" y="15" width="32" height="36" rx="8" fill="#137BB0" />
        <rect x="14" y="12" width="32" height="36" rx="8" fill="#FFFFFF" />
        {/* Lomo izquierdo azul cobalto */}
        <path d="M14 20C14 15.582 17.582 12 22 12H23V48H22C17.582 48 14 44.418 14 40V20Z" fill="#303296" />
        <rect x="16.5" y="17" width="2.4" height="10" rx="1.2" fill="#6366F1" />

        {/* Barras de calificaciones SIEE (colores alegres) */}
        <rect x="27" y="20" width="13" height="4.2" rx="2.1" fill="#FFC800" />
        <rect x="27" y="28" width="14" height="3.8" rx="1.9" fill="#CBD5E1" />
        <rect x="27" y="35.5" width="10" height="3.8" rx="1.9" fill="#CBD5E1" />

        {/* Medalla 3D verde-dorada con check */}
        <circle cx="45" cy="44" r="12.5" fill="#46A302" />
        <circle cx="45" cy="41.5" r="12.5" fill="#58CC02" />
        <path d="M39.5 34.5C41.5 33 44 32.3 46.8 32.5" stroke="#9DF259" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M39.6 41.8L43.2 45.4L50.8 37.8"
          stroke="#FFFFFF"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (space === "aula") {
    // Órbita Virtual usa como logo a Lunita, el personaje del colegio (modo compacto).
    return (
      <span className={className} title={title} style={{ display: "inline-flex", height: size }}>
        <LunitaCharacter compact size={size} intro={false} track={false} decorative />
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      {/* Base táctil 3D dorado Lunita (--yellow / --yellow-d) */}
      <rect x="2" y="6" width="60" height="56" rx="18" fill="#D99800" />
      <rect x="2" y="2" width="60" height="55" rx="18" fill="#FFC800" />
      {/* Brillo superior tipo Duolingo */}
      <path d="M12 10.5C15.5 7.8 21.5 7 29 7H35" stroke="#FFF4C2" strokeWidth="3.5" strokeLinecap="round" />

      {/* Colegio / Pórtico institucional táctil navy */}
      <path d="M13 28.5L32 15.5L51 28.5H13Z" fill="#070C2E" />
      <path d="M13 26.5L32 13.5L51 26.5H13Z" fill="#303296" />
      {/* Estrella blanca en el frontón */}
      <circle cx="32" cy="21.5" r="3" fill="#FFC800" />

      {/* Columnas blancas con sombra 3D */}
      <rect x="17" y="28.5" width="6.5" height="16.5" rx="3" fill="#0F1747" />
      <rect x="17" y="27.5" width="6.5" height="15.5" rx="3" fill="#FFFFFF" />

      <rect x="28.75" y="28.5" width="6.5" height="16.5" rx="3" fill="#0F1747" />
      <rect x="28.75" y="27.5" width="6.5" height="15.5" rx="3" fill="#FFFFFF" />

      <rect x="40.5" y="28.5" width="6.5" height="16.5" rx="3" fill="#0F1747" />
      <rect x="40.5" y="27.5" width="6.5" height="15.5" rx="3" fill="#FFFFFF" />

      {/* Base sólida navy */}
      <rect x="12" y="45" width="40" height="6.5" rx="3.25" fill="#070C2E" />
      <rect x="12" y="43.5" width="40" height="5.5" rx="2.75" fill="#0F1747" />
      {/* Rombo Muisca central */}
      <path d="M32 44.3L35.2 46.25L32 48.2L28.8 46.25Z" fill="#FFC800" />
    </svg>
  );
}
