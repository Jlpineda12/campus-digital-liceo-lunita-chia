"use client";

import { MailCheck, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { requestResetAction, type ResetRequestState } from "@/modules/core/auth/actions";

const INITIAL: ResetRequestState = { status: "idle" };

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, INITIAL);
  const id = useId();

  if (state.status === "sent") {
    return (
      <div role="status" className="grid gap-4">
        <span className="grid size-14 place-items-center rounded-icon bg-green-l text-green-solid">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="text-step-2">Revisa tu correo</h2>
        <p className="text-muted">
          Si encontramos una cuenta activa con ese dato y correo registrado, enviaremos un enlace de
          restablecimiento válido por 15 minutos. Revisa también la carpeta de correo no deseado.
        </p>
        <p className="text-sm text-muted">
          Si el estudiante no tiene correo propio, el enlace llega al correo del acudiente. ¿Nadie
          tiene correo registrado? Comunícate con Secretaría.
        </p>
        <Link href="/login" className={pillButtonClass({ variant: "outline" })}>
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <div>
        <label htmlFor={id} className="field-label">
          Documento o correo
        </label>
        <input
          id={id}
          name="identifier"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.identifier}
          placeholder="Ej. 1070000001"
          aria-invalid={state.status === "error" ? true : undefined}
          aria-describedby={`${id}-help`}
          required
        />
        <p id={`${id}-help`} className="mt-1.5 text-sm font-semibold text-muted">
          Te enviaremos un enlace al correo registrado en el colegio.
        </p>
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-control border-2 border-red bg-red-l px-4 py-3 text-sm font-bold text-navy">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={pillButtonClass({ block: true })}>
        <Send aria-hidden />
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
      <Link href="/login" className="text-center text-sm font-extrabold">
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
