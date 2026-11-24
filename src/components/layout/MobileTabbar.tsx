"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import type { ResolvedNavItem } from "@/modules/core/auth/navigation";
import { isActivePath } from "./CampusNavList";
import { NavIcon } from "./NavIcon";

const SHORT_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  courses: "Cursos",
  tasks: "Tareas",
  grades: "Notas",
  attendance: "Asistencia",
  billing: "Pagos",
  observer: "Observador",
  structure: "Estructura",
  users: "Usuarios",
  enrollment: "Matrículas",
};

/**
 * Barra de navegación inferior para móvil (`.tabbar` del sitio Astro).
 * Solo muestra módulos disponibles; el resto vive en el menú completo.
 */
export function MobileTabbar({
  navigation,
  tabKeys,
  onSearch,
  onMenu,
}: {
  navigation: ResolvedNavItem[];
  tabKeys: readonly string[];
  onSearch: () => void;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const tabs = ["dashboard", ...tabKeys]
    .map((key) => navigation.find((item) => item.key === key && item.available))
    .filter((item): item is ResolvedNavItem => Boolean(item))
    .slice(0, 3);

  return (
    <nav
      aria-label="Accesos rápidos"
      className="tabbar lg:hidden"
      style={{ "--tabs": tabs.length + 2 } as CSSProperties}
    >
      {tabs.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="tabbar-item"
          aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
        >
          <NavIcon name={item.icon} />
          {SHORT_LABELS[item.key] ?? item.label}
        </Link>
      ))}
      <button type="button" className="tabbar-item" onClick={onSearch}>
        <Search aria-hidden />
        Buscar
      </button>
      <button type="button" className="tabbar-item" onClick={onMenu} aria-haspopup="dialog">
        <Menu aria-hidden />
        Menú
      </button>
    </nav>
  );
}
