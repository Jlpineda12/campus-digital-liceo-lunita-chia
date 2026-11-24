"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { completeResetAction, type ResetCompleteState } from "@/modules/core/auth/actions";
import {
  estimateStrength,
  PASSWORD_MIN_LENGTH,
  STRENGTH_LABELS,
} from "@/modules/core/auth/password-policy";

const INITIAL: ResetCompleteState = { status: "idle" };
const METER_TONES = ["bg-red-solid", "bg-red-solid", "bg-orange-solid", "bg-sky-solid", "bg-green-solid"];

export function NewPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completeResetAction, INITIAL);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const ids = { password: useId(), confirm: useId(), meter: useId() };
  const strength = estimateStrength(password);

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor={ids.password} className="field-label">
          Nueva contraseña
        </label>
        <div className="relative">
          <input
            id={ids.password}
            name="password"
            type={visible ? "text" : "password"}
            className="input pr-14"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={ids.meter}
            aria-invalid={state.fieldErrors?.password || state.problems ? true : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-1.5 my-auto grid size-10 place-items-center rounded-control text-muted hover:text-navy"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <div id={ids.meter} className="mt-2">
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cx(
                  "h-1.5 rounded-pill transition-colors duration-200",
                  strength >= step ? METER_TONES[strength] : "bg-line",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-muted" aria-live="polite">
            {password
              ? `Seguridad: ${STRENGTH_LABELS[strength]}`
              : `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con letras y números.`}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={ids.confirm} className="field-label">
          Confirma la contraseña
        </label>
        <input
          id={ids.confirm}
          name="confirm"
          type={visible ? "text" : "password"}
          className="input"
          autoComplete="new-password"
          aria-invalid={state.fieldErrors?.confirm ? true : undefined}
          required
        />
        {state.fieldErrors?.confirm && (
          <p className="mt-1.5 text-sm font-semibold text-red-solid">{state.fieldErrors.confirm}</p>
        )}
      </div>

      {(state.message || state.problems || state.fieldErrors?.password) && (
        <div role="alert" className="rounded-control border-2 border-red bg-red-l px-4 py-3 text-sm font-bold text-navy">
          {state.message ?? state.fieldErrors?.password}
          {state.problems && (
            <ul className="grid list-disc gap-1 pl-5">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className={pillButtonClass({ block: true })}>
        <KeyRound aria-hidden />
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
      <p className="text-sm text-muted">
        Al guardarla se cerrará la sesión en todos tus dispositivos.
      </p>
    </form>
  );
}
