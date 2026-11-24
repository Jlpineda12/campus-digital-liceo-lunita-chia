import "server-only";
import { notFound, redirect } from "next/navigation";
import { can, type Permission } from "./permissions";
import type { Role } from "./roles";
import { getSession, type SessionUser } from "./session";

/** Exige sesión válida; si no hay, envía a `/login`. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/**
 * Exige uno de los roles indicados. Ante un rol no autorizado responde 404 para
 * no revelar la existencia del recurso (REGLAS.md §3.1).
 */
export async function requireRole<const R extends Role>(
  ...roles: R[]
): Promise<SessionUser & { role: R }> {
  const user = await requireSession();
  if (!(roles as Role[]).includes(user.role)) notFound();
  return user as SessionUser & { role: R };
}

/**
 * Exige un permiso de la matriz (`permissions.ts`). Úsese en páginas, Server
 * Actions y Route Handlers; el alcance sobre el recurso se valida aparte.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSession();
  if (!can(user.role, permission)) notFound();
  return user;
}
