import { Lock } from "lucide-react";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

/** Selector de periodo como pestañas (enlaces: funcionan sin JavaScript). */
export function PeriodTabs({
  periods,
  selectedId,
  hrefFor,
}: {
  periods: Array<{ id: string; number: number; name: string; gradesLocked: boolean }>;
  selectedId: string;
  hrefFor: (periodId: string) => string;
}) {
  return (
    <nav aria-label="Periodos académicos" className="flex flex-wrap gap-1.5">
      {periods.map((p) => {
        const current = p.id === selectedId;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
            aria-current={current ? "page" : undefined}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-semibold no-underline transition-colors duration-150",
              current
                ? "border-navy bg-navy text-white"
                : "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-cloud",
            )}
          >
            Periodo {p.number}
            {p.gradesLocked && <Lock className="size-3.5 opacity-80" aria-label="cerrado" />}
          </Link>
        );
      })}
    </nav>
  );
}
