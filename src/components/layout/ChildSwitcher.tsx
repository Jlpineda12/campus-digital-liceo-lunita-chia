"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { emitToast } from "@/components/ui/ToastViewport";
import { selectChildAction } from "@/modules/core/auth/actions";
import type { ShellChild } from "@/modules/core/dashboard/shell";

/** Selector de hijo para acudientes. El servidor revalida el vínculo en cada cambio. */
export function ChildSwitcher({
  options,
  selectedId,
}: {
  options: ShellChild[];
  selectedId: string | null;
}) {
  const id = useId();
  if (options.length === 0) return null;

  return (
    <form
      action={selectChildAction}
      className="flex min-w-0 items-center gap-2 rounded-control border border-green bg-green-l/90 py-1.5 pr-2 pl-3 transition-shadow focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-sky"
    >
      <label
        htmlFor={id}
        className="hidden text-[0.68rem] font-extrabold tracking-wide whitespace-nowrap text-green-solid uppercase sm:block"
      >
        Viendo a
      </label>
      <div className="relative min-w-0">
        <select
          id={id}
          name="studentId"
          key={selectedId}
          defaultValue={selectedId ?? undefined}
          aria-label="Estudiante que estás consultando"
          onChange={(event) => {
            const chosen = options.find((c) => c.studentId === event.currentTarget.value);
            if (chosen) {
              emitToast({
                title: `Cambiando a ${chosen.name}`,
                description: chosen.detail ? `Grupo ${chosen.detail}` : undefined,
                tone: "info",
              });
            }
            event.currentTarget.form?.requestSubmit();
          }}
          style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
          className="max-w-52 cursor-pointer truncate bg-transparent pr-6 text-sm font-extrabold text-navy outline-none"
        >
          {options.map((child) => (
            <option key={child.studentId} value={child.studentId}>
              {child.name}
              {child.detail ? ` · ${child.detail}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-green-solid"
          aria-hidden
        />
      </div>
      <noscript>
        <button type="submit" className="text-xs font-extrabold text-navy uppercase">
          Cambiar
        </button>
      </noscript>
    </form>
  );
}
