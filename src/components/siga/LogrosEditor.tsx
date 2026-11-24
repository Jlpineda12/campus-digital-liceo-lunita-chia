"use client";

import { AlertCircle, Check, Copy, Loader2, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { StheamiBadge } from "@/components/ui/StheamiBadge";
import type { StheamiPillar } from "@/modules/core/academic-structure/stheami";
import { saveCourseLogrosAction } from "@/modules/siga/siee-grades/actions";
import { DIMENSION_HINTS, DIMENSION_LABELS, type SieeDimension } from "@/modules/siga/siee-grades/calculator";
import { getSuggestedLogro, MAX_LOGRO_LENGTH, parseLogroLines } from "@/modules/siga/siee-grades/logros";
import type { CopyableLogroSource } from "@/modules/siga/siee-grades/queries";

export interface LogrosEditorProps {
  courseAssignmentId: string;
  periodId: string;
  periodName: string;
  subjectName: string;
  groupName: string;
  pillar: StheamiPillar;
  editable: boolean;
  dimensions: Array<{
    competencyId: string;
    dimension: SieeDimension;
    description: string;
    weightPercent: number;
  }>;
  copySources: CopyableLogroSource[];
}

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/**
 * Editor rápido y limpio de logros por asignatura y periodo.
 * Permite redactar uno o varios logros (uno por línea), insertar sugerencias
 * STHEAMI en 1 clic, copiar desde otro grupo/periodo y previsualizar el boletín.
 */
export function LogrosEditor({
  courseAssignmentId,
  periodId,
  periodName,
  subjectName,
  groupName,
  pillar,
  editable,
  dimensions,
  copySources,
}: LogrosEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(dimensions.map((d) => [d.competencyId, d.description])),
  );
  const [savedValues, setSavedValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(dimensions.map((d) => [d.competencyId, d.description])),
  );
  const [selectedSource, setSelectedSource] = useState(copySources[0]?.key ?? "");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: Date }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const hasChanges = dimensions.some((d) => (values[d.competencyId] ?? "").trim() !== (savedValues[d.competencyId] ?? "").trim());

  function updateField(competencyId: string, next: string) {
    setValues((prev) => ({ ...prev, [competencyId]: next }));
    if (status.kind === "saved" || status.kind === "error") setStatus({ kind: "idle" });
  }

  function applySuggestion(competencyId: string, dimension: SieeDimension) {
    const suggestion = getSuggestedLogro(pillar, dimension);
    setValues((prev) => {
      const current = (prev[competencyId] ?? "").trim();
      const combined = current ? `${current}\n${suggestion}` : suggestion;
      return { ...prev, [competencyId]: combined.slice(0, MAX_LOGRO_LENGTH) };
    });
    if (status.kind === "saved" || status.kind === "error") setStatus({ kind: "idle" });
  }

  function applyCopySource() {
    const source = copySources.find((s) => s.key === selectedSource);
    if (!source) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const d of dimensions) {
        const copied = source.byDimension[d.dimension];
        if (copied) next[d.competencyId] = copied;
      }
      return next;
    });
    setStatus({ kind: "idle" });
  }

  async function handleSave() {
    setStatus({ kind: "saving" });
    const result = await saveCourseLogrosAction({
      courseAssignmentId,
      periodId,
      entries: dimensions.map((d) => ({
        competencyId: d.competencyId,
        description: (values[d.competencyId] ?? "").trim(),
      })),
    });
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    const normalized = Object.fromEntries(dimensions.map((d) => [d.competencyId, (values[d.competencyId] ?? "").trim()]));
    setValues(normalized);
    setSavedValues(normalized);
    setStatus({ kind: "saved", at: new Date(result.savedAt) });
  }

  const filledCount = dimensions.filter((d) => parseLogroLines(values[d.competencyId]).length > 0).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr] lg:items-start">
      {/* Columna principal: edición por dimensión */}
      <div className="grid gap-4">
        {/* Barra superior de acciones rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3">
          <div className="text-sm">
            <p className="font-bold text-navy">
              Logros de {subjectName} · {periodName}
            </p>
            <p className="text-xs text-muted">
              {filledCount} de {dimensions.length} dimensiones diligenciadas · Usa un renglón por cada logro.
            </p>
          </div>

          {editable && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={status.kind === "saving" || !hasChanges}
              className={pillButtonClass({ variant: "navy", size: "sm" })}
            >
              {status.kind === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {status.kind === "saving" ? "Guardando…" : "Guardar logros"}
            </button>
          )}
        </div>

        {/* Estado de guardado */}
        {status.kind === "saved" && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-control border border-green/40 bg-green-l/70 px-3.5 py-2.5 text-sm font-semibold text-green-solid"
          >
            <Check className="size-4 shrink-0" aria-hidden />
            Logros guardados a las {timeFormat.format(status.at)}. Se reflejarán automáticamente en el boletín oficial.
          </p>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-control border border-red/40 bg-red-l/70 px-3.5 py-2.5 text-sm font-semibold text-red-solid"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {status.message}
          </p>
        )}

        {/* Atajo 1 clic: copiar desde otro grupo o periodo */}
        {editable && copySources.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-cloud/70 px-4 py-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="copy-logros-source" className="block text-xs font-bold text-navy">
                Ahorra tiempo copiando logros ya redactados
              </label>
              <select
                id="copy-logros-source"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="mt-1 w-full rounded-control border border-line-2 bg-white px-2.5 py-1.5 text-sm font-medium text-navy"
              >
                {copySources.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={applyCopySource}
              className={pillButtonClass({ variant: "outline", size: "sm" })}
            >
              <Copy aria-hidden /> Copiar aquí
            </button>
          </div>
        )}

        {/* Tarjetas limpias por dimensión */}
        <div className="grid gap-4">
          {dimensions.map((d) => {
            const text = values[d.competencyId] ?? "";
            const remaining = MAX_LOGRO_LENGTH - text.length;
            const fieldId = `logro-${d.competencyId}`;
            return (
              <section key={d.competencyId} className="rounded-card border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label htmlFor={fieldId} className="text-sm font-extrabold text-navy">
                      {DIMENSION_LABELS[d.dimension]}
                      {d.dimension !== "QUALITATIVE" && (
                        <span className="ml-2 text-xs font-semibold text-muted tabular">({d.weightPercent}%)</span>
                      )}
                    </label>
                    <p className="text-xs text-muted">{DIMENSION_HINTS[d.dimension]}</p>
                  </div>

                  {editable && (
                    <button
                      type="button"
                      onClick={() => applySuggestion(d.competencyId, d.dimension)}
                      className="inline-flex items-center gap-1.5 rounded-control border border-line-2 bg-cloud px-2.5 py-1 text-xs font-semibold text-navy transition-colors hover:border-sky-solid hover:bg-sky-l/50"
                    >
                      <Sparkles className="size-3.5 text-cobalt" aria-hidden />
                      Sugerencia STHEAMI
                    </button>
                  )}
                </div>

                <textarea
                  id={fieldId}
                  rows={3}
                  disabled={!editable}
                  maxLength={MAX_LOGRO_LENGTH}
                  value={text}
                  onChange={(e) => updateField(d.competencyId, e.target.value)}
                  placeholder="Escribe uno o varios logros (un logro por línea)…"
                  className="input mt-3 min-h-24 resize-y py-2.5 text-sm leading-relaxed font-normal"
                />

                <div className="mt-1.5 flex items-center justify-between text-xs text-muted tabular">
                  <span>{parseLogroLines(text).length} logro(s) detectado(s)</span>
                  <span>{remaining} caracteres disponibles</span>
                </div>
              </section>
            );
          })}
        </div>

        {editable && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={status.kind === "saving" || !hasChanges}
              className={pillButtonClass({ variant: "navy" })}
            >
              {status.kind === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {status.kind === "saving" ? "Guardando logros…" : "Guardar logros del periodo"}
            </button>
          </div>
        )}
      </div>

      {/* Columna derecha: vista previa limpia de cómo aparecerá en el boletín */}
      <aside aria-label="Vista previa en el boletín" className="sticky top-20 rounded-card border border-line bg-white p-5">
        <p className="text-[0.7rem] font-extrabold tracking-wider text-sky-solid uppercase">
          Así se verá en el boletín
        </p>
        <div className="mt-3 flex items-center gap-2.5 border-b border-line pb-3">
          <StheamiBadge pillar={pillar} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-bold text-navy">{subjectName}</p>
            <p className="text-xs text-muted">
              {groupName} · {periodName}
            </p>
          </div>
        </div>

        <div className="mt-3.5 grid gap-3">
          {dimensions.map((d) => {
            const lines = parseLogroLines(values[d.competencyId]);
            return (
              <div key={d.competencyId}>
                <p className="text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
                  {DIMENSION_LABELS[d.dimension]}
                </p>
                {lines.length === 0 ? (
                  <p className="mt-1 text-xs italic text-muted">Sin logro redactado aún.</p>
                ) : (
                  <ul className="mt-1 grid gap-1 text-xs leading-relaxed text-ink-2">
                    {lines.map((line, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cobalt/70" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
