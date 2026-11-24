"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard") {
    return [{ label: "Inicio" }];
  }

  const crumbs: Crumb[] = [{ label: "Inicio", href: "/dashboard" }];

  if (pathname === "/aula") {
    crumbs.push({ label: "Órbita Virtual" });
  } else if (pathname === "/aula/tareas") {
    crumbs.push({ label: "Órbita Virtual", href: "/aula" }, { label: "Tareas y cuestionarios" });
  } else if (pathname.startsWith("/aula/")) {
    const segments = pathname.split("/").filter(Boolean); // ["aula", cursoId, ...]
    crumbs.push({ label: "Órbita Virtual", href: "/aula" });
    if (segments.length === 2) {
      crumbs.push({ label: "Curso" });
    } else if (segments[2] === "tareas") {
      crumbs.push({ label: "Curso", href: `/aula/${segments[1]}` }, { label: "Entrega de tarea" });
    } else if (segments[2] === "quiz") {
      crumbs.push({ label: "Curso", href: `/aula/${segments[1]}` }, { label: "Cuestionario interactivo" });
    }
  } else if (pathname.startsWith("/siga/")) {
    const map: Record<string, string> = {
      "/siga/calificaciones": "Calificaciones y logros",
      "/siga/boletines": "Boletines oficiales",
      "/siga/observador": "Observador del estudiante",
      "/siga/asistencia": "Asistencia y excusas",
      "/siga/agenda": "Agenda y circulares",
      "/siga/cartera": "Cartera y pagos",
    };
    crumbs.push({ label: "SIGA Lunita" }, { label: map[pathname] ?? "Módulo académico" });
  } else if (pathname.startsWith("/admin/")) {
    const map: Record<string, string> = {
      "/admin/usuarios": "Usuarios y roles",
      "/admin/estructura": "Estructura académica",
      "/admin/matriculas": "Matrículas 2027",
      "/admin/migracion": "Migración y SIMAT",
    };
    crumbs.push({ label: "Dirección" }, { label: map[pathname] ?? "Gestión institucional" });
  }

  return crumbs;
}

/** Migas de pan discretas en la barra superior para orientar siempre al usuario. */
export function TopbarBreadcrumbs({ periodLabel }: { periodLabel: string | null }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

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
