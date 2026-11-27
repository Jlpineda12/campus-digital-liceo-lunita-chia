"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  findActiveDestination,
  findActiveItem,
  type ResolvedDestination,
} from "@/modules/core/auth/navigation";

interface Crumb {
  label: string;
  href?: string;
}

/** Migas por destino: «Mi progreso › Boletines», más el detalle de rutas profundas del Aula. */
function buildCrumbs(pathname: string, destinations: ResolvedDestination[]): Crumb[] {
  const dest = findActiveDestination(destinations, pathname);
  const item = dest ? findActiveItem(dest.items, pathname) : null;
  if (!dest || !item) return [{ label: "Campus Lunita" }];

  const crumbs: Crumb[] = [];
  if (dest.items.length > 1 || dest.href !== item.href) crumbs.push({ label: dest.label, href: dest.href });
  const deeper = pathname !== item.href;
  crumbs.push({ label: item.label, href: deeper ? item.href : undefined });

  if (deeper && item.key === "courses") {
    const segments = pathname.split("/").filter(Boolean); // ["aula", cursoId, ...]
    if (segments.length === 2) {
      crumbs.push({ label: "Curso" });
    } else if (segments[2] === "tareas") {
      crumbs.push({ label: "Curso", href: `/aula/${segments[1]}` }, { label: "Entrega de tarea" });
    } else if (segments[2] === "quiz") {
      crumbs.push({ label: "Curso", href: `/aula/${segments[1]}` }, { label: "Cuestionario" });
    }
  }
  return crumbs;
}

/** Migas de pan discretas en la barra superior para orientar siempre al usuario. */
export function TopbarBreadcrumbs({
  periodLabel,
  destinations,
}: {
  periodLabel: string | null;
  destinations: ResolvedDestination[];
}) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, destinations);

  return (
    <div className="hidden min-w-0 items-center gap-3 lg:flex">
      <nav aria-label="Ubicación actual" className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={`${c.label}-${idx}`} className="flex min-w-0 items-center gap-1">
              {idx > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted/60" aria-hidden />}
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="truncate font-semibold text-muted no-underline transition-colors hover:text-navy"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "truncate font-extrabold text-navy" : "truncate font-semibold text-muted"}
                >
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {periodLabel && pathname !== "/dashboard" && (
        <span className="hidden rounded-pill bg-cloud px-2.5 py-0.5 text-xs font-bold text-navy xl:inline-flex">
          {periodLabel}
        </span>
      )}
    </div>
  );
}
