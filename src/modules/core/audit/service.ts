import "server-only";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { db, type Database } from "@/db";
import { auditLogs, type AuditAction } from "@/db/schema";
import {
  evaluateThrottle,
  longestWindow,
  type ThrottleDecision,
  type ThrottlePolicy,
} from "@/modules/core/security/throttle";

/** Conexión o transacción en curso (para auditar dentro de la misma transacción). */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface AuditEntry {
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

/** Inserta un registro inmutable en `audit_logs` (REGLAS.md §2.3). */
export async function recordAudit(entry: AuditEntry, executor: DbExecutor = db): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: entry.before === undefined ? null : entry.before,
    afterJson: entry.after === undefined ? null : entry.after,
    ipAddress: entry.ipAddress ?? null,
  });
}

/**
 * Cuenta eventos recientes por IP, por cuenta+IP y por cuenta en una sola consulta
 * (usa los índices `audit_logs_throttle_idx` y `audit_logs_ip_idx`) y aplica la política.
 */
export async function checkThrottle(options: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  ip: string | null;
  policy: ThrottlePolicy;
}): Promise<ThrottleDecision> {
  const { action, entityType, entityId, ip, policy } = options;
  const now = Date.now();
  const since = (ms: number) => new Date(now - ms);

  // Parámetros `timestamptz` (el driver pg serializa los Date en ISO-8601).
  const ipSince = since(policy.perIp.windowMs).toISOString();
  const accountIpSince = since(policy.perAccountAndIp.windowMs).toISOString();
  const accountSince = since(policy.perAccount.windowMs).toISOString();
  const isAccount = sql`(${auditLogs.entityType} = ${entityType} and ${auditLogs.entityId} = ${entityId})`;

  const [row] = await db
    .select({
      perIp: ip
        ? sql<number>`coalesce(sum(case when ${auditLogs.ipAddress} = ${ip} and ${auditLogs.createdAt} >= ${ipSince}::timestamptz then 1 else 0 end), 0)`
        : sql<number>`0`,
      perAccountAndIp: ip
        ? sql<number>`coalesce(sum(case when ${isAccount} and ${auditLogs.ipAddress} = ${ip} and ${auditLogs.createdAt} >= ${accountIpSince}::timestamptz then 1 else 0 end), 0)`
        : sql<number>`0`,
      perAccount: sql<number>`coalesce(sum(case when ${isAccount} and ${auditLogs.createdAt} >= ${accountSince}::timestamptz then 1 else 0 end), 0)`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        gte(auditLogs.createdAt, since(longestWindow(policy))),
        ip ? or(eq(auditLogs.ipAddress, ip), isAccount) : isAccount,
      ),
    );

  return evaluateThrottle(policy, {
    perIp: ip ? Number(row?.perIp ?? 0) : null,
    perAccountAndIp: ip ? Number(row?.perAccountAndIp ?? 0) : null,
    perAccount: Number(row?.perAccount ?? 0),
  });
}
