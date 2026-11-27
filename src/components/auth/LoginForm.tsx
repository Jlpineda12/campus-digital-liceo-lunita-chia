"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { playLunita } from "@/components/brand/LunitaCharacter";
import { cx } from "@/components/ui/cx";
import { pillButtonClass } from "@/components/ui/PillButton";
import { loginAction, type LoginState } from "@/modules/core/auth/actions";
import type { LoginRoleParam } from "@/modules/core/auth/roles";

/**
 * Pista del campo según `?rol=` (enlace desde el sitio web). Es solo ayuda: el
 * Campus detecta el rol real al validar la cuenta.
 */
const AUDIENCE_HINTS: Record<LoginRoleParam, { label: string; hint: string }> = {
  estudiantes: { label: "Estudiante", hint: "Tu número de documento (TI o RC) o tu correo del colegio." },
  padres: { label: "Familia", hint: "Tu cédula o el correo que registraste en la matrícula." },
  docentes: { label: "Docente", hint: "Tu cédula o tu correo institucional." },
  directivos: { label: "Directivo", hint: "Tu cédula o tu correo institucional." },
};

const GENERAL_HINT = "Tu número de documento o el correo registrado en el colegio.";
const INITIAL_STATE: LoginState = { status: "idle" };

interface LoginFormProps {
  /** Del parámetro `?rol=`; sin él se muestra una pista general. */
  initialAudience?: LoginRoleParam;
  next?: string;
  modulo?: string;
}

export function LoginForm({ initialAudience, next, modulo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const ids = { identifier: useId(), password: useId(), hint: useId() };

  return (
    <form action={formAction} onSubmit={() => playLunita("tap")} noValidate className="grid gap-5">

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
          {state.fieldErrors?.identifier ?? (initialAudience ? AUDIENCE_HINTS[initialAudience].hint : GENERAL_HINT)}
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
