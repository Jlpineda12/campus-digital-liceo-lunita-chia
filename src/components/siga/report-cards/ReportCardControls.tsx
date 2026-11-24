"use client";

import { CheckCircle2, EyeOff, FileCheck2, Lock, MessageSquarePlus, Printer, Save, ShieldCheck } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  hideGroupReportCardsAction,
  issueGroupReportCardsAction,
  saveDirectorObservationAction,
  type ReportCardActionState,
} from "@/modules/siga/report-cards/actions";

const INITIAL: ReportCardActionState = { status: "idle" };

/** Abre el diálogo de impresión del navegador para guardar el boletín oficial en PDF. */
export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={pillButtonClass({ variant: "navy", size: "sm" })}
    >
      <Printer aria-hidden /> Imprimir / Guardar PDF
    </button>
  );
}

/** Control de habilitación / ocultamiento de boletines para Rectoría y Secretaría (`ADMIN`). */
export function IssueGroupReportCardsForm({
  groupId,
  groupName,
  periodId,
  periodName,
  issuedCount,
  totalCount,
}: {
  groupId: string;
  groupName: string;
  periodId: string;
  periodName: string;
  issuedCount: number;
  totalCount: number;
}) {
  const [issueState, issueAction, issuePending] = useActionState(issueGroupReportCardsAction, INITIAL);
  const [hideState, hideAction, hidePending] = useActionState(hideGroupReportCardsAction, INITIAL);
  const busy = issuePending || hidePending;
  const hasIssued = issuedCount > 0;
  const allIssued = totalCount > 0 && issuedCount === totalCount;

  const feedback =
    hideState.status !== "idle" && issueState.status === "idle"
      ? hideState
      : issueState.status !== "idle"
        ? issueState
        : hideState;

  return (
    <div className="grid gap-3 rounded-card border border-line-2 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-navy uppercase">
            <ShieldCheck className="size-4 text-cobalt" aria-hidden />
            Control de publicación · Rectoría
          </span>
          {allIssued ? (
            <Chip tone="green">
              <CheckCircle2 aria-hidden />
              <span>
                Visible para estudiantes y padres ({issuedCount}/{totalCount})
              </span>
            </Chip>
          ) : hasIssued ? (
            <Chip tone="orange">
              <CheckCircle2 aria-hidden />
              <span>
                Habilitado parcialmente ({issuedCount}/{totalCount})
              </span>
            </Chip>
          ) : (
            <Chip tone="sky">
              <Lock aria-hidden />
              <span>Oculto para estudiantes y padres</span>
            </Chip>
          )}
        </div>
        <p className="text-xs text-muted">
          Solo Rectoría habilita la consulta de boletines para las familias.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={issueAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="periodId" value={periodId} />
          <button type="submit" disabled={busy} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <FileCheck2 aria-hidden />
            {issuePending
              ? "Habilitando boletines…"
              : hasIssued
                ? `Actualizar y re-habilitar ${groupName} (${periodName})`
                : `Habilitar boletines de ${groupName} (${periodName})`}
          </button>
        </form>

        {hasIssued && (
          <form action={hideAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="periodId" value={periodId} />
            <button
              type="submit"
              disabled={busy}
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              <EyeOff aria-hidden />
              {hidePending ? "Ocultando…" : "Ocultar a estudiantes y padres"}
            </button>
          </form>
        )}
      </div>

      {feedback.status === "success" && feedback.message && (
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-solid">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {feedback.message}
        </p>
      )}
      {feedback.status === "error" && feedback.message && (
        <p role="alert" className="text-sm font-semibold text-red-solid">
          {feedback.message}
        </p>
      )}
    </div>
  );
}

/** Editor inline de observación del Director(a) de Grupo para el boletín de un estudiante. */
export function DirectorObservationForm({
  enrollmentId,
  periodId,
  studentName,
  initialValue,
}: {
  enrollmentId: string;
  periodId: string;
  studentName: string;
  initialValue: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveDirectorObservationAction, INITIAL);
  const fieldId = useId();

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={pillButtonClass({ variant: "outline", size: "sm" })}
        >
          <MessageSquarePlus aria-hidden />
          {initialValue ? "Editar observación" : "Agregar observación"}
        </button>
        {state.status === "success" && state.message && (
          <span role="status" className="text-xs font-semibold text-green-solid">
            {state.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-2.5 rounded-control border border-line-2 bg-cloud/70 p-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="periodId" value={periodId} />
      <div>
        <label htmlFor={fieldId} className="field-label">
          Observación del director de grupo · {studentName}
        </label>
        <textarea
          id={fieldId}
          name="observation"
          rows={3}
          required
          minLength={5}
          maxLength={800}
          defaultValue={initialValue ?? ""}
          placeholder="Destaca fortalezas, acompañamiento familiar o recomendaciones para el siguiente periodo…"
          className="input min-h-20 resize-y py-2 text-sm font-medium"
        />
      </div>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-xs font-semibold text-red-solid">
          {state.message}
        </p>
      )}
      {state.status === "success" && state.message && (
        <p role="status" className="text-xs font-semibold text-green-solid">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
          <Save aria-hidden /> {pending ? "Guardando…" : "Guardar observación"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={pillButtonClass({ variant: "outline", size: "sm" })}
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
