import type { NavIcon as NavIconName } from "@/modules/core/auth/navigation";

/**
 * Iconos SVG duotono personalizados del Campus Digital Liceo Lunita de Chía.
 * Usan `currentColor` con relleno sutil (opacidad 0.18) para adaptarse al
 * sidebar oscuro, tarjetas claras, barra móvil y estados activos sin duplicar assets.
 */
export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11.2 12 4.5l8 6.7V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.8Z" fill="currentColor" fillOpacity="0.16" />
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V19a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-8.5" />
          <path d="M9.75 21v-5.5a2.25 2.25 0 0 1 4.5 0V21" />
        </svg>
      );

    case "courses":
      // Libro con órbita espacial (identidad Órbita Virtual)
      return (
        <svg {...common}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v15.5H6.5A2.5 2.5 0 0 0 4 21V6.5Z" fill="currentColor" fillOpacity="0.18" />
          <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v15.5h5.5A2.5 2.5 0 0 1 20 21V6.5Z" />
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v15.5H6.5A2.5 2.5 0 0 0 4 21V6.5Z" />
          <circle cx="16.2" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
          <path d="M7.2 9h2.2M7.2 12.5h2.2" />
        </svg>
      );

    case "tasks":
      // Tablero de misiones/tareas con chulo de verificación
      return (
        <svg {...common}>
          <rect x="5" y="4.5" width="14" height="16.5" rx="2.6" fill="currentColor" fillOpacity="0.15" />
          <rect x="8.5" y="2.5" width="7" height="3.8" rx="1.5" fill="currentColor" fillOpacity="0.28" />
          <path d="m8.8 12.6 2 2 4.4-4.6" />
          <path d="M9 17.5h6" />
        </svg>
      );

    case "grades":
      // Birrete académico geométrico con estrella de logro
      return (
        <svg {...common}>
          <path d="M12 4 2.5 8.8 12 13.6l9.5-4.8L12 4Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M6 10.8v4.8c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.8" />
          <path d="M20 9.8v5.5" />
          <circle cx="20" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );

    case "reportCards":
      // Boletín oficial con sello de verificación
      return (
        <svg {...common}>
          <path d="M6 3.5h8.5L19 8v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M14.5 3.5V8H19" />
          <path d="M8.5 10.5h4.5M8.5 14h3" />
          <circle cx="15" cy="15.8" r="2.3" fill="currentColor" fillOpacity="0.25" />
          <path d="M14 18v2.5l1-.7 1 .7V18" />
        </svg>
      );

    case "observer":
      // Cuaderno de seguimiento con pluma/nota
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="13.5" height="17" rx="2.4" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 3.5v17" />
          <path d="M11 8.5h4M11 12h3" />
          <path d="m14.8 17.8 4.9-4.9a1.5 1.5 0 1 1 2.1 2.1l-4.9 4.9-2.8.7.7-2.8Z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );

    case "attendance":
      // Calendario con verificación diaria
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.6" fill="currentColor" fillOpacity="0.15" />
          <path d="M3.5 9.5h17" />
          <path d="M8 3v3.5M16 3v3.5" />
          <path d="m8.8 15 2.1 2.1 4.4-4.4" />
        </svg>
      );

    case "agenda":
      // Circular / comunicado oficial con ondas de difusión
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="14" height="15.5" rx="2.4" fill="currentColor" fillOpacity="0.16" />
          <path d="M7 9h7M7 12.5h7M7 16h4.2" />
          <circle cx="18.2" cy="7.2" r="2.3" fill="currentColor" fillOpacity="0.32" />
        </svg>
      );

    case "structure":
      // Nodos de estructura académica (niveles -> grados -> grupos)
      return (
        <svg {...common}>
          <rect x="8.8" y="3.5" width="6.4" height="4.4" rx="1.4" fill="currentColor" fillOpacity="0.25" />
          <rect x="3" y="15.8" width="5.6" height="4.4" rx="1.3" fill="currentColor" fillOpacity="0.16" />
          <rect x="9.2" y="15.8" width="5.6" height="4.4" rx="1.3" fill="currentColor" fillOpacity="0.16" />
          <rect x="15.4" y="15.8" width="5.6" height="4.4" rx="1.3" fill="currentColor" fillOpacity="0.16" />
          <path d="M12 7.9v3.6M5.8 15.8v-2.3a2 2 0 0 1 2-2h8.4a2 2 0 0 1 2 2v2.3M12 11.5v4.3" />
        </svg>
      );

    case "users":
      // Comunidad escolar (dos siluetas armonizadas)
      return (
        <svg {...common}>
          <circle cx="9.2" cy="8.2" r="3.2" fill="currentColor" fillOpacity="0.22" />
          <path d="M3.5 19.2c0-3.1 2.5-5.2 5.7-5.2s5.7 2.1 5.7 5.2" fill="currentColor" fillOpacity="0.14" />
          <circle cx="16.5" cy="9.2" r="2.4" />
          <path d="M15.8 14.3c2.4.3 4.5 2 4.7 4.9" />
        </svg>
      );

    case "billing":
      return (
        <svg {...common}>
          <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" fill="currentColor" fillOpacity="0.16" />
          <path d="M3.5 10.2h17" />
          <circle cx="15.5" cy="14.2" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );

    case "enrollment":
      return (
        <svg {...common}>
          <path d="M6 3.5h9l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M15 3.5V8h4" />
          <path d="M8.5 12h6M8.5 15.5c1.5-1.2 3 1.2 4.5 0" />
        </svg>
      );

    case "migration":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.12" />
          <path d="M7.5 9.5h8.8l-2.3-2.3M16.5 14.5H7.7l2.3 2.3" />
        </svg>
      );

    case "badges":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5.5" fill="currentColor" fillOpacity="0.16" />
          <path d="m12 6.4.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.5l2-.3.9-1.8Z" />
          <path d="m8.6 13.4-1.6 7.1 5-2.6 5 2.6-1.6-7.1" />
        </svg>
      );

    case "courseReview":
      return (
        <svg {...common}>
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" fill="currentColor" fillOpacity="0.14" />
          <path d="M7.5 9h4M7.5 13h3M7.5 17h2" />
          <path d="m14 12.5 1.8 1.8 3.2-3.4" />
        </svg>
      );

    case "finalReport":
      return (
        <svg {...common}>
          <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z" fill="currentColor" fillOpacity="0.15" />
          <path d="M8.5 8h7M8.5 11.5h4" />
          <path d="m10 16.5 1.6 1.6 3.4-3.6" />
        </svg>
      );
  }
}
