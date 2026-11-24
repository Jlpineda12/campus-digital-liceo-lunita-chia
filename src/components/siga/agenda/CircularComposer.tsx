"use client";

import { CheckCircle2, Megaphone, Plus, Send, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { createCircularAction, type AgendaActionState } from "@/modules/siga/agenda/actions";
import { CIRCULAR_SCOPE_LABELS, type CircularScope } from "@/modules/siga/agenda/meta";
import type { AudienceOptions } from "@/modules/siga/agenda/queries";

const INITIAL: AgendaActionState = { status: "idle" };

/** Formulario plegable para publicar comunicados institucionales o de grupo sin saturar la pantalla. */
export function CircularComposer({ audience }: { audience: AudienceOptions }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CircularScope>(audience.allowInstitutional ? "ALL" : "GROUP");
  const [state, action, pending] = useActionState(createCircularAction, INITIAL);
  const id = useId();

  const canPublishAny = audience.allowInstitutional || audience.groups.length > 0;
  if (!canPublishAny) return null;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={pillButtonClass({ variant: "navy", size: "sm" })}
        >
          <Plus aria-hidden /> Nueva circular
        </button>
        {state.status === "success" && state.message && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-solid">
            <CheckCircle2 className="size-4" aria-hidden />
            {state.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label="Redactar nueva circular"
      className="card grid gap-4 border-cobalt/20 bg-white"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-cobalt" aria-hidden />
          <h2 className="text-base font-bold text-navy">Publicar comunicado o circular</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted hover:bg-cloud hover:text-navy"
        >
          <X className="size-4" aria-hidden /> Cerrar
        </button>
      </div>

      <form action={action} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-scope`} className="field-label">
              Destinatarios
            </label>
            <select
              id={`${id}-scope`}
              name="targetScope"
              value={scope}
              onChange={(e) => setScope(e.target.value as CircularScope)}
              className="input min-h-11 text-sm font-semibold"
            >
              {audience.allowInstitutional && (
                <>
                  <option value="ALL">{CIRCULAR_SCOPE_LABELS.ALL}</option>
                  <option value="LEVEL">{CIRCULAR_SCOPE_LABELS.LEVEL}</option>
                  <option value="GRADE">{CIRCULAR_SCOPE_LABELS.GRADE}</option>
                </>
              )}
              {audience.groups.length > 0 && <option value="GROUP">{CIRCULAR_SCOPE_LABELS.GROUP}</option>}
            </select>
          </div>

          {scope === "LEVEL" && (
            <div>
              <label htmlFor={`${id}-level`} className="field-label">
                Nivel
              </label>
              <select id={`${id}-level`} name="targetLevelId" required className="input min-h-11 text-sm font-medium">
                {audience.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "GRADE" && (
            <div>
              <label htmlFor={`${id}-grade`} className="field-label">
                Grado
              </label>
              <select id={`${id}-grade`} name="targetGradeId" required className="input min-h-11 text-sm font-medium">
                {audience.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "GROUP" && (
            <div>
              <label htmlFor={`${id}-group`} className="field-label">
                Grupo
              </label>
              <select id={`${id}-group`} name="targetGroupId" required className="input min-h-11 text-sm font-medium">
                {audience.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.gradeName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-title`} className="field-label">
            Asunto
          </label>
          <input
            id={`${id}-title`}
            name="title"
            required
            minLength={4}
            maxLength={140}
            placeholder="Ej. Entrega de boletines del Tercer Periodo y escuela de padres"
            className="input min-h-11 text-sm font-semibold"
          />
        </div>

        <div>
          <label htmlFor={`${id}-body`} className="field-label">
            Mensaje
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            rows={5}
            required
            minLength={12}
            maxLength={4000}
            placeholder="Redacta con claridad fechas, horarios, lugar o indicaciones para las familias…"
            className="input min-h-32 resize-y py-2.5 text-sm leading-relaxed font-normal"
          />
        </div>

        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm font-semibold text-red-solid">
            {state.message}
          </p>
        )}
        {state.status === "success" && state.message && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-solid">
            <CheckCircle2 className="size-4" aria-hidden />
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <Send aria-hidden />
            {pending ? "Publicando…" : "Publicar circular"}
          </button>
        </div>
      </form>
    </section>
  );
}
