"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  findActiveDestination,
  findActiveItem,
  type ResolvedDestination,
} from "@/modules/core/auth/navigation";
import { NavIcon } from "./NavIcon";

/**
 * Pestañas del destino activo sobre el contenido (patrón Classroom/Canvas):
 * muestran en qué parte estás y las secciones hermanas a un toque, también en móvil.
 */
export function DestinationTabs({
  destinations,
  badges = {},
}: {
  destinations: ResolvedDestination[];
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const dest = findActiveDestination(destinations, pathname);
  if (!dest || dest.items.length < 2) return null;
  const activeItem = findActiveItem(dest.items, pathname);

  return (
    <nav aria-label={`Secciones de ${dest.label}`} className="dest-tabs">
      <span className="dest-tabs__title">
        <NavIcon name={dest.icon} />
        {dest.label}
      </span>
      <ul className="dest-tabs__list">
        {dest.items.map((item) => {
          const count = badges[item.key] ?? 0;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="dest-tab"
                aria-current={item.key === activeItem?.key ? "page" : undefined}
              >
                {item.short}
                {count > 0 && <span className="dest-tab__count">{count > 99 ? "99+" : count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
