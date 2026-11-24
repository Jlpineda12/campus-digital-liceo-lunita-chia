"use client";

import {
  CheckCircle2,
  KeyRound,
  Link2,
  LogOut,
  Power,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { pillButtonClass } from "@/components/ui/PillButton";
import {
  DOCUMENT_TYPES,
  GUARDIAN_RELATIONSHIP_LABELS,
  GUARDIAN_RELATIONSHIPS,
} from "@/modules/core/academic-structure/constants";
import { PASSWORD_MIN_LENGTH } from "@/modules/core/auth/password-policy";
import { ROLE_META, ROLES } from "@/modules/core/auth/roles";
import {
  adminResetPasswordAction,
  createGuardianLinkAction,
  removeGuardianLinkAction,
  revokeUserSessionsAction,
  toggleUserActiveAction,
  updateUserAction,
  type UserActionState,
} from "@/modules/core/users/actions";
import type { ManagedUserDetail } from "@/modules/core/users/queries";

const INITIAL: UserActionState = { status: "idle" };

/** Panel enfocado para administrar datos, rol, sesiones, clave y vínculos familiares de un usuario. */
export function UserManagePanel({
  user,
  canManage,
  canRevokeSessions,
  closeHref,
}: {
  user: ManagedUserDetail;
  canManage: boolean;
  canRevokeSessions: boolean;
  closeHref: string;
}) {
  const [editState, editAction, editPending] = useActionState(updateUserAction, INITIAL);
  const [statusState, statusAction, statusPending] = useActionState(toggleUserActiveAction, INITIAL);
  const [sessionState, sessionAction, sessionPending] = useActionState(revokeUserSessionsAction, INITIAL);
  const [pwdState, pwdAction, pwdPending] = useActionState(adminResetPasswordAction, INITIAL);
  const [linkState, linkAction, linkPending] = useActionState(createGuardianLinkAction, INITIAL);
  const [unlinkState, unlinkAction, unlinkPending] = useActionState(removeGuardianLinkAction, INITIAL);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const id = useId();

  const roleMeta = ROLE_META[user.role];
  const isFamilyRole = user.role === "GUARDIAN" || user.role === "STUDENT";

  return (
    <section
      aria-label={`Gestión de ${user.firstName} ${user.lastName}`}
      className="card grid gap-6 border-cobalt/25 bg-white"
    >
      {/* Cabecera del panel */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={roleMeta.tone}>{roleMeta.label}</Chip>
            <Chip tone={user.isActive ? "green" : "red"}>{user.isActive ? "Activa" : "Desactivada"}</Chip>
            <span className="text-xs font-semibold text-muted tabular">
              {user.activeSessions} {user.activeSessions === 1 ? "sesión activa" : "sesiones activas"}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-navy">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-xs text-muted tabular">
            {user.documentType} {user.documentNumber}
            {user.email ? ` · ${user.email}` : ""}
          </p>
        </div>

        <Link
          href={closeHref}
          className="inline-flex items-center gap-1 rounded-control border border-line px-2.5 py-1.5 text-xs font-semibold text-muted no-underline hover:bg-cloud hover:text-navy"
        >
          <X className="size-3.5" aria-hidden /> Cerrar panel
        </Link>
      </div>

      {/* 1. Datos personales y rol */}
      <form action={editAction} className="grid gap-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-role`} className="field-label">
              Rol
            </label>
            <select
              id={`${id}-role`}
              name="role"
              defaultValue={user.role}
              disabled={!canManage}
              className="input min-h-10 text-sm font-semibold"
            >
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
            <select
              id={`${id}-docType`}
              name="documentType"
              defaultValue={user.documentType}
              disabled={!canManage}
              className="input min-h-10 text-sm font-medium"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
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
              defaultValue={user.documentNumber}
              disabled={!canManage}
              required
              className="input min-h-10 text-sm font-semibold tabular"
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
              defaultValue={user.firstName}
              disabled={!canManage}
              required
              className="input min-h-10 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor={`${id}-last`} className="field-label">
              Apellidos
            </label>
            <input
              id={`${id}-last`}
              name="lastName"
              defaultValue={user.lastName}
              disabled={!canManage}
              required
              className="input min-h-10 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className="field-label">
              Correo electrónico
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
              disabled={!canManage}
              className="input min-h-10 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor={`${id}-phone`} className="field-label">
              Teléfono
            </label>
            <input
              id={`${id}-phone`}
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              disabled={!canManage}
              className="input min-h-10 text-sm font-medium tabular"
            />
          </div>
        </div>

        {editState.status === "error" && editState.message && (
          <p role="alert" className="text-sm font-semibold text-red-solid">
            {editState.message}
          </p>
        )}
        {editState.status === "success" && editState.message && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-solid">
            <CheckCircle2 className="size-4" aria-hidden />
            {editState.message}
          </p>
        )}

        {canManage && (
          <div className="flex justify-end">
            <button type="submit" disabled={editPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
              <Save aria-hidden />
              {editPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        )}
      </form>

      {/* 2. Seguridad, estado y sesiones */}
      {(canManage || canRevokeSessions) && (
        <div className="grid gap-3 border-t border-line pt-5">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-navy uppercase">
            <ShieldCheck className="size-4 text-cobalt" aria-hidden />
            Seguridad y sesiones
          </h3>

          <div className="flex flex-wrap items-center gap-2.5">
            {canRevokeSessions && (
              <form action={sessionAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  disabled={sessionPending || user.activeSessions === 0}
                  className={pillButtonClass({ variant: "outline", size: "sm" })}
                >
                  <LogOut aria-hidden />
                  {sessionPending
                    ? "Cerrando…"
                    : `Cerrar sesiones activas (${user.activeSessions})`}
                </button>
              </form>
            )}

            {canManage && (
              <form action={statusAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="nextActive" value={user.isActive ? "false" : "true"} />
                <button
                  type="submit"
                  disabled={statusPending}
                  className={pillButtonClass({ variant: "outline", size: "sm" })}
                >
                  <Power aria-hidden />
                  {statusPending
                    ? "Actualizando…"
                    : user.isActive
                      ? "Desactivar cuenta"
                      : "Reactivar cuenta"}
                </button>
              </form>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => setShowPwdForm((v) => !v)}
                className={pillButtonClass({ variant: "outline", size: "sm" })}
              >
                <KeyRound aria-hidden />
                {showPwdForm ? "Cancelar cambio de clave" : "Asignar nueva contraseña"}
              </button>
            )}
          </div>

          {statusState.message && (
            <p
              role={statusState.status === "error" ? "alert" : "status"}
              className={`text-sm font-semibold ${
                statusState.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {statusState.message}
            </p>
          )}
          {sessionState.message && (
            <p
              role={sessionState.status === "error" ? "alert" : "status"}
              className={`text-sm font-semibold ${
                sessionState.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {sessionState.message}
            </p>
          )}

          {showPwdForm && canManage && (
            <form
              action={pwdAction}
              className="grid gap-3 rounded-control border border-line bg-cloud/60 p-4 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <input type="hidden" name="userId" value={user.id} />
              <div>
                <label htmlFor={`${id}-newpwd`} className="field-label">
                  Nueva contraseña temporal (cierra todas las sesiones anteriores)
                </label>
                <input
                  id={`${id}-newpwd`}
                  name="newPassword"
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  placeholder="Mínimo 10 caracteres, combinando letras y números"
                  className="input min-h-10 bg-white text-sm font-medium"
                />
              </div>
              <button type="submit" disabled={pwdPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                {pwdPending ? "Actualizando…" : "Actualizar clave"}
              </button>
              {pwdState.message && (
                <p
                  role={pwdState.status === "error" ? "alert" : "status"}
                  className={`text-xs font-semibold sm:col-span-2 ${
                    pwdState.status === "error" ? "text-red-solid" : "text-green-solid"
                  }`}
                >
                  {pwdState.message}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* 3. Vínculos familiares (solo para Acudientes y Estudiantes) */}
      {isFamilyRole && (
        <div className="grid gap-3 border-t border-line pt-5">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-navy uppercase">
            <Link2 className="size-4 text-cobalt" aria-hidden />
            {user.role === "GUARDIAN" ? "Estudiantes a cargo" : "Acudientes vinculados"} ({user.links.length})
          </h3>

          {user.links.length === 0 ? (
            <p className="text-sm text-muted">Aún no tiene vínculos familiares registrados.</p>
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line bg-bg-2/40">
              {user.links.map((l) => (
                <li key={l.linkId} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-bold text-navy">{l.otherFullName}</p>
                    <p className="text-xs text-muted">
                      {GUARDIAN_RELATIONSHIP_LABELS[l.relationship]} · {l.otherDocument}
                      {l.isFinancialResponsible ? " · Responsable financiero" : ""}
                      {l.canPickUp ? " · Autorizado a recoger" : ""}
                    </p>
                  </div>
                  {canManage && (
                    <form action={unlinkAction}>
                      <input type="hidden" name="linkId" value={l.linkId} />
                      <button
                        type="submit"
                        disabled={unlinkPending}
                        className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-muted hover:bg-red-l/60 hover:text-red-solid"
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Quitar
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {unlinkState.message && (
            <p
              role={unlinkState.status === "error" ? "alert" : "status"}
              className={`text-xs font-semibold ${
                unlinkState.status === "error" ? "text-red-solid" : "text-green-solid"
              }`}
            >
              {unlinkState.message}
            </p>
          )}

          {canManage && user.linkCandidates.length > 0 && (
            <form
              action={linkAction}
              className="grid gap-3 rounded-control border border-line bg-cloud/60 p-3.5 sm:grid-cols-[1.4fr_0.8fr_auto] sm:items-end"
            >
              {user.role === "GUARDIAN" ? (
                <input type="hidden" name="guardianId" value={user.id} />
              ) : (
                <input type="hidden" name="studentId" value={user.id} />
              )}

              <div>
                <label htmlFor={`${id}-candidate`} className="field-label">
                  {user.role === "GUARDIAN" ? "Vincular estudiante" : "Vincular acudiente"}
                </label>
                <select
                  id={`${id}-candidate`}
                  name={user.role === "GUARDIAN" ? "studentId" : "guardianId"}
                  required
                  className="input min-h-10 bg-white text-sm font-medium"
                >
                  {user.linkCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`${id}-rel`} className="field-label">
                  Parentesco
                </label>
                <select
                  id={`${id}-rel`}
                  name="relationship"
                  defaultValue="ACUDIENTE"
                  className="input min-h-10 bg-white text-sm font-medium"
                >
                  {GUARDIAN_RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>
                      {GUARDIAN_RELATIONSHIP_LABELS[rel]}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={linkPending} className={pillButtonClass({ variant: "navy", size: "sm" })}>
                <Link2 aria-hidden /> {linkPending ? "Vinculando…" : "Vincular"}
              </button>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-2 sm:col-span-3">
                <input type="checkbox" name="isFinancialResponsible" className="size-4 accent-navy" />
                Responsable financiero (cartera y facturación)
              </label>

              {linkState.message && (
                <p
                  role={linkState.status === "error" ? "alert" : "status"}
                  className={`text-xs font-semibold sm:col-span-3 ${
                    linkState.status === "error" ? "text-red-solid" : "text-green-solid"
                  }`}
                >
                  {linkState.message}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
