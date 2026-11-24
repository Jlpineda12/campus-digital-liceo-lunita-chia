"use client";

import { useId } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";

export interface CourseSelectGroup {
  label: string;
  options: Array<{ value: string; label: string }>;
}

/** Selector de carga académica (formulario GET: comparte enlace y funciona sin JS). */
export function CourseSelect({
  groups,
  selected,
  periodId,
}: {
  groups: CourseSelectGroup[];
  selected: string;
  periodId: string;
}) {
  const id = useId();
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="periodo" value={periodId} />
      <div className="min-w-0 flex-1 sm:flex-none">
        <label htmlFor={id} className="field-label">
          Curso
        </label>
        <select
          id={id}
          name="curso"
          defaultValue={selected}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="input min-h-11 w-full text-base font-semibold sm:w-80"
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <noscript>
        <button type="submit" className={pillButtonClass({ variant: "outline", size: "sm" })}>
          Ver
        </button>
      </noscript>
    </form>
  );
}
