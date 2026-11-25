import "server-only";
import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guardianLinks, passwordResetTokens, users } from "@/db/schema";
import { checkThrottle, recordAudit } from "@/modules/core/audit/service";
import { sendMail } from "@/modules/core/notifications/mailer";
import { PASSWORD_RESET_POLICY } from "@/modules/core/security/throttle";
import { isLocalHost } from "./demo";
import { hashPassword } from "./password";
import { validateNewPassword } from "./password-policy";
import { revokeAllUserSessions } from "./session";
import { generateToken, hashToken, isWellFormedToken } from "./tokens";

/** Vigencia del enlace de recuperación. */
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * URL base de los enlaces enviados por correo. Nunca se toma de la cabecera
 * `Host` en producción: un atacante podría hacer que el correo de la víctima
 * apunte a su dominio y robar el token ("password reset poisoning").
 */
function appBaseUrl(requestHost: string | null): string | null {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (process.env.NODE_ENV === "production") return null;
  return `http://${isLocalHost(requestHost) && requestHost ? requestHost : "localhost:3000"}`;
}

/**
 * Paso 1: solicitud. La respuesta al usuario es SIEMPRE la misma (no revela si la
 * cuenta existe o tiene correo). Devuelve `throttled` solo para mostrar espera.
 */
export async function requestPasswordReset(options: {
  identifier: string;
  ip: string | null;
  host: string | null;
}): Promise<{ throttled: boolean }> {
  const { identifier, ip, host } = options;
  const decision = await checkThrottle({
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "login",
    entityId: identifier,
    ip,
    policy: PASSWORD_RESET_POLICY,
  });
  if (decision.blocked) return { throttled: true };

  await recordAudit({
    actorUserId: null,
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "login",
    entityId: identifier,
    ipAddress: ip,
  });

  const column = identifier.includes("@") ? users.email : users.documentNumber;
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      isActive: users.isActive,
      role: users.role,
    })
    .from(users)
    .where(eq(column, identifier))
    .limit(1);
  if (!user || !user.isActive) return { throttled: false };

  // Estudiantes sin correo propio (p. ej. Primaria): el enlace va al acudiente.
  const recipient = user.email
    ? { email: user.email, name: user.firstName, forChild: false }
    : user.role === "STUDENT"
      ? await findGuardianRecipient(user.id)
      : null;
  if (!recipient) return { throttled: false };

  const token = generateToken();
  const now = new Date();
  await db.transaction(async (tx) => {
    // Un solo enlace vigente por usuario: los anteriores quedan invalidados.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      ipAddress: ip,
    });
  });

  const baseUrl = appBaseUrl(host);
  if (!baseUrl) {
    console.error("APP_URL no está configurado: no se envió el enlace de recuperación.");
    return { throttled: false };
  }
  const link = `${baseUrl}/recuperar-clave/${token}`;
  // Sin `await`: el tiempo de respuesta no debe delatar si la cuenta existe.
  const whose = recipient.forChild
    ? `la contraseña del Campus de ${user.firstName}`
    : "tu contraseña del Campus Digital del Liceo Lunita de Chía";
  void sendMail({
    to: recipient.email,
    subject: recipient.forChild
      ? `Restablece la contraseña de ${user.firstName} en el Campus Lunita`
      : "Restablece tu contraseña del Campus Lunita",
    text: [
      `Hola, ${recipient.name}.`,
      "",
      `Recibimos una solicitud para restablecer ${whose}.`,
      `Abre este enlace en los próximos 15 minutos: ${link}`,
      "",
      "Si no fue una solicitud tuya, ignora este mensaje: la contraseña actual sigue funcionando.",
    ].join("\n"),
    html: `<p>Hola, ${escapeHtml(recipient.name)}.</p><p>Recibimos una solicitud para restablecer ${escapeHtml(whose)}.</p><p><a href="${link}">Crear una nueva contraseña</a> (el enlace vence en 15 minutos).</p><p>Si no fue una solicitud tuya, ignora este mensaje: la contraseña actual sigue funcionando.</p>`,
  });
  return { throttled: false };
}

/** Acudiente con correo: primero el responsable financiero, luego cualquier otro vinculado. */
async function findGuardianRecipient(
  studentId: string,
): Promise<{ email: string; name: string; forChild: true } | null> {
  const [guardian] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(guardianLinks)
    .innerJoin(users, eq(users.id, guardianLinks.guardianId))
    .where(
      and(eq(guardianLinks.studentId, studentId), eq(users.isActive, true), isNotNull(users.email)),
    )
    .orderBy(desc(guardianLinks.isFinancialResponsible))
    .limit(1);
  return guardian?.email ? { email: guardian.email, name: guardian.firstName, forChild: true } : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function findValidToken(token: string) {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db
    .select({
      tokenId: passwordResetTokens.id,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      documentNumber: users.documentNumber,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.id, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Paso 2: el enlace es válido si existe, no se ha usado y no ha vencido. */
export async function getResetTokenOwner(token: string): Promise<{ firstName: string } | null> {
  const row = await findValidToken(token);
  return row ? { firstName: row.firstName } : null;
}

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "weak"; problems: string[] };

/**
 * Paso 3: cambia la contraseña, consume el token y cierra todas las sesiones,
 * todo en una transacción.
 */
export async function completePasswordReset(options: {
  token: string;
  newPassword: string;
  ip: string | null;
}): Promise<ResetResult> {
  const row = await findValidToken(options.token);
  if (!row) return { ok: false, reason: "invalid" };

  const problems = validateNewPassword(options.newPassword, row);
  if (problems.length > 0) return { ok: false, reason: "weak", problems };

  const passwordHash = await hashPassword(options.newPassword);
  const consumed = await db.transaction(async (tx) => {
    // Consumo atómico: si otra petición usó el token primero, no se actualiza nada.
    const used = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, row.tokenId), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    if (used.length === 0) return false;

    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await revokeAllUserSessions(
      row.userId,
      { actorUserId: row.userId, reason: "password_reset", ipAddress: options.ip },
      tx,
    );
    await recordAudit(
      {
        actorUserId: row.userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "user",
        entityId: row.userId,
        ipAddress: options.ip,
      },
      tx,
    );
    return true;
  });

  return consumed ? { ok: true } : { ok: false, reason: "invalid" };
}
