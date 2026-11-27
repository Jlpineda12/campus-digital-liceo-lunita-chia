import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import Link from "next/link";

export interface WorkAction {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  /** "urgent" = hay algo esperando a otra persona (familias, estudiantes). */
  tone: "urgent" | "normal";
}

/**
 * Lista «Lo que sigue» de docentes y directivos: solo acciones concretas,
 * de la más urgente a la menos, con un máximo visible para no abrumar.
 */
export function ActionList({
  title,
  actions,
  max = 5,
  emptyText,
}: {
  title: string;
  actions: WorkAction[];
  max?: number;
  emptyText: string;
}) {
  const shown = actions.slice(0, max);
  const hidden = actions.length - shown.length;

  return (
    <section aria-labelledby="lo-que-sigue" className="card grid min-w-0 gap-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <h2 id="lo-que-sigue" className="text-lg">
          {title}
        </h2>
        {actions.length > 0 && (
          <span className="rounded-pill bg-yellow px-2.5 py-0.5 text-xs font-black text-navy tabular">
            {actions.length} {actions.length === 1 ? "pendiente" : "pendientes"}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="flex items-center gap-2 rounded-control bg-green-l/50 px-4 py-4 text-sm font-bold text-green-solid">
          <CheckCircle2 className="size-5" aria-hidden /> {emptyText}
        </p>
      ) : (
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {shown.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-control border border-line bg-white px-4 py-3 no-underline transition-colors hover:bg-cloud/70"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                      a.tone === "urgent" ? "bg-orange-l text-orange-solid" : "bg-cloud text-cobalt"
                    }`}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-navy">{a.title}</span>
                    <span className="block truncate text-xs text-muted">{a.detail}</span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {hidden > 0 && <p className="text-xs font-semibold text-muted">y {hidden} más en sus secciones.</p>}
    </section>
  );
}
