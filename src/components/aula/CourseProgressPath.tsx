import { Check, Sparkles } from "lucide-react";
import type { CourseWorkspaceUnit } from "@/modules/aula/queries";

/**
 * Ruta visual interactiva de módulos dentro de `/aula/[cursoId]`:
 * muestra nodos conectados (Completado ✓ / En curso ✨ / Pendiente), anillo SVG de progreso
 * y anclas rápidas para saltar a cada módulo sin perder orientación.
 */
export function CourseProgressPath({
  units,
  isFamily,
}: {
  units: CourseWorkspaceUnit[];
  isFamily: boolean;
}) {
  if (units.length === 0) return null;

  const unitSummaries = units.map((u, idx) => {
    const totalItems = u.resources.length + u.activities.length;
    const completedItems = isFamily
      ? u.resources.filter((r) => r.viewed).length +
        u.activities.filter((a) => a.studentStatus === "SUBMITTED" || a.studentStatus === "GRADED").length
      : totalItems;
    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const state: "done" | "current" | "pending" =
      isFamily && totalItems > 0 && completedItems === totalItems
        ? "done"
        : completedItems > 0 || idx === 0
          ? "current"
          : "pending";
    return { id: u.id, index: idx + 1, title: u.title, totalItems, completedItems, percent, state };
  });

  const totalAll = unitSummaries.reduce((s, u) => s + u.totalItems, 0);
  const doneAll = unitSummaries.reduce((s, u) => s + u.completedItems, 0);
  const overallPercent = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - overallPercent / 100);

  return (
    <section
      aria-label="Ruta interactiva de módulos del curso"
      className="card flex flex-wrap items-center gap-5 bg-white"
    >
      {/* Anillo de progreso del curso */}
      <div className="flex items-center gap-3.5">
        <div className="relative grid size-16 shrink-0 place-items-center">
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#EEF1F8" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke={isFamily ? (overallPercent === 100 ? "#2F7D00" : "#303296") : "#303296"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute text-sm font-black text-navy tabular">
            {isFamily ? `${overallPercent}%` : units.length}
          </span>
        </div>
        <div>
          <p className="text-[0.68rem] font-extrabold tracking-wider text-cobalt uppercase">
            {isFamily ? "Tu ruta en este periodo" : "Mapa del periodo"}
          </p>
          <p className="text-sm font-extrabold text-navy">
            {isFamily
              ? `${doneAll} de ${totalAll} elementos completados`
              : `${units.length} ${units.length === 1 ? "módulo publicado" : "módulos publicados"} · ${totalAll} ítems`}
          </p>
        </div>
      </div>

      {/* Nodos horizontales conectados */}
      <nav aria-label="Saltar a módulo" className="flex flex-1 flex-wrap items-center gap-2">
        {unitSummaries.map((u, idx) => (
          <div key={u.id} className="flex items-center gap-2">
            {idx > 0 && <span className="hidden h-0.5 w-4 rounded-full bg-line sm:block" aria-hidden />}
            <a
              href={`#modulo-${u.id}`}
              className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-bold no-underline transition-all hover:-translate-y-0.5 ${
                u.state === "done"
                  ? "border-green-solid/35 bg-green-l/55 text-green-solid"
                  : u.state === "current"
                    ? "border-cobalt/35 bg-cloud text-cobalt shadow-2xs"
                    : "border-line bg-bg-2/70 text-muted hover:text-navy"
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[0.68rem] font-black ${
                  u.state === "done"
                    ? "bg-green-solid text-white"
                    : u.state === "current"
                      ? "bg-cobalt text-yellow"
                      : "bg-line text-muted"
                }`}
              >
                {u.state === "done" ? (
                  <Check className="size-3" aria-hidden />
                ) : u.state === "current" ? (
                  <Sparkles className="size-3" aria-hidden />
                ) : (
                  u.index
                )}
              </span>
              <span className="max-w-44 truncate">{u.title}</span>
              {isFamily && u.totalItems > 0 && (
                <span className="text-[0.68rem] opacity-80 tabular">
                  {u.completedItems}/{u.totalItems}
                </span>
              )}
            </a>
          </div>
        ))}
      </nav>
    </section>
  );
}
