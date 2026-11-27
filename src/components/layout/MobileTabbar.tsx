"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { findActiveDestination, type ResolvedDestination } from "@/modules/core/auth/navigation";
import { destinationBadge } from "./CampusNavList";
import { NavIcon } from "./NavIcon";

/**
 * Barra inferior móvil: los mismos 4 destinos de la barra lateral + Menú
 * (secciones, búsqueda y perfil). Igual en todos los tamaños: nadie se pierde.
 */
export function MobileTabbar({
  destinations,
  badges = {},
  onMenu,
}: {
  destinations: ResolvedDestination[];
  badges?: Record<string, number>;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const active = findActiveDestination(destinations, pathname);

  return (
    <nav
      aria-label="Destinos principales"
      className="tabbar lg:hidden"
      style={{ "--tabs": destinations.length + 1 } as CSSProperties}
    >
      {destinations.map((dest) => {
        const count = destinationBadge(dest, badges);
        return (
          <Link
            key={dest.key}
            href={dest.href}
            className="tabbar-item relative"
            aria-current={dest.key === active?.key ? "page" : undefined}
          >
            <NavIcon name={dest.icon} />
            {dest.label}
            {count > 0 && (
              <span className="absolute top-0.5 left-[calc(50%+6px)] grid min-w-4.5 place-items-center rounded-pill bg-yellow px-1 text-[0.6rem] leading-4 font-black text-navy">
                {count > 9 ? "9+" : count}
                <span className="sr-only"> pendientes</span>
              </span>
            )}
          </Link>
        );
      })}
      <button type="button" className="tabbar-item" onClick={onMenu} aria-haspopup="dialog">
        <Menu aria-hidden />
        Menú
      </button>
    </nav>
  );
}
