"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { loginAction, type LoginState } from "@/modules/core/auth/actions";
import type { LoginRoleParam } from "@/modules/core/auth/roles";

/**
 * Pistas de acceso por tipo de usuario. Es solo ayuda visual: el Campus detecta
 * el rol real al validar la cuenta (no hay que elegirlo para ingresar).
 */
const AUDIENCE_HINTS: Record<LoginRoleParam, { label: string; hint: string }> = {
  estudiantes: { label: "Estudiante", hint: "Tu número de documento (TI o RC) o tu correo del colegio." },
  padres: { label: "Familia", hint: "Tu cédula o el correo que registraste en la matrícula." },
  docentes: { label: "Docente", hint: "Tu cédula o tu correo institucional." },
  directivos: { label: "Directivo", hint: "Tu cédula o tu correo institucional." },
};

const AUDIENCES = Object.keys(AUDIENCE_HINTS) as LoginRoleParam[];
const INITIAL_STATE: LoginState = { status: "idle" };

interface LoginFormProps {
  initialAudience: LoginRoleParam;
  next?: string;
  modulo?: string;
}

export function LoginForm({ initialAudience, next, modulo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);
  const [audience, setAudience] = useState<LoginRoleParam>(initialAudience);
  const [showPassword, setShowPassword] = useState(false);
  const ids = { identifier: useId(), password: useId(), hint: useId(), legend: useId() };

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <fieldset aria-describedby={`${ids.legend}-note`}>
        <legend id={ids.legend} className="field-label">
          Ver indicaciones para
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AUDIENCES.map((key) => (
            <label
              key={key}
              className={cx(
                "audience-option",
                "cursor-pointer rounded-control border-2 border-line bg-white px-2 py-2 text-center text-sm font-extrabold text-muted transition-colors",
                "hover:border-line-2 hover:text-navy",
                "has-checked:border-sky has-checked:bg-sky-l has-checked:text-navy",
                "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-sky",
              )}
            >
              <input
                type="radio"
                name="audiencia"
                value={key}
                checked={audience === key}
                onChange={() => setAudience(key)}
                className="sr-only"
              />
              {AUDIENCE_HINTS[key].label}
            </label>
          ))}
        </div>
        <p id={`${ids.legend}-note`} className="mt-2 text-xs font-semibold text-muted">
          No necesitas elegir tu rol: el Campus lo reconoce al ingresar.
        </p>
      </fieldset>

      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="modulo" value={modulo ?? ""} />

      <div>
        <label htmlFor={ids.identifier} className="field-label">
          Documento o correo
        </label>
        <input
          id={ids.identifier}
          name="identifier"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.identifier}
          placeholder="Ej. 1070000001"
          aria-describedby={ids.hint}
          aria-invalid={state.fieldErrors?.identifier ? true : undefined}
          required
        />
        <p
          id={ids.hint}
          aria-live="polite"
          className={cx(
            "mt-1.5 text-sm font-semibold",
            state.fieldErrors?.identifier ? "text-red-solid" : "text-muted",
          )}
        >
          {state.fieldErrors?.identifier ?? AUDIENCE_HINTS[audience].hint}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={ids.password} className="field-label">
            Contraseña
          </label>
          <Link href="/recuperar-clave" className="text-sm font-extrabold">
            ¿La olvidaste?
          </Link>
        </div>
        <div className="relative">
          <input
            id={ids.password}
            name="password"
            type={showPassword ? "text" : "password"}
            className="input pr-14"
            autoComplete="current-password"
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby={state.fieldErrors?.password ? `${ids.password}-error` : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-1.5 my-auto grid size-10 place-items-center rounded-control text-muted hover:text-navy"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p id={`${ids.password}-error`} className="mt-1.5 text-sm font-semibold text-red-solid">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {state.message && (
        <p
          role="alert"
          className="rounded-control border-2 border-red bg-red-l px-4 py-3 text-sm font-bold text-navy"
        >
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={pillButtonClass({ block: true })}>
        <LogIn aria-hidden />
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
