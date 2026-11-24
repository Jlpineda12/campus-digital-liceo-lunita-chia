"use client";

import { CheckCircle2, UserPlus, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { pillButtonClass } from "@/components/ui/PillButton";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/modules/core/academic-structure/constants";
import { PASSWORD_MIN_LENGTH } from "@/modules/core/auth/password-policy";
import { ROLE_META, ROLES } from "@/modules/core/auth/roles";
import { createUserAction, type UserActionState } from "@/modules/core/users/actions";

const INITIAL: UserActionState = { status: "idle" };

/** Botón y formulario desplegable para crear una cuenta nueva sin saturar el directorio. */
export function CreateUserDrawer({
  defaultOpen = false,
  onClose,
}: {
  defaultOpen?: boolean;
  onClose?: () => void;
} = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState(createUserAction, INITIAL);
  const id = useId();

  function closePanel() {
    setOpen(false);
    onClose?.();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={pillButtonClass({ variant: "navy", size: "sm" })}
        >
          <UserPlus aria-hidden /> Nuevo usuario
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
    <section aria-label="Crear nuevo usuario" className="card grid gap-4 border-cobalt/20 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-cobalt" aria-hidden />
          <h2 className="text-base font-bold text-navy">Registrar cuenta institucional</h2>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted hover:bg-cloud hover:text-navy"
        >
          <X className="size-4" aria-hidden /> Cerrar
        </button>
      </div>

      <form action={action} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={`${id}-role`} className="field-label">
              Rol
            </label>
            <select id={`${id}-role`} name="role" defaultValue="STUDENT" className="input min-h-11 text-sm font-semibold">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-docType`} className="field-label">
              Tipo doc.
            </label>
            <select id={`${id}-docType`} name="documentType" defaultValue="TI" className="input min-h-11 text-sm font-medium">
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt} · {DOCUMENT_TYPE_LABELS[dt]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-docNum`} className="field-label">
              Número de documento
            </label>
            <input
              id={`${id}-docNum`}
              name="documentNumber"
              required
              minLength={4}
              maxLength={20}
              placeholder="Ej. 1070123456"
              className="input min-h-11 text-sm font-semibold tabular"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-first`} className="field-label">
              Nombres
            </label>
            <input
              id={`${id}-first`}
              name="firstName"
              required
              minLength={2}
              maxLength={80}
              placeholder="Ej. Camila Andrea"
              className="input min-h-11 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor={`${id}-last`} className="field-label">
              Apellidos
            </label>
            <input
              id={`${id}-last`}
              name="lastName"
              required
              minLength={2}
              maxLength={80}
              placeholder="Ej. Torres López"
              className="input min-h-11 text-sm font-medium"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-email`} className="field-label">
              Correo (opcional)
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              placeholder="nombre@campus.lunita.edu.co"
              className="input min-h-11 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor={`${id}-phone`} className="field-label">
              Teléfono (opcional)
            </label>
            <input
              id={`${id}-phone`}
              name="phone"
              type="tel"
              maxLength={25}
              placeholder="310 000 0000"
              className="input min-h-11 text-sm font-medium tabular"
            />
          </div>
          <div>
            <label htmlFor={`${id}-pwd`} className="field-label">
              Contraseña temporal
            </label>
            <input
              id={`${id}-pwd`}
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="Mín. 10 caracteres (letras y números)"
              autoComplete="new-password"
              className="input min-h-11 text-sm font-medium"
            />
          </div>
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={closePanel}
            className={pillButtonClass({ variant: "outline", size: "sm" })}
          >
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
            <UserPlus aria-hidden />
            {pending ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </section>
  );
}
