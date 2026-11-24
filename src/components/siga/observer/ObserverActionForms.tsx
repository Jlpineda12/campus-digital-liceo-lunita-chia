"use client";

import { CheckCircle2, MessageSquareText } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  acknowledgeObserverAction,
  submitStudentStatementAction,
  type ObserverActionState,
} from "@/modules/siga/observer/actions";

const INITIAL: ObserverActionState = { status: "idle" };

/** Formulario de descargos del estudiante (se registra una sola vez por anotación). */
export function StudentStatementForm({
  recordId,
  hasCommitment,
}: {
  recordId: string;
  hasCommitment: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitStudentStatementAction, INITIAL);
  const statementId = useId();
  const commitmentId = useId();

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-control border border-green-solid/30 bg-green-l px-3 py-2 text-sm font-semibold text-navy">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={pillButtonClass({ variant: "sky", size: "sm" })}
        >
          <MessageSquareText aria-hidden /> Registrar mis descargos
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 rounded-control border border-line-2 bg-cloud/70 p-4">
      <input type="hidden" name="recordId" value={recordId} />
      <div>
        <label htmlFor={statementId} className="field-label">
          Tu versión / descargos
        </label>
        <textarea
          id={statementId}
          name="statement"
          rows={3}
          required
          minLength={5}
          maxLength={1000}
          placeholder="Explica lo sucedido desde tu punto de vista y cómo puedes mejorar…"
          className="input min-h-24 resize-y py-2.5 text-sm font-medium"
        />
      </div>

      {!hasCommitment && (
        <div>
          <label htmlFor={commitmentId} className="field-label">
            Compromiso personal (opcional)
          </label>
          <input
            id={commitmentId}
            name="commitment"
            type="text"
            maxLength={600}
            placeholder="Ej. Entregar los talleres pendientes el viernes."
            className="input min-h-11 py-2 text-sm font-medium"
          />
        </div>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-3 py-2 text-sm font-semibold text-navy">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={pillButtonClass({ variant: "sky", size: "sm" })}>
          <MessageSquareText aria-hidden />
          {pending ? "Guardando…" : "Guardar descargos"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={pillButtonClass({ variant: "outline", size: "sm" })}
        >
          Cancelar
        </button>
        <span className="text-xs text-muted">Tus descargos quedan guardados de forma permanente.</span>
      </div>
    </form>
  );
}

/** Confirmación de lectura ("Enterado") del acudiente con comentario familiar opcional. */
export function GuardianAcknowledgeForm({ recordId }: { recordId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(acknowledgeObserverAction, INITIAL);
  const commentId = useId();

  if (state.status === "success") {
    return (
      <p role="status" className="rounded-control border border-green-solid/30 bg-green-l px-3 py-2 text-sm font-semibold text-navy">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={pillButtonClass({ variant: "green", size: "sm" })}
        >
          <CheckCircle2 aria-hidden /> Confirmar lectura (Enterado)
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 rounded-control border border-green-solid/30 bg-green-l/40 p-4">
      <input type="hidden" name="recordId" value={recordId} />
      <div>
        <label htmlFor={commentId} className="field-label">
          Comentario o compromiso familiar (opcional)
        </label>
        <textarea
          id={commentId}
          name="comment"
          rows={2}
          maxLength={600}
          placeholder="Ej. Enterado, dialogaremos en casa para acompañar el compromiso."
          className="input min-h-20 resize-y py-2.5 text-sm font-medium"
        />
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-3 py-2 text-sm font-semibold text-navy">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={pillButtonClass({ variant: "green", size: "sm" })}>
          <CheckCircle2 aria-hidden />
          {pending ? "Confirmando…" : "Firmar Enterado"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={pillButtonClass({ variant: "outline", size: "sm" })}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
