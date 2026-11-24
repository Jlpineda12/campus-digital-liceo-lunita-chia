"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useId } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  openUnlockWindowAction,
  type UnlockFormState,
} from "@/modules/siga/siee-grades/period-actions";

export interface CourseOptionGroup {
  groupName: string;
  courses: Array<{ id: string; label: string }>;
}

const INITIAL: UnlockFormState = { status: "idle" };

/** Reapertura temporal de un periodo cerrado: motivo obligatorio, duración y alcance. */
export function UnlockWindowForm({
  periodId,
  periodName,
  courseGroups,
}: {
  periodId: string;
  periodName: string;
  courseGroups: CourseOptionGroup[];
}) {
  const [state, formAction, pending] = useActionState(openUnlockWindowAction, INITIAL);
  const id = useId();

  return (
    <details className="group rounded-control border border-line bg-cloud/50 open:bg-white">
      <summary className="cursor-pointer list-none rounded-control px-4 py-3 text-sm font-semibold text-navy hover:bg-cloud">
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-sky-solid" aria-hidden />
          Abrir ventana temporal de edición
        </span>
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-line p-4">
        <input type="hidden" name="periodId" value={periodId} />
        <div>
          <label htmlFor={`${id}-reason`} className="field-label">
            Motivo (queda en la auditoría)
          </label>
          <textarea
            id={`${id}-reason`}
            name="reason"
            rows={2}
            required
            minLength={10}
            maxLength={300}
            className="input min-h-0 resize-y text-base font-medium"
            placeholder={`Corrección de notas del ${periodName.toLowerCase()} solicitada por…`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-scope`} className="field-label">
              Alcance
            </label>
            <select id={`${id}-scope`} name="courseAssignmentId" className="input min-h-11 text-base font-medium">
              <option value="">Todas las cargas del periodo</option>
              {courseGroups.map((group) => (
                <optgroup key={group.groupName} label={group.groupName}>
                  {group.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-hours`} className="field-label">
              Duración
            </label>
            <select id={`${id}-hours`} name="hours" defaultValue="24" className="input min-h-11 text-base font-medium">
              {[2, 6, 24, 48, 72].map((h) => (
                <option key={h} value={h}>
                  {h} horas
                </option>
              ))}
            </select>
          </div>
        </div>
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "rounded-control border border-red bg-red-l px-3 py-2 text-sm font-semibold text-navy"
                : "rounded-control border border-green bg-green-l px-3 py-2 text-sm font-semibold text-navy"
            }
          >
            {state.message}
          </p>
        )}
        <div>
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            {pending ? "Abriendo…" : "Abrir ventana"}
          </button>
        </div>
      </form>
    </details>
  );
}
