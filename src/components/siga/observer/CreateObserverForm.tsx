"use client";

import { Plus, Users, X } from "lucide-react";
import { useActionState, useId, useMemo, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  createObserverRecordAction,
  type ObserverActionState,
} from "@/modules/siga/observer/actions";
import {
  OBSERVER_CATEGORIES,
  OBSERVER_CATEGORY_META,
  type ObserverCategory,
} from "@/modules/siga/observer/meta";
import type { ObserverCandidateGroup } from "@/modules/siga/observer/queries";

const INITIAL: ObserverActionState = { status: "idle" };

/**
 * Formulario de nueva anotación en el Observador (Docentes, Coordinación, Secretaría).
 * Permite elegir uno o varios estudiantes del grupo (ideal para felicitaciones grupales).
 */
export function CreateObserverForm({
  groups,
  periods,
  defaultPeriodId,
}: {
  groups: ObserverCandidateGroup[];
  periods: Array<{ id: string; name: string }>;
  defaultPeriodId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (groups.length === 0) return null;

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setFormKey((k) => k + 1);
            setOpen(true);
          }}
          className={pillButtonClass({ variant: "navy", size: "sm" })}
        >
          <Plus aria-hidden /> Nueva anotación
        </button>
      </div>
    );
  }

  return (
    <CreateObserverPanel
      key={formKey}
      groups={groups}
      periods={periods}
      defaultPeriodId={defaultPeriodId}
      onClose={() => setOpen(false)}
      onReset={() => setFormKey((k) => k + 1)}
    />
  );
}

function CreateObserverPanel({
  groups,
  periods,
  defaultPeriodId,
  onClose,
  onReset,
}: {
  groups: ObserverCandidateGroup[];
  periods: Array<{ id: string; name: string }>;
  defaultPeriodId?: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.groupId ?? "");
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
  const [category, setCategory] = useState<ObserverCategory>("PRAISE");
  const [state, action, pending] = useActionState(createObserverRecordAction, INITIAL);

  const ids = {
    group: useId(),
    period: useId(),
    category: useId(),
    title: useId(),
    description: useId(),
    commitment: useId(),
  };

  const activeGroup = useMemo(
    () => groups.find((g) => g.groupId === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId],
  );

  function onGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedEnrollments([]);
  }

  function toggleStudent(enrollmentId: string) {
    setSelectedEnrollments((prev) =>
      prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId],
    );
  }

  function toggleAllInGroup() {
    if (!activeGroup) return;
    const allIds = activeGroup.students.map((s) => s.enrollmentId);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedEnrollments.includes(id));
    setSelectedEnrollments(allSelected ? [] : allIds);
  }

  if (state.status === "success") {
    return (
      <section role="status" className="card flex flex-wrap items-center justify-between gap-3 border-green-solid/40 bg-green-l/50">
        <p className="font-semibold text-navy">{state.message}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onReset} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <Plus aria-hidden /> Registrar otra
          </button>
          <button type="button" onClick={onClose} className={pillButtonClass({ variant: "outline", size: "sm" })}>
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  const allSelected =
    Boolean(activeGroup && activeGroup.students.length > 0) &&
    activeGroup!.students.every((s) => selectedEnrollments.includes(s.enrollmentId));

  return (
    <section aria-labelledby="nueva-anotacion-titulo" className="card grid gap-4">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 id="nueva-anotacion-titulo" className="text-lg">
            Registrar nueva anotación
          </h2>
          <p className="text-sm text-muted">
            Las situaciones Tipo II y Tipo III alertan automáticamente a Coordinación.
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.group} className="field-label">
              Grupo
            </label>
            <select
              id={ids.group}
              value={activeGroup?.groupId ?? ""}
              onChange={(e) => onGroupChange(e.target.value)}
              className="input min-h-11 py-2 text-sm font-semibold"
            >
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName} · {g.gradeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={ids.category} className="field-label">
              Categoría
            </label>
            <select
              id={ids.category}
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ObserverCategory)}
              className="input min-h-11 py-2 text-sm font-semibold"
            >
              {OBSERVER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {OBSERVER_CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={ids.period} className="field-label">
              Periodo
            </label>
            <select
              id={ids.period}
              name="periodId"
              defaultValue={defaultPeriodId ?? periods[0]?.id ?? ""}
              className="input min-h-11 py-2 text-sm font-semibold"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="rounded-control bg-cloud px-3 py-2 text-xs font-semibold text-navy">
          {OBSERVER_CATEGORY_META[category].description}
        </p>

        <fieldset className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="field-label mb-0">
              Estudiantes ({selectedEnrollments.length} seleccionado
              {selectedEnrollments.length === 1 ? "" : "s"})
            </legend>
            <button
              type="button"
              onClick={toggleAllInGroup}
              className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-semibold text-sky-solid hover:bg-sky-l/60"
            >
              <Users className="size-3.5" aria-hidden />
              {allSelected ? "Quitar selección" : "Seleccionar todo el grupo"}
            </button>
          </div>

          {activeGroup && activeGroup.students.length > 0 ? (
            <ul className="grid max-h-44 gap-1.5 overflow-y-auto rounded-control border border-line bg-bg-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeGroup.students.map((s) => {
                const checked = selectedEnrollments.includes(s.enrollmentId);
                return (
                  <li key={s.enrollmentId}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-1.5 text-sm font-semibold text-navy hover:bg-white">
                      <input
                        type="checkbox"
                        name="enrollmentIds"
                        value={s.enrollmentId}
                        checked={checked}
                        onChange={() => toggleStudent(s.enrollmentId)}
                        className="size-4 accent-navy"
                      />
                      <span className="truncate">{s.fullName}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Este grupo no tiene estudiantes matriculados activos.</p>
          )}
        </fieldset>

        <div>
          <label htmlFor={ids.title} className="field-label">
            Título breve
          </label>
          <input
            id={ids.title}
            name="title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            placeholder="Ej. Reconocimiento proyecto STHEAMI o Seguimiento de entregas"
            className="input min-h-11 py-2 text-sm font-medium"
          />
        </div>

        <div>
          <label htmlFor={ids.description} className="field-label">
            Descripción objetiva de los hechos
          </label>
          <textarea
            id={ids.description}
            name="description"
            rows={3}
            required
            minLength={10}
            maxLength={1500}
            placeholder="Describe de forma clara y respetuosa el reconocimiento o la situación observada…"
            className="input min-h-24 resize-y py-2.5 text-sm font-medium"
          />
        </div>

        <div>
          <label htmlFor={ids.commitment} className="field-label">
            Estrategia pedagógica o compromiso sugerido (opcional)
          </label>
          <input
            id={ids.commitment}
            name="commitment"
            type="text"
            maxLength={600}
            placeholder="Ej. Presentar plan de recuperación el próximo martes."
            className="input min-h-11 py-2 text-sm font-medium"
          />
        </div>

        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-control border border-red-solid/40 bg-red-l px-3 py-2 text-sm font-semibold text-navy">
            {state.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending || selectedEnrollments.length === 0}
            className={pillButtonClass({ variant: "navy", size: "sm" })}
          >
            <Plus aria-hidden />
            {pending ? "Registrando…" : "Guardar anotación"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            Cerrar
          </button>
        </div>
      </form>
    </section>
  );
}
