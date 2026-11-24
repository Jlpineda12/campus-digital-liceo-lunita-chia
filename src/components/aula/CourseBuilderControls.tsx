"use client";

import {
  BookOpen,
  CheckCircle2,
  ClipboardPlus,
  FileUp,
  FolderPlus,
  HelpCircle,
  Link2,
  Plus,
  X,
} from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  createActivityAction,
  createResourceAction,
  createUnitAction,
  type AulaActionState,
} from "@/modules/aula/actions";
import { createQuizAction } from "@/modules/aula/quizzes/actions";
import { DIMENSION_LABELS, type SieeDimension } from "@/modules/siga/siee-grades/calculator";

const INITIAL: AulaActionState = { status: "idle" };

/**
 * Controles plegables para que el docente construya su curso en Órbita Virtual:
 * Unidades, Guías PDF / Lecturas / Videos, Tareas y Cuestionarios autocalificables.
 */
export function CourseBuilderControls({
  courseAssignmentId,
  periodId,
  units,
  availableDimensions,
}: {
  courseAssignmentId: string;
  periodId: string;
  units: Array<{ id: string; title: string }>;
  availableDimensions: Array<{ dimension: SieeDimension; availableWeight: number }>;
}) {
  const [panel, setPanel] = useState<"none" | "unit" | "resource" | "activity" | "quiz">("none");
  const [resourceType, setResourceType] = useState<"PDF" | "RICH_TEXT" | "LINK" | "VIDEO">("PDF");
  const [syncSiga, setSyncSiga] = useState(true);
  const [selectedDim, setSelectedDim] = useState<SieeDimension>(
    availableDimensions[0]?.dimension ?? "HACER",
  );

  const [unitState, unitAction, unitPending] = useActionState(createUnitAction, INITIAL);
  const [resState, resAction, resPending] = useActionState(createResourceAction, INITIAL);
  const [actState, actAction, actPending] = useActionState(createActivityAction, INITIAL);
  const [quizState, quizAction, quizPending] = useActionState(createQuizAction, INITIAL);
  const id = useId();

  const currentAvailable =
    availableDimensions.find((d) => d.dimension === selectedDim)?.availableWeight ?? 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanel((p) => (p === "unit" ? "none" : "unit"))}
          className={pillButtonClass({ variant: panel === "unit" ? "navy" : "outline", size: "sm" })}
        >
          <FolderPlus aria-hidden /> Nueva unidad
        </button>

        {units.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "resource" ? "none" : "resource"))}
              className={pillButtonClass({ variant: panel === "resource" ? "navy" : "outline", size: "sm" })}
            >
              <BookOpen aria-hidden /> Subir PDF / recurso
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "activity" ? "none" : "activity"))}
              className={pillButtonClass({ variant: panel === "activity" ? "navy" : "outline", size: "sm" })}
            >
              <ClipboardPlus aria-hidden /> Nueva tarea
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "quiz" ? "none" : "quiz"))}
              className={pillButtonClass({ variant: panel === "quiz" ? "outline" : "navy", size: "sm" })}
            >
              <HelpCircle aria-hidden /> Nuevo cuestionario
            </button>
          </>
        )}
      </div>

      {/* Formulario 1: Nueva unidad */}
      {panel === "unit" && (
        <section aria-label="Crear unidad" className="card grid gap-4 border-cobalt/25 bg-white">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h2 className="text-sm font-bold text-navy">Crear unidad temática</h2>
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy"
            >
              <X className="size-4" aria-hidden /> Cerrar
            </button>
          </div>
          <form action={unitAction} className="grid gap-3">
            <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
            <input type="hidden" name="periodId" value={periodId} />
            <div>
              <label htmlFor={`${id}-utitle`} className="field-label">
                Nombre de la unidad
              </label>
              <input
                id={`${id}-utitle`}
                name="title"
                required
                minLength={3}
                maxLength={100}
                placeholder="Ej. Unidad 2: Fracciones y proporciones"
                className="input min-h-10 text-sm font-semibold"
              />
            </div>
            <div>
              <label htmlFor={`${id}-udesc`} className="field-label">
                Objetivo o descripción breve (opcional)
              </label>
              <input
                id={`${id}-udesc`}
                name="description"
                maxLength={400}
                placeholder="Qué aprenderán los estudiantes en este módulo…"
                className="input min-h-10 text-sm font-medium"
              />
            </div>
            {unitState.message && (
              <p
                role={unitState.status === "error" ? "alert" : "status"}
                className={`text-xs font-semibold ${
                  unitState.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {unitState.message}
              </p>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={unitPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <Plus aria-hidden /> {unitPending ? "Creando…" : "Crear unidad"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Formulario 2: Subir PDF o agregar recurso */}
      {panel === "resource" && units.length > 0 && (
        <section aria-label="Subir PDF o recurso" className="card grid gap-4 border-cobalt/25 bg-white">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h2 className="text-sm font-bold text-navy">Subir guía PDF o material de estudio</h2>
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy"
            >
              <X className="size-4" aria-hidden /> Cerrar
            </button>
          </div>
          <form action={resAction} className="grid gap-3">
            <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-runit`} className="field-label">
                  Unidad
                </label>
                <select id={`${id}-runit`} name="unitId" className="input min-h-10 text-sm font-semibold">
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-rtype`} className="field-label">
                  Tipo de material
                </label>
                <select
                  id={`${id}-rtype`}
                  name="type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as "PDF" | "RICH_TEXT" | "LINK" | "VIDEO")}
                  className="input min-h-10 text-sm font-semibold"
                >
                  <option value="PDF">Archivo PDF (guía, taller o presentación · máx. 10 MB)</option>
                  <option value="RICH_TEXT">Lectura escrita en plataforma</option>
                  <option value="VIDEO">Video educativo (enlace https)</option>
                  <option value="LINK">Enlace externo / simulación (https)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-rtitle`} className="field-label">
                Título del material
              </label>
              <input
                id={`${id}-rtitle`}
                name="title"
                required
                minLength={3}
                maxLength={120}
                placeholder="Ej. Guía 1 — Taller ilustrado de ecosistemas (PDF)"
                className="input min-h-10 text-sm font-semibold"
              />
            </div>

            {resourceType === "PDF" ? (
              <div className="grid gap-2">
                <label htmlFor={`${id}-rfile`} className="field-label">
                  Seleccionar documento PDF (almacenamiento privado seguro · máx. 10 MB)
                </label>
                <input
                  id={`${id}-rfile`}
                  name="file"
                  type="file"
                  required
                  accept="application/pdf,.pdf"
                  className="input min-h-11 py-2 text-sm font-medium file:mr-3 file:rounded-md file:border-0 file:bg-cloud file:px-3 file:py-1 file:text-xs file:font-bold file:text-navy"
                />
                <input
                  name="contentTextOrUrl"
                  maxLength={300}
                  placeholder="Nota breve opcional sobre el PDF (ej. Leer páginas 1 a 4 antes del jueves)…"
                  className="input min-h-9 text-xs font-normal"
                />
              </div>
            ) : resourceType === "RICH_TEXT" ? (
              <div>
                <label htmlFor={`${id}-rcontent`} className="field-label">
                  Contenido de la lectura
                </label>
                <textarea
                  id={`${id}-rcontent`}
                  name="contentTextOrUrl"
                  rows={4}
                  required
                  minLength={4}
                  placeholder="Escribe el resumen, conceptos clave o guía paso a paso…"
                  className="input min-h-24 resize-y py-2 text-sm leading-relaxed font-normal"
                />
              </div>
            ) : (
              <div>
                <label htmlFor={`${id}-rurl`} className="field-label">
                  Enlace seguro (https://…)
                </label>
                <input
                  id={`${id}-rurl`}
                  name="contentTextOrUrl"
                  type="url"
                  required
                  placeholder="https://..."
                  className="input min-h-10 text-sm font-medium"
                />
              </div>
            )}

            {resState.message && (
              <p
                role={resState.status === "error" ? "alert" : "status"}
                className={`text-xs font-semibold ${
                  resState.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {resState.message}
              </p>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={resPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <FileUp aria-hidden /> {resPending ? "Subiendo…" : "Publicar recurso"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Formulario 3: Nueva tarea */}
      {panel === "activity" && units.length > 0 && (
        <section aria-label="Crear tarea" className="card grid gap-4 border-cobalt/25 bg-white">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h2 className="text-sm font-bold text-navy">Publicar nueva tarea o taller</h2>
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy"
            >
              <X className="size-4" aria-hidden /> Cerrar
            </button>
          </div>
          <form action={actAction} className="grid gap-3.5">
            <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-aunit`} className="field-label">
                  Unidad
                </label>
                <select id={`${id}-aunit`} name="unitId" className="input min-h-10 text-sm font-semibold">
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-adue`} className="field-label">
                  Fecha límite (opcional)
                </label>
                <input id={`${id}-adue`} name="dueDate" type="date" className="input min-h-10 text-sm font-medium" />
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-atitle`} className="field-label">
                Título de la tarea
              </label>
              <input
                id={`${id}-atitle`}
                name="title"
                required
                minLength={3}
                maxLength={120}
                placeholder="Ej. Entrega de informe en PDF o foto del cuaderno"
                className="input min-h-10 text-sm font-semibold"
              />
            </div>

            <div>
              <label htmlFor={`${id}-ainst`} className="field-label">
                Instrucciones y criterios de evaluación
              </label>
              <textarea
                id={`${id}-ainst`}
                name="instructions"
                rows={3}
                required
                minLength={8}
                placeholder="Los estudiantes podrán responder por texto, adjuntar PDF/foto o pegar un enlace…"
                className="input min-h-24 resize-y py-2 text-sm leading-relaxed font-normal"
              />
            </div>

            <div className="grid gap-3 rounded-control border border-sky/40 bg-sky-l/35 p-3.5">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-navy">
                <input
                  type="checkbox"
                  name="syncToSiga"
                  checked={syncSiga}
                  onChange={(e) => setSyncSiga(e.target.checked)}
                  className="size-4 accent-navy"
                />
                <Link2 className="size-3.5 text-sky-solid" aria-hidden />
                Sincronizar nota automáticamente con la planilla SIEE (SIGA)
              </label>

              {syncSiga && availableDimensions.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-sdim`} className="field-label">
                      Dimensión SIEE
                    </label>
                    <select
                      id={`${id}-sdim`}
                      name="sieeDimension"
                      value={selectedDim}
                      onChange={(e) => setSelectedDim(e.target.value as SieeDimension)}
                      className="input min-h-9 bg-white text-xs font-semibold"
                    >
                      {availableDimensions.map((d) => (
                        <option key={d.dimension} value={d.dimension}>
                          {DIMENSION_LABELS[d.dimension]} (disponible: {d.availableWeight}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${id}-sweight`} className="field-label">
                      Peso en la dimensión (%)
                    </label>
                    <input
                      id={`${id}-sweight`}
                      name="weightPercent"
                      type="number"
                      min={1}
                      max={Math.max(1, currentAvailable)}
                      defaultValue={Math.min(Math.max(currentAvailable, 1), 25)}
                      className="input min-h-9 bg-white text-xs font-semibold tabular"
                    />
                  </div>
                </div>
              )}
            </div>

            {actState.message && (
              <p
                role={actState.status === "error" ? "alert" : "status"}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  actState.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {actState.status === "success" && <CheckCircle2 className="size-4" aria-hidden />}
                {actState.message}
              </p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={actPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <ClipboardPlus aria-hidden /> {actPending ? "Publicando…" : "Publicar tarea"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Formulario 4: Nuevo cuestionario autocalificable */}
      {panel === "quiz" && units.length > 0 && (
        <section aria-label="Crear cuestionario" className="card grid gap-4 border-cobalt/25 bg-white">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <h2 className="text-sm font-bold text-navy">Crear cuestionario interactivo autocalificable</h2>
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy"
            >
              <X className="size-4" aria-hidden /> Cerrar
            </button>
          </div>
          <form action={quizAction} className="grid gap-3.5">
            <input type="hidden" name="courseAssignmentId" value={courseAssignmentId} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor={`${id}-qunit`} className="field-label">
                  Unidad
                </label>
                <select id={`${id}-qunit`} name="unitId" className="input min-h-10 text-sm font-semibold">
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-qtime`} className="field-label">
                  Tiempo (minutos)
                </label>
                <input
                  id={`${id}-qtime`}
                  name="timeLimitMinutes"
                  type="number"
                  min={0}
                  max={180}
                  defaultValue={20}
                  className="input min-h-10 text-sm font-semibold tabular"
                />
              </div>
              <div>
                <label htmlFor={`${id}-qatt`} className="field-label">
                  Intentos
                </label>
                <select id={`${id}-qatt`} name="maxAttempts" defaultValue="1" className="input min-h-10 text-sm font-semibold">
                  <option value="1">1 intento</option>
                  <option value="2">2 intentos (mejor nota)</option>
                  <option value="3">3 intentos (mejor nota)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
              <div>
                <label htmlFor={`${id}-qtitle`} className="field-label">
                  Título del cuestionario
                </label>
                <input
                  id={`${id}-qtitle`}
                  name="title"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="Ej. Quiz interactivo — Conceptos clave de la unidad"
                  className="input min-h-10 text-sm font-semibold"
                />
              </div>
              <div>
                <label htmlFor={`${id}-qdue`} className="field-label">
                  Fecha límite (opcional)
                </label>
                <input id={`${id}-qdue`} name="dueDate" type="date" className="input min-h-10 text-sm font-medium" />
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-qinst`} className="field-label">
                Indicaciones para los estudiantes (opcional)
              </label>
              <input
                id={`${id}-qinst`}
                name="instructions"
                maxLength={2000}
                placeholder="Ej. Lee con calma cada pregunta; recibirás tu nota y retroalimentación al instante."
                className="input min-h-10 text-sm font-normal"
              />
            </div>

            <div className="grid gap-3 rounded-control border border-purple/40 bg-purple-l/30 p-3.5">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-navy">
                <input
                  type="checkbox"
                  name="syncToSiga"
                  checked={syncSiga}
                  onChange={(e) => setSyncSiga(e.target.checked)}
                  className="size-4 accent-navy"
                />
                <Link2 className="size-3.5 text-purple-solid" aria-hidden />
                Enviar calificación automática a la planilla SIEE (SIGA)
              </label>

              {syncSiga && availableDimensions.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-qsdim`} className="field-label">
                      Dimensión SIEE
                    </label>
                    <select
                      id={`${id}-qsdim`}
                      name="sieeDimension"
                      value={selectedDim}
                      onChange={(e) => setSelectedDim(e.target.value as SieeDimension)}
                      className="input min-h-9 bg-white text-xs font-semibold"
                    >
                      {availableDimensions.map((d) => (
                        <option key={d.dimension} value={d.dimension}>
                          {DIMENSION_LABELS[d.dimension]} (disponible: {d.availableWeight}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${id}-qsweight`} className="field-label">
                      Peso (%)
                    </label>
                    <input
                      id={`${id}-qsweight`}
                      name="weightPercent"
                      type="number"
                      min={1}
                      max={Math.max(1, currentAvailable)}
                      defaultValue={Math.min(Math.max(currentAvailable, 1), 20)}
                      className="input min-h-9 bg-white text-xs font-semibold tabular"
                    />
                  </div>
                </div>
              )}
            </div>

            {quizState.message && (
              <p
                role={quizState.status === "error" ? "alert" : "status"}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  quizState.status === "error" ? "text-red-solid" : "text-green-solid"
                }`}
              >
                {quizState.status === "success" && <CheckCircle2 className="size-4" aria-hidden />}
                {quizState.message}
              </p>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={quizPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <HelpCircle aria-hidden /> {quizPending ? "Creando…" : "Crear cuestionario"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
