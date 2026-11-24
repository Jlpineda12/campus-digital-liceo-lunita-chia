"use client";

import { AlertCircle, Check, CheckCheck, FileCheck2, Loader2, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { saveAttendanceRollAction } from "@/modules/siga/attendance/actions";
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/modules/siga/attendance/meta";
import type { RollCallStudent } from "@/modules/siga/attendance/queries";

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

const BUTTON_STYLES: Record<AttendanceStatus, { active: string; idle: string }> = {
  PRESENT: {
    active: "border-green-solid bg-green-solid text-white",
    idle: "border-line-2 bg-white text-navy hover:border-green-solid hover:bg-green-l/50",
  },
  ABSENT: {
    active: "border-red-solid bg-red-solid text-white",
    idle: "border-line-2 bg-white text-navy hover:border-red-solid hover:bg-red-l/50",
  },
  LATE: {
    active: "border-orange-solid bg-orange-solid text-white",
    idle: "border-line-2 bg-white text-navy hover:border-orange-solid hover:bg-orange-l/50",
  },
  EXCUSED: {
    active: "border-sky-solid bg-sky-solid text-white",
    idle: "border-line-2 bg-white text-navy hover:border-sky-solid hover:bg-sky-l/50",
  },
};

/**
 * Tablero interactivo de llamado a lista (< 30s en celular o escritorio).
 * Todos arrancan en Presente (o Excusa si ya fue aprobada por Coordinación)
 * para que el docente solo toque los casos excepcionales y guarde en 1 clic.
 */
export function RollCallBoard({
  courseAssignmentId,
  date,
  initialStudents,
  alreadySavedCount,
}: {
  courseAssignmentId: string;
  date: string;
  initialStudents: RollCallStudent[];
  alreadySavedCount: number;
}) {
  const [rows, setRows] = useState<RollCallStudent[]>(initialStudents);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "idle" | "saved" | "error"; text?: string }>({
    kind: "idle",
  });
  const inFlight = useRef(false);

  const counts = useMemo(
    () => ({
      PRESENT: rows.filter((r) => r.status === "PRESENT").length,
      ABSENT: rows.filter((r) => r.status === "ABSENT").length,
      LATE: rows.filter((r) => r.status === "LATE").length,
      EXCUSED: rows.filter((r) => r.status === "EXCUSED").length,
    }),
    [rows],
  );

  function setStatus(enrollmentId: string, status: AttendanceStatus) {
    setRows((prev) => prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, status } : r)));
    setFeedback({ kind: "idle" });
  }

  function setNote(enrollmentId: string, notes: string) {
    setRows((prev) => prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, notes } : r)));
  }

  function markAllPresent() {
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: r.hasApprovedExcuse ? "EXCUSED" : "PRESENT" })),
    );
    setFeedback({ kind: "idle" });
  }

  async function onSave() {
    if (inFlight.current || rows.length === 0) return;
    inFlight.current = true;
    setSaving(true);
    setFeedback({ kind: "idle" });
    try {
      const result = await saveAttendanceRollAction({
        courseAssignmentId,
        date,
        entries: rows.map((r) => ({
          enrollmentId: r.enrollmentId,
          status: r.status,
          notes: r.notes,
        })),
      });
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.message });
      } else {
        setFeedback({
          kind: "saved",
          text: `Lista guardada (${result.saved} estudiantes) a las ${timeFormat.format(new Date(result.savedAt))}.`,
        });
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card text-center text-muted">
        Este grupo no tiene estudiantes con matrícula activa.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg-2/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular">
          <span className="rounded-chip bg-green-l px-2.5 py-1 text-green-solid">
            P · Presentes: {counts.PRESENT}
          </span>
          <span className="rounded-chip bg-red-l px-2.5 py-1 text-red-solid">
            F · Fallas: {counts.ABSENT}
          </span>
          <span className="rounded-chip bg-orange-l px-2.5 py-1 text-orange-solid">
            R · Retardos: {counts.LATE}
          </span>
          <span className="rounded-chip bg-sky-l px-2.5 py-1 text-sky-solid">
            E · Excusas: {counts.EXCUSED}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={markAllPresent}
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            <CheckCheck aria-hidden /> Todos presentes
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className={pillButtonClass({ variant: "navy", size: "sm" })}
          >
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {saving ? "Guardando…" : alreadySavedCount > 0 ? "Actualizar lista" : "Guardar lista"}
          </button>
        </div>
      </div>

      {feedback.kind === "saved" && (
        <p role="status" className="flex items-center gap-2 border-b border-line bg-green-l/60 px-4 py-2.5 text-sm font-semibold text-navy">
          <Check className="size-4 text-green-solid" aria-hidden />
          {feedback.text}
        </p>
      )}
      {feedback.kind === "error" && (
        <p role="alert" className="flex items-center gap-2 border-b border-line bg-red-l px-4 py-2.5 text-sm font-semibold text-navy">
          <AlertCircle className="size-4 text-red-solid" aria-hidden />
          {feedback.text}
        </p>
      )}

      <ul className="divide-y divide-line" aria-label="Listado de estudiantes para asistencia">
        {rows.map((student, idx) => (
          <li
            key={student.enrollmentId}
            className="grid gap-3 px-4 py-3 transition-colors hover:bg-cloud/40 md:grid-cols-[minmax(0,1fr)_auto_13rem] md:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-navy">
                <span className="mr-2 text-xs font-bold text-muted tabular">{idx + 1}.</span>
                {student.lastName}, {student.firstName}
              </p>
              {student.hasApprovedExcuse && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-sky-solid">
                  <FileCheck2 className="size-3.5" aria-hidden /> Excusa aprobada por Coordinación para esta fecha
                </p>
              )}
            </div>

            <div
              role="group"
              aria-label={`Asistencia de ${student.firstName} ${student.lastName}`}
              className="grid grid-cols-4 gap-1.5"
            >
              {ATTENDANCE_STATUSES.map((st) => {
                const meta = ATTENDANCE_STATUS_META[st];
                const active = student.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatus(student.enrollmentId, st)}
                    className={cx(
                      "flex min-h-10 min-w-12 flex-col items-center justify-center rounded-control border px-2 py-1 text-xs font-bold transition-colors",
                      active ? BUTTON_STYLES[st].active : BUTTON_STYLES[st].idle,
                    )}
                    title={meta.label}
                  >
                    <span className="text-sm leading-none font-extrabold">{meta.code}</span>
                    <span className="mt-0.5 text-[0.65rem] leading-none opacity-90">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <input
                type="text"
                value={student.notes}
                onChange={(e) => setNote(student.enrollmentId, e.target.value)}
                maxLength={200}
                placeholder="Nota breve (opcional)…"
                aria-label={`Nota de asistencia para ${student.firstName} ${student.lastName}`}
                className="input min-h-10 py-1.5 text-xs font-medium"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
