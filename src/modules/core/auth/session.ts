import "server-only";
import { and, desc, eq, lte, notInArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { recordAudit, type DbExecutor } from "@/modules/core/audit/service";
import { CHILD_COOKIE, SESSION_COOKIE, SESSION_TTL_MS } from "./cookies";
import type { Role } from "./roles";
import { generateToken, hashToken } from "./tokens";

/** Máximo de sesiones simultáneas por usuario; al superarlo se cierran las más antiguas. */
export const MAX_ACTIVE_SESSIONS = 10;

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * IP y agente de usuario de la petición. En producción el proxy inverso
 * (Nginx/Caddy/Cloudflare) debe SOBRESCRIBIR `x-forwarded-for` con la IP real;
 * si no, un cliente podría falsificarla y evadir el límite por IP.
 */
export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
  host: string | null;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    host: h.get("host"),
  };
}

/** Borra sesiones vencidas de todos los usuarios (barato gracias a `sessions_expires_idx`). */
export async function purgeExpiredSessions(executor: DbExecutor = db): Promise<void> {
  await executor.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}

/** Crea la sesión en base de datos y entrega el token en una cookie HTTP-only. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await getRequestMeta();

  await db.transaction(async (tx) => {
    await purgeExpiredSessions(tx);
    await tx.insert(sessions).values({
      id: hashToken(token),
      userId,
      expiresAt,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    // Conserva solo las MAX_ACTIVE_SESSIONS más recientes del usuario.
    const keep = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(MAX_ACTIVE_SESSIONS);
    await tx.delete(sessions).where(
      and(
        eq(sessions.userId, userId),
        notInArray(
          sessions.id,
          keep.map((s) => s.id),
        ),
      ),
    );
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Cierra TODAS las sesiones de un usuario. Obligatorio al restablecer la
 * contraseña o al desactivar la cuenta (REGLAS.md §3.2).
 */
export async function revokeAllUserSessions(
  userId: string,
  options: { actorUserId: string | null; reason: string; ipAddress?: string | null },
  executor: DbExecutor = db,
): Promise<void> {
  await executor.delete(sessions).where(eq(sessions.userId, userId));
  await recordAudit(
    {
      actorUserId: options.actorUserId,
      action: "SESSIONS_REVOKED",
      entityType: "user",
      entityId: userId,
      after: { reason: options.reason },
      ipAddress: options.ipAddress,
    },
    executor,
  );
}

/**
 * Sesión vigente de la petición (memorizada por petición con `cache`).
 * Verifica en base de datos: expiración y usuario activo.
 */
export const getSession = cache(async (): Promise<{ id: string; user: SessionUser } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      email: users.email,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now() || !row.isActive) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  return {
    id,
    user: {
      id: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`,
      role: row.role,
      email: row.email,
      avatarUrl: row.avatarUrl,
    },
  };
});

/** Cierra la sesión actual: borra el registro y las cookies. Devuelve el usuario. */
export async function destroySession(): Promise<string | null> {
  const session = await getSession();
  if (session) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CHILD_COOKIE);
  return session?.user.id ?? null;
}
