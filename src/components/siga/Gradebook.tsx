"use client";

import { AlertCircle, Check, Link2, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PerformanceBadge } from "@/components/ui/PerformanceBadge";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  computeStudentPeriod,
  DIMENSION_LABELS,
  formatScore,
  isQualitativeLevel,
  parseScoreInput,
  QUALITATIVE_LABELS,
  QUALITATIVE_LEVELS,
  type QualitativeLevel,
  type SieeDimension,
} from "@/modules/siga/siee-grades/calculator";
import { saveGradesAction } from "@/modules/siga/siee-grades/actions";
import type { SieeScale } from "@/modules/siga/siee-grades/scale";

export interface GradebookProps {
  courseAssignmentId: string;
  periodId: string;
  editable: boolean;
  scale: SieeScale;
  dimensions: Array<{
    competencyId: string;
    dimension: SieeDimension;
    weightPercent: number;
    columns: Array<{ id: string; title: string; weightPercent: number; linked: boolean }>;
  }>;
  students: Array<{ enrollmentId: string; firstName: string; lastName: string }>;
  scores: Record<string, number>;
  qualitative: Record<string, string>;
}

type CellValue = number | QualitativeLevel | null;
type SaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

const AUTOSAVE_MS = 1200;
const key = (columnId: string, enrollmentId: string) => `${columnId}:${enrollmentId}`;

function omit<T>(record: Record<string, T>, k: string): Record<string, T> {
  if (!(k in record)) return record;
  const next = { ...record };
  delete next[k];
  return next;
}
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/**
 * Planilla SIEE tipo hoja de cálculo (docs/secciones/04 §2):
 * Enter/↓ bajan de fila, ↑ sube, ←/→ cambian de columna en los bordes del texto,
 * Esc deshace la celda. Autoguardado por lotes con indicador de estado.
 */
export function Gradebook(props: GradebookProps) {
  const { dimensions, students, editable, scale, courseAssignmentId, periodId } = props;
  const columns = useMemo(
    () => dimensions.flatMap((d) => d.columns.map((c) => ({ ...c, dimension: d.dimension }))),
    [dimensions],
  );
  const numericDims = dimensions.filter((d) => d.dimension !== "QUALITATIVE");

  const initial = useMemo(() => {
    const map: Record<string, CellValue> = {};
    for (const [k, v] of Object.entries(props.scores)) map[k] = v;
    for (const [k, v] of Object.entries(props.qualitative)) if (isQualitativeLevel(v)) map[k] = v;
    return map;
  }, [props.scores, props.qualitative]);

  const [saved, setSaved] = useState<Record<string, CellValue>>(initial);
  const [dirty, setDirty] = useState<Record<string, CellValue>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLSelectElement>());

  // Si el servidor trae datos nuevos (columna creada, otro periodo), se adoptan
  // sin perder lo que el docente aún no ha guardado (estado derivado de props).
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setSaved(initial);
  }

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const currentValue = (k: string): CellValue => (k in dirty ? (dirty[k] ?? null) : (saved[k] ?? null));

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (savingRef.current) return;
    const batch = Object.entries(dirtyRef.current);
    if (batch.length === 0) return;
    savingRef.current = true;
    setStatus({ kind: "saving" });
    try {
      const result = await saveGradesAction({
        courseAssignmentId,
        periodId,
        changes: batch.map(([k, value]) => {
          const [columnId, enrollmentId] = k.split(":") as [string, string];
          return { columnId, enrollmentId, value };
        }),
      });
      if (!result.ok) {
        setStatus({ kind: "error", message: result.message });
        return;
      }
      setSaved((prev) => {
        const next = { ...prev };
        for (const [k, value] of batch) {
          if (value === null) delete next[k];
          else next[k] = value;
        }
        return next;
      });
      // Solo se limpian las celdas que no cambiaron mientras se guardaba.
      setDirty((prev) => {
        let next = prev;
        for (const [k, value] of batch) if (prev[k] === value) next = omit(next, k);
        return next;
      });
      setStatus({ kind: "saved", at: new Date(result.savedAt) });
    } finally {
      savingRef.current = false;
    }
  }, [courseAssignmentId, periodId]);

  const schedule = useCallback(() => {
    setStatus({ kind: "pending" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  // Avisa si se intenta salir con cambios sin guardar.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(dirtyRef.current).length > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function setCell(k: string, value: CellValue) {
    const nextDirty = (saved[k] ?? null) === value ? omit(dirtyRef.current, k) : { ...dirtyRef.current, [k]: value };
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
    if (Object.keys(nextDirty).length === 0) {
      if (timer.current) clearTimeout(timer.current);
      setStatus({ kind: "idle" });
    } else {
      schedule();
    }
  }

  function onTextChange(k: string, text: string) {
    setDrafts((d) => ({ ...d, [k]: text }));
    const parsed = parseScoreInput(text);
    if (!parsed.ok) {
      setErrors((e) => ({ ...e, [k]: parsed.error }));
      setDirty((prev) => omit(prev, k));
      return;
    }
    setErrors((e) => omit(e, k));
    setCell(k, parsed.value);
  }

  function focusCell(row: number, col: number) {
    const el = inputs.current.get(`${row}:${col}`);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, row: number, col: number, k: string) {
    const el = event.currentTarget;
    const atStart = el instanceof HTMLInputElement ? el.selectionStart === 0 && el.selectionEnd === 0 : true;
    const atEnd = el instanceof HTMLInputElement ? el.selectionStart === el.value.length : true;
    if (event.key === "Enter" || (event.key === "ArrowDown" && !(el instanceof HTMLSelectElement))) {
      event.preventDefault();
      focusCell(event.shiftKey ? row - 1 : row + 1, col);
    } else if (event.key === "ArrowUp" && !(el instanceof HTMLSelectElement)) {
      event.preventDefault();
      focusCell(row - 1, col);
    } else if (event.key === "ArrowRight" && atEnd) {
      event.preventDefault();
      focusCell(row, col + 1);
    } else if (event.key === "ArrowLeft" && atStart) {
      event.preventDefault();
      focusCell(row, col - 1);
    } else if (event.key === "Escape") {
      setDrafts((d) => omit(d, k));
      setErrors((e) => omit(e, k));
      setDirty((prev) => omit(prev, k));
    }
  }

  const statusView = (() => {
    switch (status.kind) {
      case "saving":
        return (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Guardando…
          </>
        );
      case "pending":
        return <>Cambios sin guardar</>;
      case "saved":
        return (
          <>
            <Check className="size-4 text-green-solid" aria-hidden /> Guardado a las {timeFormat.format(status.at)}
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="size-4 text-red-solid" aria-hidden /> {status.message}
          </>
        );
      default:
        return editable ? <>Los cambios se guardan solos</> : <>Solo lectura</>;
    }
  })();

  if (students.length === 0) {
    return <div className="card text-center text-muted">Este grupo no tiene estudiantes con matrícula activa.</div>;
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted" aria-live="polite">
          {statusView}
        </p>
        {editable && (
          <button
            type="button"
            onClick={() => void flush()}
            disabled={status.kind === "saving"}
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            <Save aria-hidden /> Guardar todo
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="gradebook">
          <caption className="sr-only">Planilla de calificaciones del periodo</caption>
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className="gradebook__sticky gradebook__student">
                Estudiante
              </th>
              {dimensions.map((d) => (
                <th
                  key={d.competencyId}
                  scope="colgroup"
                  colSpan={Math.max(d.columns.length, 1)}
                  className="gradebook__dim"
                >
                  {DIMENSION_LABELS[d.dimension]}
                  {d.dimension !== "QUALITATIVE" && <span className="gradebook__weight">{d.weightPercent}%</span>}
                </th>
              ))}
              {numericDims.length > 0 && (
                <th scope="colgroup" colSpan={numericDims.length + 1} className="gradebook__dim gradebook__result">
                  Resultado del periodo
                </th>
              )}
            </tr>
            <tr>
              {dimensions.map((d) =>
                d.columns.length === 0 ? (
                  <th key={`${d.competencyId}-empty`} scope="col" className="gradebook__col text-muted">
                    Sin columnas
                  </th>
                ) : (
                  d.columns.map((c) => (
                    <th key={c.id} scope="col" className="gradebook__col" title={c.title}>
                      <span className="block truncate">
                        {c.linked && <Link2 className="mr-1 inline size-3.5 text-sky-solid" aria-label="Aula Virtual" />}
                        {c.title}
                      </span>
                      <span className="gradebook__weight">{c.weightPercent}%</span>
                    </th>
                  ))
                ),
              )}
              {numericDims.map((d) => (
                <th key={`avg-${d.competencyId}`} scope="col" className="gradebook__col gradebook__result">
                  {DIMENSION_LABELS[d.dimension]}
                </th>
              ))}
              {numericDims.length > 0 && (
                <th scope="col" className="gradebook__col gradebook__result">
                  Definitiva
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student, row) => {
              const result = computeStudentPeriod(
                numericDims,
                (columnId) => {
                  const v = currentValue(key(columnId, student.enrollmentId));
                  return typeof v === "number" ? v : null;
                },
                scale,
              );
              return (
                <tr key={student.enrollmentId}>
                  <th scope="row" className="gradebook__sticky gradebook__student">
                    <span className="block truncate font-semibold text-navy">
                      {student.lastName}, {student.firstName}
                    </span>
                  </th>
                  {dimensions.map((d) =>
                    d.columns.length === 0 ? (
                      <td key={`${d.competencyId}-empty`} className="gradebook__cell text-muted" aria-hidden>
                        ·
                      </td>
                    ) : (
                      d.columns.map((c) => {
                        const col = columns.findIndex((x) => x.id === c.id);
                        const k = key(c.id, student.enrollmentId);
                        const value = currentValue(k);
                        const label = `${c.title}, ${student.firstName} ${student.lastName}`;
                        if (!editable) {
                          return (
                            <td key={c.id} className="gradebook__cell tabular">
                              {typeof value === "string" ? QUALITATIVE_LABELS[value] : formatScore(value)}
                            </td>
                          );
                        }
                        if (d.dimension === "QUALITATIVE") {
                          return (
                            <td key={c.id} className="gradebook__cell">
                              <select
                                ref={(el) => {
                                  if (el) inputs.current.set(`${row}:${col}`, el);
                                }}
                                aria-label={label}
                                value={typeof value === "string" ? value : ""}
                                onChange={(e) =>
                                  setCell(k, isQualitativeLevel(e.target.value) ? e.target.value : null)
                                }
                                onKeyDown={(e) => onKeyDown(e, row, col, k)}
                                className="gradebook__input gradebook__select"
                              >
                                <option value="">—</option>
                                {QUALITATIVE_LEVELS.map((level) => (
                                  <option key={level} value={level}>
                                    {QUALITATIVE_LABELS[level]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        }
                        const error = errors[k];
                        return (
                          <td key={c.id} className="gradebook__cell">
                            <input
                              ref={(el) => {
                                if (el) inputs.current.set(`${row}:${col}`, el);
                              }}
                              aria-label={label}
                              inputMode="decimal"
                              autoComplete="off"
                              value={drafts[k] ?? (typeof value === "number" ? value.toFixed(1) : "")}
                              onChange={(e) => onTextChange(k, e.target.value)}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => {
                                if (!errors[k]) setDrafts((d) => omit(d, k));
                              }}
                              onKeyDown={(e) => onKeyDown(e, row, col, k)}
                              aria-invalid={error ? true : undefined}
                              title={error}
                              className={cx(
                                "gradebook__input tabular",
                                k in dirty && "gradebook__input--dirty",
                              )}
                            />
                          </td>
                        );
                      })
                    ),
                  )}
                  {numericDims.map((d) => (
                    <td key={`avg-${d.competencyId}`} className="gradebook__cell gradebook__result tabular">
                      {formatScore(result.byDimension[d.competencyId])}
                    </td>
                  ))}
                  {numericDims.length > 0 && (
                    <td className="gradebook__cell gradebook__result">
                      {result.final === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <PerformanceBadge score={result.final} scale={scale} />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="border-t border-line bg-red-l px-4 py-2 text-sm font-semibold text-navy">
          Hay celdas con notas inválidas (en rojo). Usa valores entre 1.0 y 5.0 con un decimal.
        </p>
      )}
    </div>
  );
}
