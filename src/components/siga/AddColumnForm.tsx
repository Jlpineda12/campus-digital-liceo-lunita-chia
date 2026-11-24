"use client";

import { Plus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { createGradeColumnAction, type ColumnFormState } from "@/modules/siga/siee-grades/actions";
import { DIMENSION_HINTS, DIMENSION_LABELS, type SieeDimension } from "@/modules/siga/siee-grades/calculator";

const INITIAL: ColumnFormState = { status: "idle" };

/** Nueva columna manual de la planilla (exposición, quiz en clase, cuaderno…). */
export function AddColumnForm({
  courseAssignmentId,
  periodId,
  dimensions,
}: {
  courseAssignmentId: string;
  periodId: string;
  dimensions: Array<{ competencyId: string; dimension: SieeDimension; available: number }>;
}) {
  const [state, formAction, pending] = useActionState(createGradeColumnAction, INITIAL);
  const [selected, setSelected] = useState(dimensions[0]?.competencyId ?? "");
  const id = useId();
  const available = dimensions.find((d) => d.competencyId === selected)?.available ?? 0;

  return (
    <details className="card p-0" open={dimensions.every((d) => d.available === 100) || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-navy hover:bg-cloud/60">
        <Plus className="size-4 text-sky-solid" aria-hidden /> Nueva columna
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_1.4fr_8rem_auto] sm:items-end">
        <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
        <input type="hidden" name="periodId" value={periodId} />
        <div>
          <label htmlFor={`${id}-dim`} className="field-label">
            Dimensión
          </label>
          <select
            id={`${id}-dim`}
            name="competencyId"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input min-h-11 text-base font-medium"
          >
            {dimensions.map((d) => (
              <option key={d.competencyId} value={d.competencyId}>
                {DIMENSION_LABELS[d.dimension]} ({DIMENSION_HINTS[d.dimension]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-title`} className="field-label">
            Nombre
          </label>
          <input
            id={`${id}-title`}
            name="title"
            required
            maxLength={60}
            placeholder="Ej. Quiz de fracciones"
            className="input min-h-11 text-base font-medium"
          />
        </div>
        <div>
          <label htmlFor={`${id}-weight`} className="field-label">
            Peso %
          </label>
          <input
            id={`${id}-weight`}
            name="weightPercent"
            inputMode="decimal"
            required
            defaultValue={available > 0 ? Math.min(available, 50) : ""}
            aria-describedby={`${id}-hint`}
            className="input min-h-11 text-base font-medium tabular"
          />
        </div>
        <button type="submit" disabled={pending || available <= 0} className={pillButtonClass({ variant: "navy" })}>
          {pending ? "Creando…" : "Crear"}
        </button>
        <p id={`${id}-hint`} className="text-sm text-muted sm:col-span-4">
          Disponible en esta dimensión: <strong className="tabular">{available}%</strong>. Las columnas de cada
          dimensión suman 100 %.
        </p>
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`sm:col-span-4 rounded-control border px-3 py-2 text-sm font-semibold text-navy ${
              state.status === "error" ? "border-red bg-red-l" : "border-green bg-green-l"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
