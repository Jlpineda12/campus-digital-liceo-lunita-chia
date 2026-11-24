"use client";

import { Check, FilePlus2, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  reviewExcuseAction,
  submitExcuseAction,
  type ExcuseFormState,
} from "@/modules/siga/attendance/actions";
import { EXCUSE_REASON_LABELS, EXCUSE_REASON_TYPES } from "@/modules/siga/attendance/meta";

const INITIAL: ExcuseFormState = { status: "idle" };

/** Formulario de radicación de excusa para Padres / Acudientes. */
export function GuardianExcuseForm({
  enrollmentId,
  studentName,
  today,
}: {
  enrollmentId: string;
  studentName: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setFormKey((k) => k + 1);
            setOpen(true);
          }}
          className={pillButtonClass({ variant: "green", size: "sm" })}
        >
          <FilePlus2 aria-hidden /> Radicar excusa para {studentName}
        </button>
      </div>
    );
  }

  return (
    <GuardianExcusePanel
      key={formKey}
      enrollmentId={enrollmentId}
      studentName={studentName}
      today={today}
      onClose={() => setOpen(false)}
    />
  );
}

function GuardianExcusePanel({
  enrollmentId,
  studentName,
  today,
  onClose,
}: {
  enrollmentId: string;
  studentName: string;
  today: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(submitExcuseAction, INITIAL);
  const ids = { from: useId(), to: useId(), reason: useId(), desc: useId() };

  if (state.status === "success") {
    return (
      <div role="status" className="card flex flex-wrap items-center justify-between gap-3 border-green-solid/40 bg-green-l/50">
        <p className="font-semibold text-navy">{state.message}</p>
        <button type="button" onClick={onClose} className={pillButtonClass({ variant: "outline", size: "sm" })}>
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="radicar-excusa" className="card grid gap-4">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 id="radicar-excusa" className="text-lg">
            Radicar excusa · {studentName}
          </h2>
          <p className="text-sm text-muted">
            Cuando Coordinación la apruebe, las fallas en esas fechas se marcarán automáticamente como justificadas.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-control text-muted hover:bg-cloud hover:text-navy"
          aria-label="Cerrar formulario"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.from} className="field-label">
              Desde
            </label>
            <input
              id={ids.from}
              name="fromDate"
              type="date"
              required
              defaultValue={today}
              className="input min-h-11 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label htmlFor={ids.to} className="field-label">
              Hasta
            </label>
            <input
              id={ids.to}
              name="toDate"
              type="date"
              required
              defaultValue={today}
              className="input min-h-11 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label htmlFor={ids.reason} className="field-label">
              Motivo
            </label>
            <select
              id={ids.reason}
              name="reasonType"
              defaultValue="MEDICA"
              className="input min-h-11 py-2 text-sm font-semibold"
            >
              {EXCUSE_REASON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXCUSE_REASON_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={ids.desc} className="field-label">
            Detalle de la excusa
          </label>
          <textarea
            id={ids.desc}
            name="description"
            rows={3}
            required
            minLength={10}
            maxLength={800}
            placeholder="Indica el motivo de la inasistencia y cualquier información útil para Coordinación y docentes…"
            className="input min-h-24 resize-y py-2.5 text-sm font-medium"
          />
        </div>

        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-3 py-2 text-sm font-semibold text-navy">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "green", size: "sm" })}>
            <FilePlus2 aria-hidden />
            {pending ? "Radicando…" : "Enviar excusa"}
          </button>
          <button type="button" onClick={onClose} className={pillButtonClass({ variant: "outline", size: "sm" })}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

/** Botones de aprobación o rechazo con motivo para Coordinación y Secretaría. */
export function ExcuseReviewControls({ excuseId }: { excuseId: string }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [state, action, pending] = useActionState(reviewExcuseAction, INITIAL);
  const notesId = useId();

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-control border border-green-solid/30 bg-green-l px-3 py-2 text-sm font-semibold text-navy">
        {state.message}
      </p>
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <form action={action}>
          <input type="hidden" name="excuseId" value={excuseId} />
          <input type="hidden" name="decision" value="APPROVED" />
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "green", size: "sm" })}>
            <Check aria-hidden /> Aprobar excusa
          </button>
        </form>
        <button
          type="button"
          onClick={() => setRejectOpen((v) => !v)}
          className={pillButtonClass({ variant: "outline", size: "sm" })}
        >
          <X aria-hidden /> {rejectOpen ? "Cancelar rechazo" : "Rechazar"}
        </button>
      </div>

      {rejectOpen && (
        <form action={action} className="grid gap-2.5 rounded-control border border-red-solid/30 bg-red-l/40 p-3">
          <input type="hidden" name="excuseId" value={excuseId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <div>
            <label htmlFor={notesId} className="field-label">
              Motivo del rechazo (visible para el acudiente)
            </label>
            <input
              id={notesId}
              name="reviewNotes"
              type="text"
              required
              minLength={5}
              maxLength={400}
              placeholder="Ej. Falta adjuntar certificado médico de la EPS."
              className="input min-h-10 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <button type="submit" disabled={pending} className={pillButtonClass({ variant: "red", size: "sm" })}>
              {pending ? "Procesando…" : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-3 py-2 text-sm font-semibold text-navy">
          {state.message}
        </p>
      )}
    </div>
  );
}
