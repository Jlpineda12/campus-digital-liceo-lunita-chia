"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  findActiveDestination,
  findActiveItem,
  type ResolvedDestination,
} from "@/modules/core/auth/navigation";
import { NavIcon } from "./NavIcon";

export function destinationBadge(dest: ResolvedDestination, badges: Record<string, number>): number {
  return dest.items.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);
}

function Count({ value, inverted }: { value: number; inverted?: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      className={`ml-auto grid min-w-5.5 place-items-center rounded-pill px-1.5 py-0.5 text-[0.68rem] leading-none font-black tabular-nums ${
        inverted ? "bg-navy text-yellow" : "bg-yellow text-navy"
      }`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Navegación de 4 destinos. El destino activo despliega sus secciones debajo
 * (y como pestañas sobre el contenido), así el estudiante siempre sabe dónde está
 * y todas las funciones siguen a un clic. `expandAll` muestra todo (menú móvil).
 */
export function CampusNavList({
  destinations,
  badges = {},
  expandAll = false,
  onNavigate,
}: {
  destinations: ResolvedDestination[];
  badges?: Record<string, number>;
  expandAll?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeDest = findActiveDestination(destinations, pathname);
  const activeItem = findActiveItem(
    destinations.flatMap((d) => d.items),
    pathname,
  );

  return (
    <nav aria-label="Navegación del Campus">
      <ul className="grid gap-1.5">
        {destinations.map((dest) => {
          const isActive = dest.key === activeDest?.key;
          const showChildren = dest.items.length > 1 && (isActive || expandAll);
          const singleAndCurrent = dest.items.length === 1 && activeItem?.href === dest.href;
          return (
            <li key={dest.key}>
              <Link
                href={dest.href}
                className="nav-item"
                aria-current={singleAndCurrent ? "page" : isActive ? "true" : undefined}
                onClick={onNavigate}
              >
                <NavIcon name={dest.icon} />
                <span className="min-w-0 flex-1 truncate">{dest.label}</span>
                <Count value={destinationBadge(dest, badges)} inverted={isActive} />
              </Link>

              {showChildren && (
                <ul className="nav-sublist" aria-label={`Secciones de ${dest.label}`}>
                  {dest.items.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className="nav-subitem"
                        aria-current={item.key === activeItem?.key ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.short}</span>
                        <Count value={badges[item.key] ?? 0} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
