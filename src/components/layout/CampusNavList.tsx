"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_SECTION_LABELS,
  type NavSection,
  type ResolvedNavItem,
} from "@/modules/core/auth/navigation";
import { NavIcon } from "./NavIcon";

const SECTION_ORDER: NavSection[] = ["inicio", "aula", "siga", "admin"];

export type CampusZoneFilter = "all" | "aula" | "siga" | "admin";

export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/aula" && (pathname === "/aula/tareas" || pathname.startsWith("/aula/tareas/"))) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}

/** Lista de navegación por secciones con soporte de enfoque por zona (Órbita Virtual vs SIGA). */
export function CampusNavList({
  items,
  badges = {},
  activeZone = "all",
  onNavigate,
}: {
  items: ResolvedNavItem[];
  badges?: Record<string, number>;
  activeZone?: CampusZoneFilter;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const sectionsToRender =
    activeZone === "all"
      ? SECTION_ORDER
      : (["inicio", activeZone] as NavSection[]);

  return (
    <nav aria-label="Navegación del Campus" className="grid gap-4">
      {sectionsToRender.map((section) => {
        const sectionItems = items.filter((i) => i.section === section && i.available);
        if (sectionItems.length === 0) return null;
        return (
          <div key={section}>
            {section !== "inicio" && (
              <p className="mb-1.5 flex items-center justify-between px-3 text-[0.68rem] font-extrabold tracking-widest text-white/85 uppercase">
                <span>{NAV_SECTION_LABELS[section]}</span>
                {activeZone !== "all" && (
                  <span className="rounded-pill bg-white/18 px-2 py-0.5 text-[0.6rem] font-bold tracking-normal text-yellow normal-case">
                    Zona activa
                  </span>
                )}
              </p>
            )}
            <ul className="grid gap-1">
              {sectionItems.map((item) => {
                const count = badges[item.key] ?? 0;
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="nav-item"
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                    >
                      <NavIcon name={item.icon} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={`ml-auto grid min-w-5.5 place-items-center rounded-pill px-1.5 py-0.5 text-[0.68rem] leading-none font-black tabular-nums ${
                            active
                              ? "bg-navy text-yellow"
                              : "bg-yellow text-navy"
                          }`}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
