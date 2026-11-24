"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkThrottle, recordAudit } from "@/modules/core/audit/service";
import { LOGIN_POLICY } from "@/modules/core/security/throttle";
import { CHILD_COOKIE, SESSION_TTL_MS } from "./cookies";
import { DEMO_ACCOUNTS, isDemoLoginEnabled } from "./demo";
import { requireRole } from "./guards";
import { getDummyHash, verifyPassword } from "./password";
import { completePasswordReset, requestPasswordReset } from "./password-reset";
import { getLinkedStudentIds } from "./policies";
import { resolvePostLoginPath } from "./redirects";
import {
  completeResetSchema,
  demoLoginSchema,
  formText,
  loginSchema,
  normalizeIdentifier,
  requestResetSchema,
  selectChildSchema,
} from "./schemas";
import { createSession, destroySession, getRequestMeta } from "./session";
import { findUserForLogin, findUserIdByDocument } from "./users";

export interface LoginState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"identifier" | "password", string>>;
  identifier?: string;
}

const INVALID_CREDENTIALS = "El documento, correo o contraseña no coinciden. Revisa e intenta de nuevo.";

function waitMessage(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60000);
  return `Hubo demasiados intentos fallidos. Por seguridad, espera ${minutes} minutos antes de intentarlo de nuevo o restablece tu contraseña.`;
}

/** Inicio de sesión unificado (SIGA + Aula Virtual). */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawIdentifier = formText(formData, "identifier") ?? "";
  const parsed = loginSchema.safeParse({
    identifier: formText(formData, "identifier"),
    password: formData.get("password") ?? undefined,
    next: formText(formData, "next"),
    modulo: formText(formData, "modulo"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "identifier" || field === "password") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", fieldErrors, identifier: rawIdentifier };
  }

  const { password, next, modulo } = parsed.data;
  const identifier = normalizeIdentifier(parsed.data.identifier);
  const { ip } = await getRequestMeta();

  // Límite dual (IP + cuenta) — REGLAS.md §3.2.
  const throttle = await checkThrottle({
    action: "USER_LOGIN_FAILED",
    entityType: "login",
    entityId: identifier,
    ip,
    policy: LOGIN_POLICY,
  });
  if (throttle.blocked) {
    return { status: "error", message: waitMessage(throttle.retryAfterMs), identifier: rawIdentifier };
  }

  const user = await findUserForLogin(identifier);
  // Siempre se verifica un hash (real o ficticio) para no revelar si la cuenta existe.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !passwordOk) {
    await recordAudit({
      actorUserId: null,
      action: "USER_LOGIN_FAILED",
      entityType: "login",
      entityId: identifier,
      ipAddress: ip,
    });
    return { status: "error", message: INVALID_CREDENTIALS, identifier: rawIdentifier };
  }

  if (!user.isActive) {
    return {
      status: "error",
      message: "Tu cuenta está inactiva. Comunícate con Secretaría para reactivarla.",
      identifier: rawIdentifier,
    };
  }

  await createSession(user.id);
  await recordAudit({
    actorUserId: user.id,
    action: "USER_LOGIN",
    entityType: "user",
    entityId: user.id,
    ipAddress: ip,
  });
  redirect(resolvePostLoginPath({ next, modulo }));
}

/** Acceso rápido por rol con las cuentas semilla. Solo en desarrollo y en host local. */
export async function demoLoginAction(formData: FormData): Promise<void> {
  const { ip, host } = await getRequestMeta();
  if (!isDemoLoginEnabled(host)) redirect("/login");

  const parsed = demoLoginSchema.safeParse({
    role: formText(formData, "role"),
    next: formText(formData, "next"),
    modulo: formText(formData, "modulo"),
  });
  if (!parsed.success) redirect("/login");

  const userId = await findUserIdByDocument(DEMO_ACCOUNTS[parsed.data.role].documentNumber);
  if (!userId) redirect("/login?error=demo");

  await createSession(userId);
  await recordAudit({
    actorUserId: userId,
    action: "USER_LOGIN",
    entityType: "user",
    entityId: userId,
    after: { demo: true },
    ipAddress: ip,
  });
  redirect(resolvePostLoginPath(parsed.data));
}

export async function logoutAction(): Promise<void> {
  const { ip } = await getRequestMeta();
  const userId = await destroySession();
  if (userId) {
    await recordAudit({
      actorUserId: userId,
      action: "USER_LOGOUT",
      entityType: "user",
      entityId: userId,
      ipAddress: ip,
    });
  }
  redirect("/login");
}

/** El acudiente cambia el hijo activo. Se valida el vínculo en `guardian_links`. */
export async function selectChildAction(formData: FormData): Promise<void> {
  const guardian = await requireRole("GUARDIAN");
  const parsed = selectChildSchema.safeParse({ studentId: formText(formData, "studentId") });
  if (!parsed.success) return;

  const linked = await getLinkedStudentIds(guardian.id);
  if (!linked.includes(parsed.data.studentId)) return;

  (await cookies()).set(CHILD_COOKIE, parsed.data.studentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  refresh();
}

/* ---------------------------------------------------------------------------
   Recuperación de contraseña (/recuperar-clave)
   --------------------------------------------------------------------------- */

export interface ResetRequestState {
  status: "idle" | "sent" | "error";
  message?: string;
  identifier?: string;
}

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const raw = formText(formData, "identifier") ?? "";
  const parsed = requestResetSchema.safeParse({ identifier: formText(formData, "identifier") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message, identifier: raw };
  }

  const { ip, host } = await getRequestMeta();
  const { throttled } = await requestPasswordReset({
    identifier: normalizeIdentifier(parsed.data.identifier),
    ip,
    host,
  });
  if (throttled) {
    return {
      status: "error",
      message: "Ya enviamos varias solicitudes. Revisa tu correo o espera unos minutos.",
      identifier: raw,
    };
  }
  // Respuesta neutra: idéntica exista o no la cuenta.
  return { status: "sent" };
}

export interface ResetCompleteState {
  status: "idle" | "error";
  message?: string;
  problems?: string[];
  fieldErrors?: Partial<Record<"password" | "confirm", string>>;
}

export async function completeResetAction(
  _prev: ResetCompleteState,
  formData: FormData,
): Promise<ResetCompleteState> {
  const parsed = completeResetSchema.safeParse({
    token: formText(formData, "token"),
    password: formData.get("password") ?? undefined,
    confirm: formData.get("confirm") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: ResetCompleteState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "password" || field === "confirm") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length === 0) {
      return { status: "error", message: "El enlace no es válido. Solicita uno nuevo." };
    }
    return { status: "error", fieldErrors };
  }

  const { ip } = await getRequestMeta();
  const result = await completePasswordReset({
    token: parsed.data.token,
    newPassword: parsed.data.password,
    ip,
  });

  if (!result.ok) {
    return result.reason === "weak"
      ? { status: "error", problems: result.problems }
      : { status: "error", message: "El enlace venció o ya fue usado. Solicita uno nuevo." };
  }
  redirect("/login?clave=actualizada");
}
