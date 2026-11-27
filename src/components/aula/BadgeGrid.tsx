import {
  BrainCircuit,
  CalendarCheck,
  Clock3,
  Compass,
  Flame,
  Lock,
  MessagesSquare,
  Rocket,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { BadgeIcon, EvaluatedBadge } from "@/modules/aula/badges";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  rocket: Rocket,
  clock: Clock3,
  brain: BrainCircuit,
  compass: Compass,
  message: MessagesSquare,
  calendar: CalendarCheck,
  flame: Flame,
  star: Star,
};

/** Cuadrícula de insignias: ganadas en color, pendientes en gris con su barra de avance. */
export function BadgeGrid({ badges }: { badges: EvaluatedBadge[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {badges.map((b, i) => {
        const Icon = ICONS[b.icon];
        return (
          <li
            key={b.key}
            className="badge-card reveal"
            data-earned={b.earned || undefined}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="badge-medal" aria-hidden>
              <Icon className="size-7" strokeWidth={2} />
              {!b.earned && (
                <span className="badge-lock">
                  <Lock className="size-3" strokeWidth={2.5} />
                </span>
              )}
            </span>
            <h3 className="text-sm font-extrabold text-navy">{b.name}</h3>
            <p className="text-xs leading-relaxed text-muted">{b.description}</p>
            {b.earned ? (
              <p className="mt-auto text-xs font-extrabold text-green-solid">¡Conseguida!</p>
            ) : (
              <div className="mt-auto grid gap-1">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label={`Avance de ${b.name}`}
                  aria-valuemin={0}
                  aria-valuemax={b.target}
                  aria-valuenow={b.current}
                >
                  <div className="h-full rounded-full bg-cobalt" style={{ width: `${b.percent}%` }} />
                </div>
                <p className="text-[0.7rem] font-semibold text-muted tabular">{b.detail}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
