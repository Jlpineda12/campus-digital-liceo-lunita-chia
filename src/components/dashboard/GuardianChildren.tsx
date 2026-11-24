import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/components/ui/cx";
import {
  GUARDIAN_RELATIONSHIP_LABELS,
  LEVEL_LABELS,
} from "@/modules/core/academic-structure/constants";
import type { GuardianChild } from "@/modules/core/academic-structure/queries";
import { selectChildAction } from "@/modules/core/auth/actions";
import { revealStyle } from "./parts";

/** Tarjetas para elegir qué hijo consultar, con su nivel (Primaria / Bachillerato). */
export function GuardianChildren({
  items,
  selectedId,
}: {
  items: GuardianChild[];
  selectedId: string | null;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tus hijos">
      {items.map((child, index) => {
        const selected = child.studentId === selectedId;
        return (
          <li key={child.studentId} className="reveal" style={revealStyle(index + 1)}>
            <form action={selectChildAction} className="h-full">
              <input type="hidden" name="studentId" value={child.studentId} />
              <button
                type="submit"
                aria-pressed={selected}
                className={cx(
                  "card card-interactive t-green flex h-full w-full items-center gap-3 text-left",
                  selected && "border-green bg-green-l",
                )}
              >
                <Avatar
                  initials={`${child.firstName[0] ?? ""}${child.lastName[0] ?? ""}`}
                  tone="green"
                  size="lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 leading-snug font-extrabold text-navy">
                    {child.firstName} {child.lastName}
                  </span>
                  <span className="block text-sm font-semibold text-muted">
                    {child.groupName ? `${child.gradeName} · ${child.groupName}` : "Sin matrícula activa"}
                    {" · "}
                    {GUARDIAN_RELATIONSHIP_LABELS[child.relationship]}
                  </span>
                  {child.levelCode && (
                    <Chip tone={child.levelCode === "BACHILLERATO" ? "blue" : "orange"} className="mt-1.5">
                      {LEVEL_LABELS[child.levelCode]}
                    </Chip>
                  )}
                </span>
                {selected && (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-solid text-white">
                    <Check className="size-5" aria-hidden />
                    <span className="sr-only">Seleccionado</span>
                  </span>
                )}
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
